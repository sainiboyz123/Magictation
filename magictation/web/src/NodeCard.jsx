import React, { memo } from 'react';
import Icon from './Icon.jsx';
import { APPS, CARDS, KINDS, PORTS, asList, cardTokens, kindOf } from './catalog.js';
import { NODE_H, NODE_W, portPos } from './graph.js';

const ON = ['on', 'open', 'home', 'unlocked', 'playing', 'heat', 'cool'];
const SIM_LABEL = { start: 'start', run: 'runs', pass: 'yes', fail: 'no', assumed: 'yes?', skip: '' };

export function nodeTitle(node, ctx) {
  if (node.device) { const t = ctx.tile(node.device); if (t) return { name: t.name, icon: t.icon }; }
  if (node.app) { const a = APPS.find((x) => x.id === node.app); if (a) return { name: a.name, icon: a.icon }; }
  const def = CARDS[node.type];
  return { name: def?.label || 'Unknown card', icon: def?.icon || 'warn' };
}

function NodeCard({ node, ctx, selected, error, warning, sim, live, connecting, onNodeDown, onPortDown }) {
  const kind = kindOf(node.type);
  const k = KINDS[kind] || KINDS.action;
  const ports = PORTS[kind] || PORTS.action;
  const { name, icon } = nodeTitle(node, ctx);
  const isLive = asList(node.params?.entity).some((id) => ON.includes(live(id)));
  const cls = ['node', `k-${k.tone}`, selected && 'sel', error && 'has-error', !error && warning && 'has-warn',
    sim && `sim-${sim.status}`, connecting && ports.input && 'drop-ok'].filter(Boolean).join(' ');

  return (
    <div className={cls} data-node={node.id} style={{ transform: `translate(${node.x}px, ${node.y}px)`, width: NODE_W, height: NODE_H }}
      onPointerDown={(e) => onNodeDown(e, node)} title={error || warning || ''}>
      <div className="node-head">
        <Icon name={icon} size={16} />
        <span className="node-title">{name}</span>
        {isLive && <span className="live-dot" title="Currently on" />}
        {sim && SIM_LABEL[sim.status] && <span className={`sim-badge s-${sim.status}`} title={sim.note}>{SIM_LABEL[sim.status]}</span>}
        {error && <span className="err-badge" aria-label={error}><Icon name="warn" size={14} /></span>}
      </div>
      <div className="node-body">
        {cardTokens(node, ctx).map((t, i) => (t.text !== undefined
          ? <span key={i}>{t.text}</span>
          : <span key={i} className={`tok ${t.value === '…' ? 'empty' : ''}`}>{t.value}</span>))}
      </div>
      {ports.input && <span className="port in" data-port="in" style={{ top: NODE_H / 2 }} />}
      {ports.outputs.map((p) => (
        <span key={p} className={`port out p-${p}`} data-port={p} style={{ top: portPos({ x: 0, y: 0 }, p).y }}
          onPointerDown={(e) => onPortDown(e, node, p)} title={p === 'yes' ? 'Yes: drag to connect' : p === 'no' ? 'No: drag to connect' : 'Drag to connect'}>
          {p === 'yes' ? '✓' : p === 'no' ? '✕' : ''}
        </span>
      ))}
    </div>
  );
}

export default memo(NodeCard);
