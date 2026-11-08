// Pure operations on a graph flow: { nodes: [{id,type,params,x,y,...}], edges: [{id,from,port,to}] }.
import { CARDS, PORTS, kindOf } from './catalog.js';

export const uid = () => Math.random().toString(36).slice(2, 9);
export const NODE_W = 264;
export const NODE_H = 96;
export const GRID = 16;
export const snap = (v) => Math.round(v / GRID) * GRID;

export function newFlow(name = 'New flow') {
  return { id: undefined, name, description: '', mode: 'single', enabled: true, folder: '', version: 2, nodes: [], edges: [] };
}

// preset: { type, text?, params?, fields?, device?, app?, unit? }
export function newNode(preset, x = 0, y = 0) {
  const def = CARDS[preset.type];
  const node = { id: uid(), type: preset.type, params: { ...structuredClone(def.defaults || {}), ...structuredClone(preset.params || {}) }, x: snap(x), y: snap(y) };
  for (const k of ['text', 'fields', 'device', 'app', 'unit']) if (preset[k] !== undefined) node[k] = structuredClone(preset[k]);
  return node;
}

// Port anchor positions in world coordinates.
export function portPos(node, port) {
  if (port === 'in') return { x: node.x, y: node.y + NODE_H / 2 };
  const y = port === 'yes' ? NODE_H * 0.32 : port === 'no' ? NODE_H * 0.72 : NODE_H / 2;
  return { x: node.x + NODE_W, y: node.y + y };
}

export const wirePath = (a, b) => {
  const dx = Math.max(40, Math.abs(b.x - a.x) / 2);
  return `M${a.x},${a.y} C${a.x + dx},${a.y} ${b.x - dx},${b.y} ${b.x},${b.y}`;
};

const edit = (flow, fn) => { const next = structuredClone(flow); fn(next); return next; };
const byId = (flow, id) => flow.nodes.find((n) => n.id === id);

export const addNode = (flow, node) => edit(flow, (f) => { f.nodes.push(node); });
export const updateParams = (flow, id, patch) => edit(flow, (f) => { const n = byId(f, id); if (n) n.params = { ...n.params, ...patch }; });
export const moveNodes = (flow, ids, dx, dy, doSnap = false) => edit(flow, (f) => {
  for (const n of f.nodes) if (ids.includes(n.id)) { n.x += dx; n.y += dy; if (doSnap) { n.x = snap(n.x); n.y = snap(n.y); } }
});

function reaches(flow, from, target) {
  const seen = new Set();
  const stack = [from];
  while (stack.length) {
    const id = stack.pop();
    if (id === target) return true;
    if (seen.has(id)) continue;
    seen.add(id);
    flow.edges.filter((e) => e.from === id).forEach((e) => stack.push(e.to));
  }
  return false;
}

// Returns null if the wire is allowed, otherwise a human reason.
export function connectProblem(flow, from, port, to) {
  const a = byId(flow, from), b = byId(flow, to);
  if (!a || !b) return 'Card not found';
  if (from === to) return 'A card cannot connect to itself';
  if (!PORTS[kindOf(a.type)]?.outputs.includes(port)) return 'That output does not exist';
  if (!PORTS[kindOf(b.type)]?.input) return 'When cards start a flow, so nothing can connect into them';
  if (flow.edges.some((e) => e.from === from && e.port === port && e.to === to)) return 'These cards are already connected';
  if (reaches(flow, to, from)) return 'That would make the flow loop back on itself';
  return null;
}

export const connect = (flow, from, port, to) => (connectProblem(flow, from, port, to)
  ? flow
  : edit(flow, (f) => { f.edges.push({ id: uid(), from, port, to }); }));

export const removeEdge = (flow, id) => edit(flow, (f) => { f.edges = f.edges.filter((e) => e.id !== id); });
export const removeNodes = (flow, ids) => edit(flow, (f) => {
  f.nodes = f.nodes.filter((n) => !ids.includes(n.id));
  f.edges = f.edges.filter((e) => !ids.includes(e.from) && !ids.includes(e.to));
});

// Copies nodes (and wires between them) offset by one grid step. Returns { flow, ids }.
export function duplicateNodes(flow, ids) {
  const map = {};
  const next = edit(flow, (f) => {
    for (const n of flow.nodes.filter((x) => ids.includes(x.id))) {
      const c = { ...structuredClone(n), id: uid(), x: n.x + GRID * 2, y: n.y + GRID * 2 };
      map[n.id] = c.id;
      f.nodes.push(c);
    }
    for (const e of flow.edges) if (map[e.from] && map[e.to]) f.edges.push({ id: uid(), from: map[e.from], port: e.port, to: map[e.to] });
  });
  return { flow: next, ids: Object.values(map) };
}

// Swap a card for another one in place, keeping its position and any wires that still fit.
export function replaceNode(flow, id, preset) {
  return edit(flow, (f) => {
    const i = f.nodes.findIndex((n) => n.id === id);
    if (i < 0) return;
    const old = f.nodes[i];
    const n = { ...newNode(preset, old.x, old.y), id, x: old.x, y: old.y };
    f.nodes[i] = n;
    const ports = PORTS[kindOf(n.type)];
    f.edges = f.edges.filter((e) => (e.to !== id || ports.input) && (e.from !== id || ports.outputs.includes(e.port)));
  });
}

// A free spot near (x, y) that does not overlap other cards.
export function freeSpot(flow, x, y) {
  let px = snap(x), py = snap(y);
  for (let i = 0; i < 40; i++) {
    const hit = flow.nodes.some((n) => Math.abs(n.x - px) < NODE_W && Math.abs(n.y - py) < NODE_H + 8);
    if (!hit) break;
    py += NODE_H + 24;
  }
  return { x: px, y: py };
}

export function bounds(flow) {
  if (!flow.nodes.length) return null;
  const xs = flow.nodes.map((n) => n.x), ys = flow.nodes.map((n) => n.y);
  return { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs) + NODE_W, h: Math.max(...ys) - Math.min(...ys) + NODE_H };
}

// Minimal YAML serializer for the automation preview.
export function toYaml(v, indent = 0) {
  const pad = '  '.repeat(indent);
  if (Array.isArray(v)) {
    if (!v.length) return '[]';
    return v.map((x) => {
      if (x && typeof x === 'object') {
        const inner = toYaml(x, indent + 1).split('\n');
        inner[0] = inner[0].trimStart();
        return `${pad}- ${inner.join('\n')}`;
      }
      return `${pad}- ${scalar(x)}`;
    }).join('\n');
  }
  if (v && typeof v === 'object') {
    return Object.entries(v).map(([k, x]) => {
      if (x && typeof x === 'object' && (Array.isArray(x) ? x.length : Object.keys(x).length)) return `${pad}${k}:\n${toYaml(x, indent + 1)}`;
      return `${pad}${k}: ${x && typeof x === 'object' ? (Array.isArray(x) ? '[]' : '{}') : scalar(x)}`;
    }).join('\n');
  }
  return pad + scalar(v);
}
function scalar(x) {
  if (typeof x === 'string') return /^[\w.\-/:+]+$/.test(x) && !/^(true|false|null|on|off|yes|no|y|n|\d+(\.\d+)?)$/i.test(x) ? x : JSON.stringify(x);
  return String(x);
}
