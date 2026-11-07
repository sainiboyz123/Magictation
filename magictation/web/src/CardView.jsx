import React from 'react';
import Icon from './Icon.jsx';
import { CARDS, KINDS, asList } from './catalog.js';
import { Field } from './Pickers.jsx';

const STATUS_LABEL = { pass: 'passes', fail: 'blocks', info: 'now', assumed: 'unchecked', skip: 'skipped' };

export default function CardView({ card, listPath, index, total, ed }) {
  const def = CARDS[card.type];
  if (!def) return <div className="card broken">Unknown card {card.type}</div>;
  const kind = KINDS[def.kind];
  const open = ed.selected === card.id;
  const err = ed.errorsById[card.id];
  const sim = ed.sim?.results[card.id];
  const ids = asList(card.params?.entity);
  const live = ids.some((id) => ['on', 'open', 'home', 'unlocked', 'playing', 'heat', 'cool'].includes(ed.getState(id)));

  return (
    <div className={`card tone-${kind.color} ${open ? 'open' : ''} ${err ? 'has-error' : ''} ${live ? 'live' : ''} ${sim ? `sim-${sim.status}` : ''}`}
      data-node={card.id}>
      <div className="card-head" onClick={() => ed.select(open ? null : card.id)} role="button" tabIndex={0}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), ed.select(open ? null : card.id))}>
        <span className="card-ico"><Icon name={def.icon} size={20} /></span>
        <span className="card-text">
          <b>{def.label}</b>
          <small>{def.summary(card.params || {}, ed.ctx, card)}</small>
        </span>
        {sim && <span className={`badge b-${sim.status}`} title={sim.note}>{STATUS_LABEL[sim.status]}</span>}
        {err && <span className="badge b-fail" title={err}><Icon name="warn" size={12} /></span>}
        <Icon name={open ? 'up' : 'down'} size={16} className="chev" />
      </div>

      {sim?.note && <div className="sim-note">{sim.note}</div>}

      {open && (
        <div className="card-body">
          {err && <div className="err">{err}</div>}
          {def.fields.map((f) => <Field key={f.key} def={f} card={card} meta={ed.meta} ctx={ed.ctx} onChange={(patch) => ed.patch(card.id, patch)} />)}
          <div className="card-tools">
            <button className="icon-btn" title="Move up" disabled={index === 0} onClick={() => ed.move(card.id, -1)}><Icon name="up" /></button>
            <button className="icon-btn" title="Move down" disabled={index === total - 1} onClick={() => ed.move(card.id, 1)}><Icon name="down" /></button>
            <button className="icon-btn" title="Duplicate" onClick={() => ed.duplicate(card.id)}><Icon name="copy" /></button>
            <button className="icon-btn danger" title="Delete" onClick={() => ed.remove(card.id)}><Icon name="trash" /></button>
          </div>
        </div>
      )}

      {def.slots && def.slots.map((s) => (
        <div key={s.name} className={`slot tone-${KINDS[s.kind].color}`}>
          <div className="slot-label">{s.label}</div>
          <CardList list={card.slots?.[s.name] || []} listPath={[...listPath, card.id, s.name]} kind={s.kind} ed={ed} nested />
        </div>
      ))}
    </div>
  );
}

export function CardList({ list, listPath, kind, ed, nested }) {
  return (
    <div className={`card-list ${nested ? 'nested' : ''}`}>
      {list.map((c, i) => <CardView key={c.id} card={c} listPath={listPath} index={i} total={list.length} ed={ed} />)}
      <button className={`add-btn tone-${KINDS[kind].color}`} onClick={() => ed.add(listPath, kind)} data-add={listPath.join('/')}>
        <Icon name="plus" size={15} /> Add {KINDS[kind].label.toLowerCase()} card
      </button>
    </div>
  );
}
