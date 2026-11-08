import React, { useMemo, useState } from 'react';
import Icon from './Icon.jsx';
import { cardText, kindOf } from './catalog.js';
import { deviceTiles } from './catalog.js';
import { newFlow, newNode, uid } from './graph.js';

// cards: [[key, preset, col, row]], wires: [[fromKey, port, toKey]]
function build(name, cards, wires) {
  const f = newFlow(name);
  const ids = {};
  for (const [key, preset, col, row] of cards) {
    const n = newNode(preset, 48 + col * 352, 48 + row * 144);
    ids[key] = n.id;
    f.nodes.push(n);
  }
  f.edges = wires.map(([a, port, b]) => ({ id: uid(), from: ids[a], port, to: ids[b] }));
  return f;
}

const TEMPLATES = [
  { title: 'Motion lights', icon: 'bulb', desc: 'Motion after dark turns a light on, then off again two minutes later.',
    make: () => build('Motion lights', [
      ['t', { type: 'trigger.state', text: '{entity} detects motion', params: { to: 'on' }, fields: ['entity', 'forSeconds'] }, 0, 0],
      ['c', { type: 'cond.state', app: 'datetime', text: 'It is dark outside', params: { entity: ['sun.sun'], state: 'below_horizon' }, fields: [] }, 1, 0],
      ['on', { type: 'action.turn_on' }, 2, 0],
      ['w', { type: 'action.delay', app: 'flow', text: 'Wait {seconds}', params: { seconds: 120 } }, 3, 0],
      ['off', { type: 'action.turn_off' }, 4, 0],
    ], [['t', 'out', 'c'], ['c', 'yes', 'on'], ['on', 'out', 'w'], ['w', 'out', 'off']]) },
  { title: 'Good morning', icon: 'sun', desc: 'At 7:00 on weekdays turn things on; at weekends just send a message.',
    make: () => build('Good morning', [
      ['t', { type: 'trigger.time', app: 'datetime', text: 'Every day at {at}', params: { at: '07:00' } }, 0, 0],
      ['c', { type: 'cond.time', app: 'datetime', text: 'Today is {weekdays}', params: { weekdays: ['mon', 'tue', 'wed', 'thu', 'fri'] }, fields: ['weekdays'] }, 1, 0],
      ['on', { type: 'action.turn_on' }, 2, 0],
      ['n', { type: 'action.notify', app: 'notify', text: 'Send “{message}”', params: { message: 'Enjoy your weekend!' } }, 2, 1],
    ], [['t', 'out', 'c'], ['c', 'yes', 'on'], ['c', 'no', 'n']]) },
  { title: 'Welcome home', icon: 'pin', desc: 'When someone arrives home, light things up.',
    make: () => build('Welcome home', [
      ['t', { type: 'trigger.zone', app: 'presence', text: '{entity} arrives at {zone}', params: { event: 'enter' }, fields: ['entity', 'zone'] }, 0, 0],
      ['l', { type: 'action.light', params: { brightness: 70 } }, 1, 0],
    ], [['t', 'out', 'l']]) },
  { title: 'Too hot alert', icon: 'thermo', desc: 'Notify when a temperature stays high for five minutes.',
    make: () => build('Too hot alert', [
      ['t', { type: 'trigger.numeric', text: '{entity} goes above {above}', params: { above: 28, forSeconds: 300 }, fields: ['entity', 'above', 'forSeconds'] }, 0, 0],
      ['n', { type: 'action.notify', app: 'notify', text: 'Send “{message}”', params: { message: 'It is getting hot!' } }, 1, 0],
    ], [['t', 'out', 'n']]) },
];

export default function FlowList({ flows, meta, live, onOpen, onCreate, onToggle, onRun, onDelete }) {
  const [q, setQ] = useState('');
  const shown = useMemo(() => flows.filter((f) => f.name.toLowerCase().includes(q.toLowerCase())), [flows, q]);
  const ctx = useMemo(() => {
    const ents = Object.fromEntries(meta.entities.map((e) => [e.entity_id, e]));
    const tiles = Object.fromEntries(deviceTiles(meta, { showAll: true }).map((t) => [t.id, t]));
    return { name: (id) => ents[id]?.name || id, tile: (id) => tiles[id] };
  }, [meta]);

  return (
    <div className="list-page">
      <section className="hero">
        <div>
          <h1><span className="logo-spark"><Icon name="sparkle" size={26} /></span> Magictation</h1>
          <p>Build flows by placing cards and drawing lines between them. Every flow becomes a normal Home Assistant automation.</p>
        </div>
        <button className="btn primary big" onClick={() => onCreate(newFlow('New flow'))}><Icon name="plus" /> New flow</button>
      </section>

      <section>
        <h2 className="sec">Quick start</h2>
        <div className="tpl-grid">
          {TEMPLATES.map((t) => (
            <button key={t.title} className="tpl" onClick={() => onCreate(t.make())}>
              <span className="tile-ico"><Icon name={t.icon} size={22} /></span>
              <b>{t.title}</b><small>{t.desc}</small>
            </button>
          ))}
        </div>
      </section>

      <section>
        <div className="sec-row">
          <h2 className="sec">Your flows <span className="count">{flows.length}</span></h2>
          <div className="search small"><Icon name="search" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search flows" /></div>
        </div>
        {shown.length === 0 && <div className="empty glass">{flows.length ? 'No flows match your search.' : 'No flows yet. Start from a template above or create a new flow.'}</div>}
        <div className="flow-grid">
          {shown.map((f) => {
            const nodes = f.nodes || [];
            const first = nodes.find((n) => kindOf(n.type) === 'trigger');
            const dev = first?.device && ctx.tile(first.device);
            const sum = first ? `${dev ? `${dev.name}: ` : ''}${cardText(first, ctx)}` : 'No When card yet';
            const active = f.deployed && f.enabled !== false;
            return (
              <article key={f.id} className={`flow-card glass ${active ? 'on' : ''}`}>
                <button className="flow-main" onClick={() => onOpen(f)}>
                  <span className="flow-title">{f.name}</span>
                  <span className="flow-sum"><Icon name="bolt" size={13} /> {sum}</span>
                  <span className="flow-meta">
                    <span className={`pill ${f.deployed ? 'good' : 'bad'}`}>{f.deployed ? 'Deployed' : 'Draft'}</span>
                    <span className="pill neutral">{nodes.length} card{nodes.length === 1 ? '' : 's'}</span>
                  </span>
                </button>
                <div className="flow-actions">
                  <label className="switch" title={f.enabled !== false ? 'Enabled' : 'Disabled'}>
                    <input type="checkbox" checked={f.enabled !== false} onChange={(e) => onToggle(f, e.target.checked)} aria-label={`Enable ${f.name}`} />
                    <span />
                  </label>
                  <button className="icon-btn" title="Run now" disabled={!f.deployed} onClick={() => onRun(f)}><Icon name="play" /></button>
                  <button className="icon-btn danger" title="Delete" onClick={() => onDelete(f)}><Icon name="trash" /></button>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}
