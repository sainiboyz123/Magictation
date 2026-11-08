import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Icon from './Icon.jsx';
import { PORTS, deviceTiles, kindOf } from './catalog.js';
import NodeCard from './NodeCard.jsx';
import Inspector from './Inspector.jsx';
import AddCardSheet from './AddCardSheet.jsx';
import {
  NODE_H, NODE_W, addNode, bounds, connect, connectProblem, duplicateNodes, freeSpot, newNode, portPos,
  removeEdge, removeNodes, replaceNode, snap, toYaml, updateParams, wirePath,
} from './graph.js';
import { simulate } from './simulate.js';
import { api } from './api.js';

const MODES = [['single', 'Ignore new triggers while running'], ['restart', 'Restart when triggered again'], ['queued', 'Queue new triggers'], ['parallel', 'Run in parallel']];
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const DOCK = [
  { id: 'trigger', label: 'When', tone: 'when' },
  { id: 'condition', label: 'And', tone: 'and' },
  { id: 'action', label: 'Then', tone: 'then' },
  { id: 'delay', label: 'Wait', tone: 'then', icon: 'hourglass' },
];
const DELAY = { type: 'action.delay', app: 'flow', text: 'Wait {seconds}', params: { seconds: 60 } };

export default function Editor({ initial, meta, live, onBack, onSaved, toast, registerActions }) {
  const [flow, setFlow] = useState(() => ({ ...initial, nodes: initial.nodes || [], edges: initial.edges || [] }));
  const [saved, setSaved] = useState(() => JSON.stringify({ ...initial, nodes: initial.nodes || [], edges: initial.edges || [] }));
  const [hist, setHist] = useState({ past: [], future: [] });
  const [sel, setSel] = useState({ nodes: [], edge: null });
  const [sheet, setSheet] = useState(null);
  const [preview, setPreview] = useState(false);
  const [simOn, setSimOn] = useState(false);
  const [compiled, setCompiled] = useState({ ok: false, errors: [], warnings: [], automation: null, pending: true });
  const [saving, setSaving] = useState(false);
  const [view, setView] = useState({ x: 80, y: 80, k: 1 });
  const [wire, setWire] = useState(null);
  const vpRef = useRef(), last = useRef({ key: '', t: 0 }), drag = useRef(null);

  const dirty = JSON.stringify(flow) !== saved;
  const entityById = useMemo(() => Object.fromEntries(meta.entities.map((e) => [e.entity_id, e])), [meta]);
  const tileById = useMemo(() => Object.fromEntries(deviceTiles(meta, { showAll: true }).map((t) => [t.id, t])), [meta]);
  const getState = useCallback((id) => live[id] ?? entityById[id]?.state, [live, entityById]);
  const ctx = useMemo(() => ({ name: (id) => entityById[id]?.name || id, tile: (id) => tileById[id] }), [entityById, tileById]);
  const nodeById = useMemo(() => Object.fromEntries(flow.nodes.map((n) => [n.id, n])), [flow.nodes]);

  // ----- history -----
  const commit = useCallback((next, key = '') => {
    setFlow((cur) => {
      const now = Date.now();
      const coalesce = key && last.current.key === key && now - last.current.t < 900;
      last.current = { key, t: now };
      if (!coalesce) setHist((h) => ({ past: [...h.past.slice(-79), cur], future: [] }));
      return typeof next === 'function' ? next(cur) : next;
    });
  }, []);
  const undo = useCallback(() => setHist((h) => {
    if (!h.past.length) return h;
    const prev = h.past[h.past.length - 1];
    setFlow((cur) => { setTimeout(() => setHist((x) => ({ ...x, future: [cur, ...x.future] })), 0); return prev; });
    return { ...h, past: h.past.slice(0, -1) };
  }), []);
  const redo = useCallback(() => setHist((h) => {
    if (!h.future.length) return h;
    const nxt = h.future[0];
    setFlow((cur) => { setTimeout(() => setHist((x) => ({ ...x, past: [...x.past, cur] })), 0); return nxt; });
    return { ...h, future: h.future.slice(1) };
  }), []);

  // ----- validation via the server compiler -----
  useEffect(() => {
    const t = setTimeout(() => api.compile(flow).then(setCompiled).catch(() => {}), 300);
    return () => clearTimeout(t);
  }, [flow]);
  const byCard = (list) => { const m = {}; (list || []).forEach((e) => { if (e.card && !m[e.card]) m[e.card] = e.message; }); return m; };
  const errorsById = useMemo(() => byCard(compiled.errors), [compiled]);
  const warningsById = useMemo(() => byCard(compiled.warnings), [compiled]);
  const globalErrors = compiled.errors.filter((e) => !e.card);
  const sim = useMemo(() => (simOn ? simulate(flow, getState) : null), [simOn, flow, getState]);

  // ----- save / run -----
  const save = useCallback(async () => {
    setSaving(true);
    try {
      const res = await api.save(flow);
      setFlow(res.flow);
      setSaved(JSON.stringify(res.flow));
      onSaved(res.flow);
      if (res.deploy.deployed) toast('ok', `Deployed to Home Assistant${res.flow.entity_id ? ` as ${res.flow.entity_id}` : ''}`);
      else toast('warn', `Saved as draft: ${res.deploy.errors[0]?.message || 'not deployable yet'}`);
    } catch (e) { toast('err', e.message); }
    setSaving(false);
  }, [flow, onSaved, toast]);
  const runNow = async () => {
    try { await api.run(flow.id); toast('ok', 'Flow started in Home Assistant'); } catch (e) { toast('err', e.message); }
  };

  // ----- coordinates -----
  const toWorld = useCallback((cx, cy) => {
    const r = vpRef.current.getBoundingClientRect();
    return { x: (cx - r.left - view.x) / view.k, y: (cy - r.top - view.y) / view.k };
  }, [view]);
  const viewCenter = () => {
    const r = vpRef.current.getBoundingClientRect();
    return toWorld(r.left + r.width / 2 - NODE_W / 2, r.top + r.height / 2 - NODE_H / 2);
  };

  // ----- adding cards -----
  const openAdd = useCallback((kind, at, from) => {
    if (!from && kind !== 'trigger' && sel.nodes.length === 1) {
      const src = nodeById[sel.nodes[0]];
      if (src) from = { id: src.id, port: PORTS[kindOf(src.type)].outputs[0] };
    }
    const kinds = from ? ['condition', 'action'] : ['trigger', 'condition', 'action'];
    setSheet({ kind: kind || 'action', kinds, at, from });
  }, [sel, nodeById]);

  const place = useCallback((preset, at, from) => {
    let pos = at;
    if (!pos && from && nodeById[from.id]) {
      const s = nodeById[from.id];
      pos = { x: s.x + NODE_W + 96, y: s.y + (from.port === 'no' ? NODE_H + 32 : 0) };
    }
    if (!pos) pos = viewCenter();
    const spot = at ? { x: snap(pos.x), y: snap(pos.y) } : freeSpot(flow, pos.x, pos.y);
    const node = newNode(preset, spot.x, spot.y);
    // keep the new card on screen
    const vp = vpRef.current;
    setView((v) => {
      const sx = node.x * v.k + v.x, sy = node.y * v.k + v.y, w = NODE_W * v.k, h = NODE_H * v.k;
      let { x, y } = v;
      if (sx + w + 60 > vp.clientWidth) x -= sx + w + 60 - vp.clientWidth;
      if (sx < 40) x += 40 - sx;
      if (sy + h + 110 > vp.clientHeight) y -= sy + h + 110 - vp.clientHeight;
      if (sy < 60) y += 60 - sy;
      return x === v.x && y === v.y ? v : { ...v, x, y };
    });
    commit((f) => {
      let g = addNode(f, node);
      if (from) g = connect(g, from.id, from.port, node.id);
      return g;
    });
    setSel({ nodes: [node.id], edge: null });
  }, [flow, nodeById, commit, view]); // eslint-disable-line react-hooks/exhaustive-deps

  const onSheetPick = (preset) => {
    if (sheet.replace) commit((f) => replaceNode(f, sheet.replace, preset));
    else place(preset, sheet.at, sheet.from);
  };

  // ----- deleting / duplicating -----
  const deleteSelection = useCallback(() => {
    if (sel.edge) { commit((f) => removeEdge(f, sel.edge)); setSel({ nodes: [], edge: null }); return; }
    if (sel.nodes.length) { commit((f) => removeNodes(f, sel.nodes)); setSel({ nodes: [], edge: null }); }
  }, [sel, commit]);
  const duplicate = useCallback(() => {
    if (!sel.nodes.length) return;
    const r = duplicateNodes(flow, sel.nodes);
    commit(r.flow);
    setSel({ nodes: r.ids, edge: null });
  }, [sel, flow, commit]);

  // ----- keyboard -----
  useEffect(() => {
    const h = (e) => {
      const typing = /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName || '') || document.querySelector('.modal-back');
      const mod = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();
      if (mod && key === 's') { e.preventDefault(); save(); return; }
      if (typing) return;
      if (mod && key === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); }
      else if (mod && key === 'y') { e.preventDefault(); redo(); }
      else if (mod && key === 'd') { e.preventDefault(); duplicate(); }
      else if (mod && key === 'a') { e.preventDefault(); setSel({ nodes: flow.nodes.map((n) => n.id), edge: null }); }
      else if (key === 'delete' || key === 'backspace') { e.preventDefault(); deleteSelection(); }
      else if (key === 'escape') setSel({ nodes: [], edge: null });
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [save, undo, redo, duplicate, deleteSelection, flow.nodes]);

  // ----- fit / zoom -----
  const fit = useCallback(() => {
    const vp = vpRef.current;
    const b = bounds(flow);
    if (!vp) return;
    if (!b) { setView({ x: 80, y: 80, k: 1 }); return; }
    const k = clamp(Math.min((vp.clientWidth - 120) / b.w, (vp.clientHeight - 180) / b.h), 0.4, 1.1);
    setView({ k, x: (vp.clientWidth - b.w * k) / 2 - b.x * k, y: (vp.clientHeight - b.h * k) / 2 - b.y * k - 30 });
  }, [flow]);
  const fitOnce = useRef(false);
  useEffect(() => { if (!fitOnce.current) { fitOnce.current = true; setTimeout(fit, 20); } }, [fit]);
  const zoomBy = (f) => {
    const vp = vpRef.current;
    const cx = vp.clientWidth / 2, cy = vp.clientHeight / 2;
    setView((v) => { const k = clamp(v.k * f, 0.3, 1.8); return { k, x: cx - ((cx - v.x) / v.k) * k, y: cy - ((cy - v.y) / v.k) * k }; });
  };

  useEffect(() => {
    const vp = vpRef.current;
    const wheel = (e) => {
      if (e.target.closest('.inspector, .dock')) return;
      e.preventDefault();
      if (e.ctrlKey || e.metaKey) {
        const r = vp.getBoundingClientRect();
        setView((v) => {
          const k = clamp(v.k * (e.deltaY < 0 ? 1.1 : 0.9), 0.3, 1.8);
          const cx = e.clientX - r.left, cy = e.clientY - r.top;
          return { k, x: cx - ((cx - v.x) / v.k) * k, y: cy - ((cy - v.y) / v.k) * k };
        });
      } else setView((v) => ({ ...v, x: v.x - e.deltaX, y: v.y - e.deltaY }));
    };
    vp.addEventListener('wheel', wheel, { passive: false });
    return () => vp.removeEventListener('wheel', wheel);
  }, []);

  // ----- pointer interactions: pan, move cards, draw wires -----
  const capture = (e) => { try { vpRef.current.setPointerCapture(e.pointerId); } catch { /* ignore */ } };

  const onBackgroundDown = (e) => {
    if (e.button !== 0 || e.target.closest('.node, .edge-hit, .edge-x, .dock, .inspector, .empty-start')) return;
    drag.current = { type: 'pan', sx: e.clientX, sy: e.clientY, vx: view.x, vy: view.y, moved: false };
    capture(e);
    vpRef.current.classList.add('panning');
  };

  const onNodeDown = useCallback((e, node) => {
    if (e.button !== 0 || e.target.closest('.port')) return;
    e.stopPropagation();
    let ids;
    if (e.shiftKey) {
      ids = sel.nodes.includes(node.id) ? sel.nodes.filter((x) => x !== node.id) : [...sel.nodes, node.id];
    } else ids = sel.nodes.includes(node.id) ? sel.nodes : [node.id];
    setSel({ nodes: ids, edge: null });
    const origin = Object.fromEntries(flow.nodes.filter((n) => ids.includes(n.id)).map((n) => [n.id, { x: n.x, y: n.y }]));
    drag.current = { type: 'move', sx: e.clientX, sy: e.clientY, origin, moved: false, key: `move:${Date.now()}` };
    capture(e);
  }, [sel, flow.nodes]);

  const onPortDown = useCallback((e, node, port) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    const p = portPos(node, port);
    drag.current = { type: 'wire', from: node.id, port };
    setWire({ from: node.id, port, x: p.x, y: p.y });
    capture(e);
  }, []);

  const onMove = (e) => {
    const d = drag.current;
    if (!d) return;
    if (d.type === 'pan') {
      if (Math.abs(e.clientX - d.sx) + Math.abs(e.clientY - d.sy) > 3) d.moved = true;
      setView((v) => ({ ...v, x: d.vx + e.clientX - d.sx, y: d.vy + e.clientY - d.sy }));
    } else if (d.type === 'move') {
      const dx = (e.clientX - d.sx) / view.k, dy = (e.clientY - d.sy) / view.k;
      if (!d.moved && Math.abs(dx) + Math.abs(dy) < 3) return;
      d.moved = true;
      commit((f) => ({ ...f, nodes: f.nodes.map((n) => (d.origin[n.id] ? { ...n, x: d.origin[n.id].x + dx, y: d.origin[n.id].y + dy } : n)) }), d.key);
    } else if (d.type === 'wire') {
      const w = toWorld(e.clientX, e.clientY);
      setWire((cur) => cur && { ...cur, x: w.x, y: w.y });
    }
  };

  const onUp = (e) => {
    const d = drag.current;
    drag.current = null;
    vpRef.current.classList.remove('panning');
    if (!d) return;
    if (d.type === 'pan' && !d.moved) setSel({ nodes: [], edge: null });
    if (d.type === 'move' && d.moved) {
      commit((f) => ({ ...f, nodes: f.nodes.map((n) => (d.origin[n.id] ? { ...n, x: snap(n.x), y: snap(n.y) } : n)) }), d.key);
    }
    if (d.type === 'wire') {
      setWire(null);
      const el = document.elementFromPoint(e.clientX, e.clientY);
      const target = el?.closest('[data-node]')?.dataset.node;
      if (target && target !== d.from) {
        const problem = connectProblem(flow, d.from, d.port, target);
        if (problem) toast('warn', problem);
        else commit((f) => connect(f, d.from, d.port, target));
      } else if (!target && el && vpRef.current.contains(el) && !el.closest('.dock, .inspector')) {
        const w = toWorld(e.clientX, e.clientY);
        openAdd('action', { x: w.x, y: w.y - NODE_H / 2 }, { id: d.from, port: d.port });
      }
    }
  };

  // ----- drag from the dock -----
  const onDrop = (e) => {
    const kind = e.dataTransfer.getData('text/x-magictation');
    if (!kind) return;
    e.preventDefault();
    const w = toWorld(e.clientX, e.clientY);
    const at = { x: w.x - NODE_W / 2, y: w.y - NODE_H / 2 };
    if (kind === 'delay') place(DELAY, at);
    else openAdd(kind, at, undefined);
  };
  const dockClick = (id) => (id === 'delay' ? place(DELAY, undefined, sel.nodes.length === 1 ? { id: sel.nodes[0], port: PORTS[kindOf(nodeById[sel.nodes[0]]?.type)]?.outputs[0] } : undefined) : openAdd(id));

  // ----- command palette -----
  useEffect(() => {
    registerActions?.([
      { id: 'save', label: 'Save & deploy flow', icon: 'save', run: save },
      { id: 'undo', label: 'Undo', icon: 'undo', run: undo },
      { id: 'redo', label: 'Redo', icon: 'redo', run: redo },
      { id: 'fit', label: 'Fit flow to screen', icon: 'fit', run: fit },
      { id: 'preview', label: 'Show Home Assistant YAML', icon: 'eye', run: () => setPreview((p) => !p) },
      { id: 'test', label: 'Test with live device states', icon: 'play', run: () => setSimOn((s) => !s) },
      ...DOCK.slice(0, 3).map((d) => ({ id: `add-${d.id}`, label: `Add ${d.label} card`, icon: 'plus', run: () => openAdd(d.id) })),
    ]);
    return () => registerActions?.([]);
  }, [registerActions, save, undo, redo, fit, openAdd]);

  // ----- render -----
  const selectedNode = sel.nodes.length === 1 ? nodeById[sel.nodes[0]] : null;
  const issues = compiled.pending ? 0 : compiled.errors.length;
  const edgeEnds = (e) => {
    const a = nodeById[e.from], b = nodeById[e.to];
    if (!a || !b) return null;
    return { a: portPos(a, e.port), b: portPos(b, 'in') };
  };
  const wireFrom = wire && nodeById[wire.from] ? portPos(nodeById[wire.from], wire.port) : null;
  const selEdge = sel.edge && flow.edges.find((e) => e.id === sel.edge);
  const selEnds = selEdge && edgeEnds(selEdge);

  return (
    <div className="editor">
      <header className="toolbar">
        <button className="icon-btn" onClick={() => (dirty && !confirm('Discard unsaved changes?') ? null : onBack())} title="Back to flows" aria-label="Back to flows"><Icon name="back" /></button>
        <input className="name-input" value={flow.name} onChange={(e) => commit((f) => ({ ...f, name: e.target.value }), 'name')} placeholder="Name your flow" aria-label="Flow name" />
        <select className="mode" value={flow.mode} onChange={(e) => commit((f) => ({ ...f, mode: e.target.value }))} title="What happens if the flow is triggered again while it is still running">
          {MODES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <span className="spacer" />
        <button className="icon-btn" onClick={undo} disabled={!hist.past.length} title="Undo (Ctrl+Z)" aria-label="Undo"><Icon name="undo" /></button>
        <button className="icon-btn" onClick={redo} disabled={!hist.future.length} title="Redo (Ctrl+Y)" aria-label="Redo"><Icon name="redo" /></button>
        <span className="sep" />
        <button className="icon-btn" onClick={() => zoomBy(0.85)} title="Zoom out" aria-label="Zoom out"><Icon name="minus" /></button>
        <span className="zoom">{Math.round(view.k * 100)}%</span>
        <button className="icon-btn" onClick={() => zoomBy(1.15)} title="Zoom in" aria-label="Zoom in"><Icon name="plus" /></button>
        <button className="icon-btn" onClick={fit} title="Fit to screen" aria-label="Fit to screen"><Icon name="fit" /></button>
        <span className="sep" />
        <button className={`btn ${simOn ? 'active' : ''}`} onClick={() => setSimOn((s) => !s)} title="Show which path the flow would take right now"><Icon name="play" size={16} /> Test</button>
        <button className={`btn ${preview ? 'active' : ''}`} onClick={() => setPreview((p) => !p)}><Icon name="eye" size={16} /> YAML</button>
        <button className="btn" onClick={runNow} disabled={!flow.id || dirty || !flow.deployed} title="Start this flow in Home Assistant now"><Icon name="bolt" size={16} /> Run</button>
        <button className="btn primary" onClick={save} disabled={saving}><Icon name="save" size={16} /> {saving ? 'Saving…' : dirty || !flow.deployed ? 'Save' : 'Saved'}</button>
      </header>

      <div className="viewport" ref={vpRef} onPointerDown={onBackgroundDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
        onDragOver={(e) => e.preventDefault()} onDrop={onDrop}>
        <div className="grid-bg" style={{ backgroundPosition: `${view.x}px ${view.y}px`, backgroundSize: `${24 * view.k}px ${24 * view.k}px` }} />
        <div className="status-bar">
          <span className={`pill ${issues ? 'bad' : 'good'}`}><Icon name={issues ? 'warn' : 'check'} size={14} /> {compiled.pending ? 'Checking…' : issues ? `${issues} thing${issues > 1 ? 's' : ''} to fix` : 'Ready'}</span>
          {globalErrors.map((e, i) => <span key={i} className="pill bad">{e.message}</span>)}
          {sim && <span className={`pill ${sim.wouldRun ? 'good' : 'bad'}`}>{sim.wouldRun ? 'Test: the green path would run right now' : 'Test: nothing would run right now'}</span>}
          {dirty && <span className="pill neutral">Unsaved changes</span>}
        </div>
        <div className="world" style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.k})` }}>
          <svg className="wires" width="1" height="1" overflow="visible">
            {flow.edges.map((e) => {
              const ends = edgeEnds(e);
              if (!ends) return null;
              const d = wirePath(ends.a, ends.b);
              const cls = ['edge', `p-${e.port}`, sel.edge === e.id && 'sel', sim && (sim.taken.has(e.id) ? 'taken' : 'idle')].filter(Boolean).join(' ');
              return (
                <g key={e.id} className={cls}>
                  <path d={d} className="edge-line" />
                  <path d={d} className="edge-hit" onPointerDown={(ev) => { ev.stopPropagation(); setSel({ nodes: [], edge: e.id }); }} />
                </g>
              );
            })}
            {wireFrom && <path className={`edge-live p-${wire.port}`} d={wirePath(wireFrom, { x: wire.x, y: wire.y })} />}
          </svg>
          {selEnds && (
            <button className="edge-x" style={{ left: (selEnds.a.x + selEnds.b.x) / 2, top: (selEnds.a.y + selEnds.b.y) / 2 }}
              onClick={() => { commit((f) => removeEdge(f, selEdge.id)); setSel({ nodes: [], edge: null }); }} title="Remove this line" aria-label="Remove this line">
              <Icon name="close" size={14} />
            </button>
          )}
          {flow.nodes.map((n) => (
            <NodeCard key={n.id} node={n} ctx={ctx} live={getState} selected={sel.nodes.includes(n.id)}
              error={errorsById[n.id]} warning={warningsById[n.id]} sim={sim?.results[n.id]} connecting={!!wire && wire.from !== n.id}
              onNodeDown={onNodeDown} onPortDown={onPortDown} />
          ))}
        </div>

        {flow.nodes.length === 0 && (
          <div className="empty-start">
            <h2>Start your flow</h2>
            <p>Add a <b className="t-when">When</b> card, then drag a line from its dot to an <b className="t-and">And</b> or <b className="t-then">Then</b> card.
              And cards have a <b className="t-yes">Yes</b> and a <b className="t-no">No</b> output.</p>
            <button className="btn primary big" onClick={() => openAdd('trigger')}><Icon name="plus" /> Add a When card</button>
          </div>
        )}

        <div className="dock" role="toolbar" aria-label="Add cards">
          {DOCK.map((d) => (
            <button key={d.id} className={`dock-btn k-${d.tone}`} draggable
              onDragStart={(e) => { e.dataTransfer.setData('text/x-magictation', d.id); e.dataTransfer.effectAllowed = 'copy'; }}
              onClick={() => dockClick(d.id)} title={`Click or drag onto the canvas to add a ${d.label} card`}>
              {d.icon ? <Icon name={d.icon} size={16} /> : <Icon name="plus" size={16} />} {d.label}
            </button>
          ))}
        </div>

        {selectedNode && !wire && (
          <Inspector node={selectedNode} ctx={ctx} meta={meta} error={errorsById[selectedNode.id]} warning={warningsById[selectedNode.id]}
            sim={sim?.results[selectedNode.id]}
            onPatch={(id, p) => commit((f) => updateParams(f, id, p), `p:${id}:${Object.keys(p)[0]}`)}
            onReplace={() => setSheet({ replace: selectedNode.id, kind: kindOf(selectedNode.type), kinds: ['trigger', 'condition', 'action'], title: 'Change card' })}
            onDuplicate={duplicate} onDelete={deleteSelection} onClose={() => setSel({ nodes: [], edge: null })} />
        )}

        {preview && (
          <aside className="drawer">
            <div className="modal-head"><h3>Home Assistant automation</h3><button className="icon-btn" onClick={() => setPreview(false)} aria-label="Close"><Icon name="close" /></button></div>
            {compiled.automation ? <pre className="yaml">{toYaml(compiled.automation)}</pre> : <div className="empty">Nothing to show yet.</div>}
            {compiled.errors.length > 0 && <ul className="err-list">{compiled.errors.map((e, i) => <li key={i}>{e.message}</li>)}</ul>}
            <button className="btn" onClick={() => navigator.clipboard?.writeText(toYaml(compiled.automation || {})).then(() => toast('ok', 'YAML copied'))}><Icon name="copy" size={15} /> Copy YAML</button>
          </aside>
        )}
      </div>

      {sheet && <AddCardSheet meta={meta} kind={sheet.kind} kinds={sheet.kinds} title={sheet.title} onPick={onSheetPick} onClose={() => setSheet(null)} />}
    </div>
  );
}
