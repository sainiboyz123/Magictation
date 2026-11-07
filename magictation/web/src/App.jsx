import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Icon from './Icon.jsx';
import FlowList from './FlowList.jsx';
import Editor from './Editor.jsx';
import { api } from './api.js';
import { Modal } from './Pickers.jsx';

export default function App() {
  const [flows, setFlows] = useState([]);
  const [meta, setMeta] = useState(null);
  const [live, setLive] = useState({});
  const [editing, setEditing] = useState(null);
  const [toasts, setToasts] = useState([]);
  const [fatal, setFatal] = useState(null);
  const [palette, setPalette] = useState(false);
  const [actions, setActions] = useState([]);
  const tid = useRef(0);

  const toast = useCallback((tone, text) => {
    const id = ++tid.current;
    setToasts((t) => [...t, { id, tone, text }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4500);
  }, []);

  const load = useCallback(async () => {
    try {
      const [m, f] = await Promise.all([api.meta(), api.flows()]);
      setMeta(m); setFlows(f); setFatal(null);
    } catch (e) { setFatal(e.message); }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => api.stream(({ entity_id, state }) => setLive((l) => ({ ...l, [entity_id]: state }))), []);

  useEffect(() => {
    const h = (e) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setPalette((p) => !p); } };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);

  const upsert = useCallback((flow) => setFlows((fs) => (fs.some((f) => f.id === flow.id) ? fs.map((f) => (f.id === flow.id ? flow : f)) : [...fs, flow])), []);

  const toggle = async (f, enabled) => {
    try { const r = await api.setEnabled(f.id, enabled); upsert(r.flow); toast('ok', `${f.name} ${enabled ? 'enabled' : 'disabled'}`); } catch (e) { toast('err', e.message); }
  };
  const run = async (f) => { try { await api.run(f.id); toast('ok', `Triggered ${f.name}`); } catch (e) { toast('err', e.message); } };
  const del = async (f) => {
    if (!confirm(`Delete "${f.name}"? This also removes the automation from Home Assistant.`)) return;
    try { await api.remove(f.id); setFlows((fs) => fs.filter((x) => x.id !== f.id)); toast('ok', 'Flow deleted'); } catch (e) { toast('err', e.message); }
  };

  const globalActions = useMemo(() => [
    { id: 'new', label: 'New flow', icon: 'plus', run: () => setEditing({ flow: { name: 'New flow', mode: 'single', enabled: true, when: [], and: [], then: [] } }) },
    { id: 'home', label: 'Go to all flows', icon: 'grid', run: () => setEditing(null) },
    ...flows.map((f) => ({ id: `open-${f.id}`, label: `Open: ${f.name}`, icon: 'bolt', run: () => setEditing({ flow: f }) })),
  ], [flows]);

  if (fatal) {
    return <div className="center-screen"><div className="glass fatal"><Icon name="warn" size={28} /><h2>Can't reach Home Assistant</h2><p>{fatal}</p><button className="btn primary" onClick={load}>Try again</button></div></div>;
  }
  if (!meta) return <div className="center-screen"><div className="loader" /><p>Connecting to Home Assistant…</p></div>;

  return (
    <div className="app">
      <div className="aurora" aria-hidden="true" />
      {editing
        ? <Editor key={editing.flow.id || 'new'} initial={editing.flow} meta={meta} live={live} toast={toast} registerActions={setActions}
            onBack={() => setEditing(null)} onSaved={upsert} />
        : <FlowList flows={flows} meta={meta} live={live} onOpen={(f) => setEditing({ flow: f })} onCreate={(f) => setEditing({ flow: f })}
            onToggle={toggle} onRun={run} onDelete={del} />}
      <button className="kbd-hint" onClick={() => setPalette(true)} title="Command palette"><Icon name="search" size={14} /> Ctrl K</button>
      {palette && <Palette actions={[...actions, ...globalActions]} onClose={() => setPalette(false)} />}
      <div className="toasts" aria-live="polite">
        {toasts.map((t) => <div key={t.id} className={`toast glass t-${t.tone}`}><Icon name={t.tone === 'ok' ? 'check' : 'warn'} size={16} /> {t.text}</div>)}
      </div>
    </div>
  );
}

function Palette({ actions, onClose }) {
  const [q, setQ] = useState('');
  const [i, setI] = useState(0);
  const items = actions.filter((a) => a.label.toLowerCase().includes(q.toLowerCase()));
  const go = (a) => { onClose(); a?.run(); };
  return (
    <Modal title="Command palette" onClose={onClose}>
      <div className="search"><Icon name="search" />
        <input autoFocus value={q} onChange={(e) => { setQ(e.target.value); setI(0); }} placeholder="Type a command…"
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') { e.preventDefault(); setI((x) => Math.min(items.length - 1, x + 1)); }
            if (e.key === 'ArrowUp') { e.preventDefault(); setI((x) => Math.max(0, x - 1)); }
            if (e.key === 'Enter') go(items[i]);
          }} /></div>
      <div className="cmd-list">
        {items.map((a, idx) => <button key={a.id} className={`cmd ${idx === i ? 'sel' : ''}`} onMouseEnter={() => setI(idx)} onClick={() => go(a)}><Icon name={a.icon} size={16} /> {a.label}</button>)}
        {items.length === 0 && <div className="empty">No commands match.</div>}
      </div>
    </Modal>
  );
}
