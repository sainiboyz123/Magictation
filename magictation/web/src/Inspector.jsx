import React from 'react';
import Icon from './Icon.jsx';
import { CARDS, KINDS, asList, cardText, kindOf } from './catalog.js';
import { Field } from './Pickers.jsx';
import { nodeTitle } from './NodeCard.jsx';

// Side panel for editing the selected card.
export default function Inspector({ node, ctx, meta, error, warning, sim, onPatch, onReplace, onDuplicate, onDelete, onClose }) {
  const def = CARDS[node.type];
  const k = KINDS[kindOf(node.type)] || KINDS.action;
  const { name, icon } = nodeTitle(node, ctx);
  let fields = def?.fields || [];
  if (node.fields) fields = fields.filter((f) => node.fields.includes(f.key));
  else if (node.device) fields = fields.filter((f) => f.key !== 'entity');
  const entities = asList(node.params?.entity);

  return (
    <aside className={`inspector k-${k.tone}`} aria-label="Card settings">
      <div className="insp-head">
        <span className="insp-kind">{k.label}</span>
        <button className="icon-btn" onClick={onClose} aria-label="Close"><Icon name="close" /></button>
      </div>
      <div className="insp-title">
        <span className="insp-ico"><Icon name={icon} size={22} /></span>
        <div><b>{name}</b><span>{cardText(node, ctx)}</span></div>
      </div>
      {node.device && entities.length > 0 && (
        <div className="insp-note"><Icon name="link" size={14} /> Uses {entities.map(ctx.name).join(', ')}</div>
      )}
      {error && <div className="insp-err"><Icon name="warn" size={16} /> {error}</div>}
      {!error && warning && <div className="insp-warn"><Icon name="warn" size={16} /> {warning}</div>}
      {sim?.note && <div className="insp-note">Test: {sim.note}</div>}

      <div className="insp-fields">
        {fields.map((f) => (
          <Field key={f.key} def={f} card={node} meta={meta} ctx={ctx} onChange={(patch) => onPatch(node.id, patch)} />
        ))}
        {fields.length === 0 && <p className="muted">Nothing to set up for this card.</p>}
      </div>

      <div className="insp-actions">
        <button className="btn" onClick={onReplace}><Icon name="repeat" size={16} /> Change card</button>
        <button className="btn" onClick={onDuplicate}><Icon name="copy" size={16} /> Duplicate</button>
        <button className="btn danger" onClick={onDelete}><Icon name="trash" size={16} /> Delete</button>
      </div>
    </aside>
  );
}
