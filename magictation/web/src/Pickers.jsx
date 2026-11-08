import React, { useEffect, useMemo, useRef, useState } from 'react';
import Icon from './Icon.jsx';
import { asList, domainIcon, stateSuggestions } from './catalog.js';

export function Modal({ title, onClose, children, wide, footer }) {
  useEffect(() => {
    const h = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);
  return (
    <div className="modal-back" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal glass ${wide ? 'wide' : ''}`} role="dialog" aria-label={title}>
        <div className="modal-head">
          <h3>{title}</h3>
          <button className="icon-btn" onClick={onClose} aria-label="Close"><Icon name="close" /></button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

export const groupByArea = (items) => {
  const by = {};
  items.forEach((x) => { (by[x.area || 'Other'] = by[x.area || 'Other'] || []).push(x); });
  return Object.entries(by).sort(([a], [b]) => (a === 'Other') - (b === 'Other') || a.localeCompare(b));
};

const prettyState = (e) => `${String(e.state).replace(/_/g, ' ')}${e.attrs?.unit ? ` ${e.attrs.unit}` : ''}`;

// Choose one or many entities, grouped by room. Diagnostic and hidden entities are tucked away.
export function EntityPicker({ meta, domains, multi, value, onChange, onClose }) {
  const [q, setQ] = useState('');
  const [all, setAll] = useState(false);
  const [sel, setSel] = useState(asList(value));
  const inputRef = useRef();
  useEffect(() => inputRef.current?.focus(), []);

  const pool = useMemo(() => meta.entities.filter((e) => (domains ? domains.includes(e.domain) : !['automation', 'update'].includes(e.domain))
    && (all || domains || (!e.hidden && !e.entity_category))), [meta, domains, all]);
  const groups = useMemo(() => {
    const ql = q.trim().toLowerCase();
    return groupByArea(pool.filter((e) => !ql || e.name.toLowerCase().includes(ql) || (e.area || '').toLowerCase().includes(ql))
      .sort((a, b) => a.name.localeCompare(b.name)));
  }, [pool, q]);

  const toggle = (id) => {
    if (!multi) { onChange(id); onClose(); return; }
    setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  };

  return (
    <Modal title={multi ? 'Choose devices' : 'Choose a device'} onClose={onClose} wide
      footer={multi && <button className="btn primary" onClick={() => { onChange(sel); onClose(); }}>Done ({sel.length})</button>}>
      <div className="search"><Icon name="search" /><input ref={inputRef} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search devices or rooms" /></div>
      <div className="entity-groups">
        {groups.length === 0 && <div className="empty">No matching devices.</div>}
        {groups.map(([area, list]) => (
          <section key={area}>
            <h4>{area}</h4>
            <div className="tile-grid">
              {list.map((e) => (
                <button key={e.entity_id} className={`dtile ${sel.includes(e.entity_id) || (!multi && asList(value).includes(e.entity_id)) ? 'picked' : ''}`} onClick={() => toggle(e.entity_id)}>
                  <span className="dtile-ico"><Icon name={domainIcon(e.domain, e.attrs?.device_class)} size={22} /></span>
                  <span className="dtile-text"><b>{e.name}</b><span>{prettyState(e)}</span></span>
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>
      {!domains && <label className="check"><input type="checkbox" checked={all} onChange={(e) => setAll(e.target.checked)} /> Show hidden and diagnostic entities</label>}
    </Modal>
  );
}

const WEEKDAYS = [['mon', 'Mon'], ['tue', 'Tue'], ['wed', 'Wed'], ['thu', 'Thu'], ['fri', 'Fri'], ['sat', 'Sat'], ['sun', 'Sun']];

export function Field({ def, card, onChange, meta, ctx }) {
  const [picking, setPicking] = useState(false);
  const v = card.params[def.key];
  const set = (x) => onChange({ [def.key]: x });
  const label = <label>{def.label}{def.hint && <em> · {def.hint}</em>}</label>;

  switch (def.kind) {
    case 'entity': {
      const ids = asList(v);
      return (
        <div className="field">{label}
          <div className="entity-chips">
            {ids.map((id) => <span key={id} className="echip"><Icon name={domainIcon(id.split('.')[0])} size={13} />{ctx.name(id)}
              <button aria-label={`Remove ${id}`} onClick={() => set(def.multi ? ids.filter((x) => x !== id) : '')}><Icon name="close" size={11} /></button></span>)}
            <button className="btn ghost small" onClick={() => setPicking(true)}><Icon name="plus" size={14} /> {ids.length ? 'Change' : 'Choose'}</button>
          </div>
          {picking && <EntityPicker meta={meta} domains={def.domains} multi={def.multi} value={v} onChange={set} onClose={() => setPicking(false)} />}
        </div>
      );
    }
    case 'state': {
      const ent = meta.entities.find((e) => e.entity_id === asList(card.params[def.entityKey])[0]);
      const opts = stateSuggestions(ent);
      const listId = `dl-${card.id}-${def.key}`;
      return (
        <div className="field">{label}
          <input list={listId} value={v ?? ''} onChange={(e) => set(e.target.value)} placeholder={opts[0] || 'e.g. on'} />
          <datalist id={listId}>{opts.map((o) => <option key={o} value={o} />)}</datalist>
          {opts.length > 0 && <div className="quick">{opts.slice(0, 6).map((o) => <button key={o} className={`chip ${v === o ? 'on' : ''}`} onClick={() => set(o)}>{o}</button>)}</div>}
        </div>
      );
    }
    case 'select':
      return <div className="field">{label}<select value={v ?? ''} onChange={(e) => set(e.target.value)}>{def.options.map(([val, l]) => <option key={val} value={val}>{l}</option>)}</select></div>;
    case 'number':
      return <div className="field">{label}<input type="number" value={v ?? ''} onChange={(e) => set(e.target.value === '' ? '' : Number(e.target.value))} /></div>;
    case 'time':
      return <div className="field">{label}<input type="time" value={v ?? ''} onChange={(e) => set(e.target.value)} /></div>;
    case 'color':
      return <div className="field">{label}<div className="color-row"><input type="color" value={v || '#ffffff'} onChange={(e) => set(e.target.value)} />{v && <button className="btn ghost small" onClick={() => set('')}>Clear</button>}</div></div>;
    case 'textarea':
      return <div className="field">{label}<textarea rows={3} value={v ?? ''} placeholder={def.placeholder} onChange={(e) => set(e.target.value)} /></div>;
    case 'weekdays': {
      const days = asList(v);
      return <div className="field">{label}<div className="chips">{WEEKDAYS.map(([id, l]) => <button key={id} className={`chip ${days.includes(id) ? 'on' : ''}`} onClick={() => set(days.includes(id) ? days.filter((d) => d !== id) : [...days, id])}>{l}</button>)}</div></div>;
    }
    case 'service': {
      const id = `svc-${card.id}`;
      const list = (meta.services || []).filter((s) => !def.prefix || s.id.startsWith(def.prefix));
      const shown = def.prefix ? String(v ?? '').replace(def.prefix, '') : v;
      return (
        <div className="field">{label}
          <input list={id} value={shown ?? ''} placeholder={def.placeholder || 'notify (default) or mobile_app_phone'}
            onChange={(e) => set(e.target.value)} />
          <datalist id={id}>{list.map((s) => <option key={s.id} value={def.prefix ? s.id.slice(def.prefix.length) : s.id}>{s.name}</option>)}</datalist>
        </div>
      );
    }
    default:
      return <div className="field">{label}<input value={v ?? ''} placeholder={def.placeholder} onChange={(e) => set(e.target.value)} /></div>;
  }
}
