import React, { useEffect, useMemo, useRef, useState } from 'react';
import Icon from './Icon.jsx';
import { CARDS, KINDS, asList, domainIcon, stateSuggestions } from './catalog.js';

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

// Choose one or many devices, grouped by location (area).
export function EntityPicker({ meta, domains, multi, value, onChange, onClose }) {
  const [q, setQ] = useState('');
  const [domain, setDomain] = useState('');
  const [sel, setSel] = useState(asList(value));
  const inputRef = useRef();
  useEffect(() => inputRef.current?.focus(), []);

  const pool = useMemo(() => meta.entities.filter((e) => !domains || domains.includes(e.domain)), [meta, domains]);
  const domainList = useMemo(() => [...new Set(pool.map((e) => e.domain))].sort(), [pool]);
  const groups = useMemo(() => {
    const ql = q.trim().toLowerCase();
    const filtered = pool.filter((e) => (!domain || e.domain === domain)
      && (!ql || e.name.toLowerCase().includes(ql) || e.entity_id.includes(ql) || (e.area || '').toLowerCase().includes(ql)));
    const by = {};
    filtered.forEach((e) => { (by[e.area || 'No location'] = by[e.area || 'No location'] || []).push(e); });
    return Object.entries(by).sort(([a], [b]) => (a === 'No location') - (b === 'No location') || a.localeCompare(b));
  }, [pool, q, domain]);

  const toggle = (id) => {
    if (!multi) { onChange(id); onClose(); return; }
    setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  };

  return (
    <Modal title={multi ? 'Choose devices' : 'Choose a device'} onClose={onClose} wide
      footer={multi && <button className="btn primary" onClick={() => { onChange(sel); onClose(); }}>Done ({sel.length})</button>}>
      <div className="search"><Icon name="search" /><input ref={inputRef} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search devices, rooms, ids…" /></div>
      <div className="chips">
        <button className={`chip ${!domain ? 'on' : ''}`} onClick={() => setDomain('')}>All</button>
        {domainList.map((d) => <button key={d} className={`chip ${domain === d ? 'on' : ''}`} onClick={() => setDomain(d)}><Icon name={domainIcon(d)} size={13} /> {d}</button>)}
      </div>
      <div className="entity-groups">
        {groups.length === 0 && <div className="empty">No matching devices.</div>}
        {groups.map(([area, list]) => (
          <section key={area}>
            <h4><Icon name="home" size={14} /> {area}</h4>
            <div className="entity-grid">
              {list.map((e) => (
                <button key={e.entity_id} className={`entity ${sel.includes(e.entity_id) || (!multi && asList(value).includes(e.entity_id)) ? 'picked' : ''}`} onClick={() => toggle(e.entity_id)}>
                  <Icon name={domainIcon(e.domain)} />
                  <span className="e-name">{e.name}<small>{e.entity_id}</small></span>
                  <span className={`e-state s-${e.state}`}>{e.state}{e.attrs?.unit ? ` ${e.attrs.unit}` : ''}</span>
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>
    </Modal>
  );
}

// Pick a card type (trigger/condition/action) by browsing or searching.
export function CardPicker({ kind, onPick, onClose }) {
  const [q, setQ] = useState('');
  const ref = useRef();
  useEffect(() => ref.current?.focus(), []);
  const k = KINDS[kind];
  const items = Object.entries(CARDS).filter(([, d]) => d.kind === kind
    && (!q || `${d.label} ${d.desc}`.toLowerCase().includes(q.toLowerCase())));
  return (
    <Modal title={`Add a ${k.label} card`} onClose={onClose} wide>
      <div className="search"><Icon name="search" /><input ref={ref} value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Search ${k.label.toLowerCase()} cards…`}
        onKeyDown={(e) => e.key === 'Enter' && items[0] && (onPick(items[0][0]), onClose())} /></div>
      <div className="tile-grid">
        {items.map(([type, d]) => (
          <button key={type} className={`tile tone-${k.color}`} onClick={() => { onPick(type); onClose(); }}>
            <span className="tile-ico"><Icon name={d.icon} size={22} /></span>
            <span className="tile-t">{d.label}</span>
            <span className="tile-d">{d.desc}</span>
          </button>
        ))}
        {items.length === 0 && <div className="empty">Nothing matches “{q}”.</div>}
      </div>
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
