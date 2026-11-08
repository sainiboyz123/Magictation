import React, { useEffect, useMemo, useRef, useState } from 'react';
import Icon from './Icon.jsx';
import { APPS, CARDS, KINDS, appCards, deviceCards, deviceTiles } from './catalog.js';
import { Modal, groupByArea } from './Pickers.jsx';

// Two steps, like Homey: pick a device or app, then pick what it should do.
export default function AddCardSheet({ meta, kind: initialKind, kinds = ['trigger', 'condition', 'action'], onPick, onClose, title }) {
  const [kind, setKind] = useState(kinds.includes(initialKind) ? initialKind : kinds[0]);
  const [source, setSource] = useState(null); // { tile } or { app }
  const [q, setQ] = useState('');
  const [showAll, setShowAll] = useState(false);
  const ref = useRef();
  useEffect(() => { ref.current?.focus(); }, [source]);

  const tiles = useMemo(() => deviceTiles(meta, { showAll }), [meta, showAll]);
  const ql = q.trim().toLowerCase();
  const apps = APPS.filter((a) => appCards(a, kind).length && (!ql || a.name.toLowerCase().includes(ql)));
  const devices = tiles.filter((t) => deviceCards(t, kind).length
    && (!ql || t.name.toLowerCase().includes(ql) || (t.area || '').toLowerCase().includes(ql)));
  const cards = source ? (source.tile ? deviceCards(source.tile, kind) : appCards(source.app, kind)) : [];
  const shownCards = cards.filter((c) => !ql || (c.text || '').toLowerCase().includes(ql));

  const pick = (preset) => { onPick(preset); onClose(); };
  const k = KINDS[kind];

  return (
    <Modal title={title || (source ? (source.tile?.name || source.app.name) : `Add a card`)} onClose={onClose} wide>
      {kinds.length > 1 && (
        <div className="seg" role="tablist">
          {kinds.map((x) => (
            <button key={x} role="tab" aria-selected={x === kind} className={`seg-btn k-${KINDS[x].tone} ${x === kind ? 'on' : ''}`}
              onClick={() => { setKind(x); }}>
              <b>{KINDS[x].label}</b><span>{KINDS[x].hint}</span>
            </button>
          ))}
        </div>
      )}
      <div className="sheet-nav">
        {source && <button className="btn ghost" onClick={() => { setSource(null); setQ(''); }}><Icon name="back" /> Back</button>}
        <div className="search"><Icon name="search" />
          <input ref={ref} value={q} onChange={(e) => setQ(e.target.value)} placeholder={source ? 'Search cards' : 'Search devices, rooms and apps'}
            onKeyDown={(e) => { if (e.key === 'Enter' && source && shownCards[0]) pick(shownCards[0]); }} />
        </div>
      </div>

      {!source && (
        <div className="entity-groups">
          {apps.length > 0 && (
            <section>
              <h4>Apps</h4>
              <div className="tile-grid">
                {apps.map((a) => (
                  <button key={a.id} className="dtile app" onClick={() => { setSource({ app: a }); setQ(''); }}>
                    <span className="dtile-ico"><Icon name={a.icon} size={22} /></span>
                    <span className="dtile-text"><b>{a.name}</b><span>{appCards(a, kind).length} cards</span></span>
                  </button>
                ))}
              </div>
            </section>
          )}
          {groupByArea(devices).map(([area, list]) => (
            <section key={area}>
              <h4>{area}</h4>
              <div className="tile-grid">
                {list.map((t) => (
                  <button key={t.id} className="dtile" onClick={() => { setSource({ tile: t }); setQ(''); }}>
                    <span className="dtile-ico"><Icon name={t.icon} size={22} /></span>
                    <span className="dtile-text"><b>{t.name}</b><span>{t.area || 'No room'}</span></span>
                  </button>
                ))}
              </div>
            </section>
          ))}
          {!apps.length && !devices.length && <div className="empty">Nothing matches “{q}”.</div>}
          <label className="check"><input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} /> Show hidden and diagnostic entities</label>
        </div>
      )}

      {source && (
        <div className="card-rows">
          {shownCards.map((c, i) => (
            <button key={i} className={`card-row k-${k.tone}`} onClick={() => pick(c)}>
              <span className="card-row-ico"><Icon name={CARDS[c.type].icon} size={20} /></span>
              <span className="card-row-text">{(c.text || CARDS[c.type].label).replace(/\{\w+\}/g, '…')}</span>
              <Icon name="plus" size={18} />
            </button>
          ))}
          {shownCards.length === 0 && <div className="empty">This has no {k.label} cards.</div>}
        </div>
      )}
    </Modal>
  );
}
