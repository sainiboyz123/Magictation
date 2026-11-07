import React, { useMemo, useState } from 'react';
import Icon from './Icon.jsx';
import { CARDS } from './catalog.js';
import { newCard, newFlow, addCard } from './flowOps.js';

function build(name, steps) {
  let f = newFlow(name);
  for (const [list, type, params] of steps) {
    const c = newCard(type);
    c.params = { ...c.params, ...params };
    f = addCard(f, [list], c);
  }
  return f;
}

const TEMPLATES = [
  { title: 'Motion lights', icon: 'bulb', desc: 'Turn a light on when motion is detected after dark, off again later.',
    make: () => build('Motion lights', [['when', 'trigger.state', { to: 'on' }], ['and', 'cond.sun', { after: 'sunset', before: '' }], ['then', 'action.turn_on', {}], ['then', 'action.delay', { seconds: 120 }], ['then', 'action.turn_off', {}]]) },
  { title: 'Good morning', icon: 'sun', desc: 'At a set time on weekdays, switch things on and send a notification.',
    make: () => build('Good morning', [['when', 'trigger.time', { at: '07:00' }], ['and', 'cond.time', { weekdays: ['mon', 'tue', 'wed', 'thu', 'fri'], after: '', before: '' }], ['then', 'action.turn_on', {}], ['then', 'action.notify', { message: 'Good morning!' }]]) },
  { title: 'Welcome home', icon: 'pin', desc: 'When someone arrives home, light things up.',
    make: () => build('Welcome home', [['when', 'trigger.zone', { zone: 'zone.home', event: 'enter' }], ['then', 'action.light', { brightness: 70 }]]) },
  { title: 'Too hot alert', icon: 'thermo', desc: 'Notify when a temperature stays high for a while.',
    make: () => build('Too hot alert', [['when', 'trigger.numeric', { above: 28, forSeconds: 300 }], ['then', 'action.notify', { message: 'It is getting hot!' }]]) },
];

export default function FlowList({ flows, meta, live, onOpen, onCreate, onToggle, onRun, onDelete }) {
  const [q, setQ] = useState('');
  const shown = useMemo(() => flows.filter((f) => f.name.toLowerCase().includes(q.toLowerCase())), [flows, q]);
  const nameOf = (id) => meta.entities.find((e) => e.entity_id === id)?.name || id;

  return (
    <div className="list-page">
      <section className="hero">
        <div>
          <h1><span className="logo-spark"><Icon name="sparkle" size={26} /></span> Magictation</h1>
          <p>Build smart-home flows visually. Pick a trigger, add logic, choose what happens — it deploys as a native Home Assistant automation.</p>
        </div>
        <button className="btn primary big" onClick={() => onCreate(newFlow('New flow'))}><Icon name="plus" /> New flow</button>
      </section>

      <section>
        <h2 className="sec">Quick start</h2>
        <div className="tpl-grid">
          {TEMPLATES.map((t) => (
            <button key={t.title} className="tpl glass" onClick={() => onCreate(t.make())}>
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
            const first = f.when[0];
            const sum = first ? CARDS[first.type]?.summary(first.params || {}, { name: nameOf }, first) : 'No trigger yet';
            const active = f.deployed && f.enabled !== false;
            return (
              <article key={f.id} className={`flow-card glass ${active ? 'on' : ''}`}>
                <button className="flow-main" onClick={() => onOpen(f)}>
                  <span className="flow-title">{f.name}</span>
                  <span className="flow-sum"><Icon name="bolt" size={13} /> {sum}</span>
                  <span className="flow-meta">
                    <span className={`pill ${f.deployed ? 'good' : 'bad'}`}>{f.deployed ? 'Deployed' : 'Draft'}</span>
                    <span className="pill neutral">{f.when.length} when · {f.and.length} and · {f.then.length} then</span>
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
