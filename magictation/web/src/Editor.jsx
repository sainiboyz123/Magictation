import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import Icon from './Icon.jsx';
import { KINDS } from './catalog.js';
import { CardList } from './CardView.jsx';
import { CardPicker } from './Pickers.jsx';
import { addCard, duplicateCard, moveCard, newCard, removeCard, toYaml, updateParams, countCards } from './flowOps.js';
import { simulate } from './simulate.js';
import { api } from './api.js';

const LANES = [
  { id: 'when', kind: 'trigger', title: 'WHEN', sub: 'Something happens' },
  { id: 'and', kind: 'condition', title: 'AND', sub: 'Only if these are true' },
  { id: 'then', kind: 'action', title: 'THEN', sub: 'Do these things' },
];
const MODES = [['single', 'Ignore new runs while running'], ['restart', 'Restart on new trigger'], ['queued', 'Queue new runs'], ['parallel', 'Run in parallel']];
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

export default function Editor({ initial, meta, live, onBack, onSaved, toast, registerActions }) {
  const [flow, setFlow] = useState(initial);
  const [saved, setSaved] = useState(JSON.stringify(initial));
  const [hist, setHist] = useState({ past: [], future: [] });
  const [selected, select] = useState(null);
  const [picker, setPicker] = useState(null);
  const [preview, setPreview] = useState(false);
  const [simOn, setSimOn] = useState(false);
  const [compiled, setCompiled] = useState({ ok: false, errors: [], automation: null, pending: true });
  const [saving, setSaving] = useState(false);
  const [view, setView] = useState({ x: 40, y: 20, k: 1 });
  const [wires, setWires] = useState([]);
  const [tick, setTick] = useState(0);
  const vpRef = useRef(), worldRef = useRef(), last = useRef({ key: '', t: 0 });

  const dirty = JSON.stringify(flow) !== saved;
  const entityById = useMemo(() => Object.fromEntries(meta.entities.map((e) => [e.entity_id, e])), [meta]);
  const getState = useCallback((id) => live[id] ?? entityById[id]?.state, [live, entityById]);
  const ctx = useMemo(() => ({ name: (id) => entityById[id]?.name || id }), [entityById]);

  // ----- history -----
  const commit = useCallback((next, key = '') => {
    setFlow((cur) => {
      const now = Date.now();
      const coalesce = key && last.current.key === key && now - last.current.t < 900;
      last.current = { key, t: now };
      if (!coalesce) setHist((h) => ({ past: [...h.past.slice(-49), cur], future: [] }));
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

  // ----- live validation via the server compiler -----
  useEffect(() => {
    const t = setTimeout(() => api.compile(flow).then(setCompiled).catch(() => {}), 300);
    return () => clearTimeout(t);
  }, [flow]);
  const errorsById = useMemo(() => {
    const m = {};
    compiled.errors.forEach((e) => { if (e.card && !m[e.card]) m[e.card] = e.message; });
    return m;
  }, [compiled]);
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
    try { await api.run(flow.id); toast('ok', 'Flow triggered in Home Assistant'); } catch (e) { toast('err', e.message); }
  };

  // ----- editor API handed to cards -----
  const ed = useMemo(() => ({
    selected, select, errorsById, sim, getState, ctx, meta,
    patch: (id, p) => commit((f) => updateParams(f, id, p), `p:${id}:${Object.keys(p)[0]}`),
    move: (id, d) => commit((f) => moveCard(f, id, d)),
    duplicate: (id) => commit((f) => duplicateCard(f, id)),
    remove: (id) => { commit((f) => removeCard(f, id)); select(null); },
    add: (listPath, kind) => setPicker({ listPath, kind }),
  }), [selected, errorsById, sim, getState, ctx, meta, commit]);

  const addFromPicker = (type) => {
    const c = newCard(type);
    commit((f) => addCard(f, picker.listPath, c));
    select(c.id);
  };

  // ----- keyboard -----
  useEffect(() => {
    const h = (e) => {
      const typing = /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName || '');
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); save(); }
      else if (!typing && (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); }
      else if (!typing && (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') { e.preventDefault(); redo(); }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [save, undo, redo]);

  // expose actions to the command palette
  useEffect(() => {
    registerActions?.([
      { id: 'save', label: 'Save & deploy flow', icon: 'save', run: save },
      { id: 'undo', label: 'Undo', icon: 'undo', run: undo },
      { id: 'redo', label: 'Redo', icon: 'redo', run: redo },
      { id: 'preview', label: 'Toggle automation preview', icon: 'eye', run: () => setPreview((p) => !p) },
      { id: 'test', label: 'Test conditions against live state', icon: 'play', run: () => setSimOn((s) => !s) },
      ...LANES.map((l) => ({ id: `add-${l.id}`, label: `Add ${l.title} card`, icon: 'plus', run: () => setPicker({ listPath: [l.id], kind: l.kind }) })),
    ]);
    return () => registerActions?.([]);
  }, [registerActions, save, undo, redo]);

  // ----- pan & zoom -----
  useEffect(() => {
    const vp = vpRef.current;
    const wheel = (e) => {
      e.preventDefault();
      if (e.ctrlKey || e.metaKey) {
        const r = vp.getBoundingClientRect();
        setView((v) => {
          const k = clamp(v.k * (e.deltaY < 0 ? 1.1 : 0.9), 0.4, 1.6);
          const cx = e.clientX - r.left, cy = e.clientY - r.top;
          return { k, x: cx - ((cx - v.x) / v.k) * k, y: cy - ((cy - v.y) / v.k) * k };
        });
      } else setView((v) => ({ ...v, x: v.x - e.deltaX, y: v.y - e.deltaY }));
    };
    vp.addEventListener('wheel', wheel, { passive: false });
    return () => vp.removeEventListener('wheel', wheel);
  }, []);

  const drag = useRef(null);
  const onPointerDown = (e) => {
    if (e.target.closest('.card, .hub, button, input, select, textarea, .toolbar')) return;
    drag.current = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y };
    e.currentTarget.setPointerCapture(e.pointerId);
    e.currentTarget.classList.add('panning');
  };
  const onPointerMove = (e) => {
    if (!drag.current) return;
    setView((v) => ({ ...v, x: drag.current.vx + e.clientX - drag.current.x, y: drag.current.vy + e.clientY - drag.current.y }));
  };
  const onPointerUp = (e) => { drag.current = null; e.currentTarget.classList.remove('panning'); };

  const fit = useCallback(() => {
    const vp = vpRef.current, w = worldRef.current;
    if (!vp || !w) return;
    const k = clamp(Math.min(1, (vp.clientWidth - 60) / w.offsetWidth), 0.4, 1);
    setView({ k, x: Math.max(20, (vp.clientWidth - w.offsetWidth * k) / 2), y: 24 });
  }, []);
  useEffect(() => { const t = setTimeout(fit, 30); window.addEventListener('resize', fit); return () => { clearTimeout(t); window.removeEventListener('resize', fit); }; }, [fit]);
  const zoom = (f) => setView((v) => ({ ...v, k: clamp(v.k * f, 0.4, 1.6) }));

  // ----- connectors (measured after layout) -----
  useEffect(() => { const h = () => setTick((t) => t + 1); window.addEventListener('resize', h); return () => window.removeEventListener('resize', h); }, []);
  useLayoutEffect(() => {
    const w = worldRef.current;
    if (!w) return;
    const wr = w.getBoundingClientRect();
    const pos = (el) => { const r = el.getBoundingClientRect(); return { x: (r.left - wr.left) / view.k, y: (r.top - wr.top) / view.k, w: r.width / view.k, h: r.height / view.k }; };
    const out = [];
    const hubs = LANES.map((l) => ({ lane: l, el: w.querySelector(`[data-hub="${l.id}"]`) }));
    for (let i = 0; i < hubs.length - 1; i++) {
      const a = pos(hubs[i].el), b = pos(hubs[i + 1].el);
      const x1 = a.x + a.w, y1 = a.y + a.h / 2, x2 = b.x, y2 = b.y + b.h / 2, dx = (x2 - x1) / 2;
      out.push({ key: `h${i}`, d: `M${x1},${y1} C${x1 + dx},${y1} ${x2 - dx},${y2} ${x2},${y2}`, tone: hubs[i + 1].lane.kind });
    }
    for (const { lane, el } of hubs) {
      let prev = pos(el);
      w.querySelectorAll(`[data-lane="${lane.id}"] > .card-list > [data-node]`).forEach((c, j) => {
        const p = pos(c);
        const x1 = prev.x + prev.w / 2, y1 = prev.y + prev.h, x2 = p.x + p.w / 2, y2 = p.y, dy = Math.max(10, (y2 - y1) / 2);
        out.push({ key: `${lane.id}${j}`, d: `M${x1},${y1} C${x1},${y1 + dy} ${x2},${y2 - dy} ${x2},${y2}`, tone: lane.kind });
        prev = p;
      });
    }
    setWires((old) => (JSON.stringify(old) === JSON.stringify(out) ? old : out));
  });

  const hint = countCards(flow) === 0;
  const issues = compiled.pending ? 0 : compiled.errors.length;

  return (
    <div className="editor">
      <header className="toolbar glass">
        <button className="icon-btn" onClick={() => (dirty && !confirm('Discard unsaved changes?') ? null : onBack())} title="Back to flows"><Icon name="back" /></button>
        <input className="name-input" value={flow.name} onChange={(e) => commit((f) => ({ ...f, name: e.target.value }), 'name')} placeholder="Name your flow" aria-label="Flow name" />
        <select className="mode" value={flow.mode} onChange={(e) => commit((f) => ({ ...f, mode: e.target.value }))} title="What happens if the flow triggers while running">
          {MODES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <span className="spacer" />
        <button className="icon-btn" onClick={undo} disabled={!hist.past.length} title="Undo (Ctrl+Z)"><Icon name="undo" /></button>
        <button className="icon-btn" onClick={redo} disabled={!hist.future.length} title="Redo (Ctrl+Y)"><Icon name="redo" /></button>
        <span className="sep" />
        <button className="icon-btn" onClick={() => zoom(0.85)} title="Zoom out"><Icon name="minus" /></button>
        <span className="zoom">{Math.round(view.k * 100)}%</span>
        <button className="icon-btn" onClick={() => zoom(1.15)} title="Zoom in"><Icon name="plus" /></button>
        <button className="icon-btn" onClick={fit} title="Fit to screen"><Icon name="fit" /></button>
        <span className="sep" />
        <button className={`btn ghost ${simOn ? 'active' : ''}`} onClick={() => setSimOn((s) => !s)} title="Check conditions against live device states"><Icon name="play" size={15} /> Test</button>
        <button className={`btn ghost ${preview ? 'active' : ''}`} onClick={() => setPreview((p) => !p)}><Icon name="eye" size={15} /> Preview</button>
        <button className="btn ghost" onClick={runNow} disabled={!flow.id || dirty || !flow.deployed} title="Trigger in Home Assistant now"><Icon name="bolt" size={15} /> Run</button>
        <button className="btn primary" onClick={save} disabled={saving}><Icon name="save" size={15} /> {saving ? 'Deploying…' : dirty || !flow.deployed ? 'Save & deploy' : 'Deployed'}</button>
      </header>

      <div className="status-bar">
        <span className={`pill ${issues ? 'bad' : 'good'}`}><Icon name={issues ? 'warn' : 'check'} size={13} /> {compiled.pending ? 'Checking…' : issues ? `${issues} issue${issues > 1 ? 's' : ''} to fix` : 'Ready to deploy'}</span>
        {globalErrors.map((e, i) => <span key={i} className="pill bad">{e.message}</span>)}
        {sim && <span className={`pill ${sim.wouldRun ? 'good' : 'bad'}`}>{sim.wouldRun ? 'Conditions pass right now — would run' : 'A condition blocks the flow right now'}</span>}
        {dirty && <span className="pill neutral">Unsaved changes</span>}
      </div>

      <div className="viewport" ref={vpRef} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp}>
        <div className="grid-bg" style={{ backgroundPosition: `${view.x}px ${view.y}px`, backgroundSize: `${32 * view.k}px ${32 * view.k}px` }} />
        <div className="world" ref={worldRef} style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.k})` }}>
          <svg className="wires" width="100%" height="100%" overflow="visible">
            {wires.map((w) => (
              <g key={w.key} className={`wire tone-${KINDS[w.tone].color}`}>
                <path d={w.d} className="wire-glow" />
                <path d={w.d} className="wire-flow" />
              </g>
            ))}
          </svg>
          {LANES.map((l) => {
            const k = KINDS[l.kind];
            return (
              <section key={l.id} className={`lane tone-${k.color}`} data-lane={l.id}>
                <div className="hub glass" data-hub={l.id}>
                  <span className="hub-title">{l.title}</span>
                  <span className="hub-sub">{l.sub}</span>
                  <span className="hub-count">{flow[l.id].length}</span>
                </div>
                <CardList list={flow[l.id]} listPath={[l.id]} kind={l.kind} ed={ed} />
              </section>
            );
          })}
        </div>
        {hint && (
          <div className="onboard glass">
            <Icon name="sparkle" size={22} />
            <div><b>Build your flow in three steps</b>
              <p>Pick a <span className="t-cyan">WHEN</span> trigger, optionally add <span className="t-amber">AND</span> conditions, then choose what should happen <span className="t-violet">THEN</span>. Pinch or Ctrl+scroll to zoom, drag the background to pan.</p></div>
          </div>
        )}
      </div>

      {preview && (
        <aside className="drawer glass">
          <div className="modal-head"><h3>Home Assistant automation</h3><button className="icon-btn" onClick={() => setPreview(false)}><Icon name="close" /></button></div>
          {compiled.automation ? <pre className="yaml">{toYaml(compiled.automation)}</pre> : <div className="empty">Nothing to show yet.</div>}
          {compiled.errors.length > 0 && <ul className="err-list">{compiled.errors.map((e, i) => <li key={i}>{e.message}</li>)}</ul>}
          <button className="btn ghost" onClick={() => navigator.clipboard?.writeText(toYaml(compiled.automation || {})).then(() => toast('ok', 'YAML copied'))}><Icon name="copy" size={15} /> Copy YAML</button>
        </aside>
      )}

      {picker && <CardPicker kind={picker.kind} onPick={addFromPicker} onClose={() => setPicker(null)} />}
    </div>
  );
}
