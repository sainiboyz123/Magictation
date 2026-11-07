import { CARDS } from './catalog.js';

export const uid = () => Math.random().toString(36).slice(2, 9);

export function newCard(type) {
  const def = CARDS[type];
  return {
    id: uid(),
    type,
    params: structuredClone(def.defaults || {}),
    slots: def.slots ? Object.fromEntries(def.slots.map((s) => [s.name, []])) : undefined,
  };
}

export function newFlow(name = 'New flow') {
  return { id: undefined, name, description: '', mode: 'single', enabled: true, folder: '', when: [], and: [], then: [] };
}

// A "list path" addresses an array of cards: ['then'] or ['then', cardId, 'else'] (card id, slot name pairs).
export function getList(flow, lp) {
  let cur = flow[lp[0]];
  for (let i = 1; i < lp.length; i += 2) {
    const card = cur.find((c) => c.id === lp[i]);
    if (!card) return null;
    card.slots = card.slots || {};
    cur = card.slots[lp[i + 1]] = card.slots[lp[i + 1]] || [];
  }
  return cur;
}

function* allLists(flow) {
  function* walk(list) {
    yield list;
    for (const c of list) for (const s of Object.values(c.slots || {})) yield* walk(s);
  }
  for (const k of ['when', 'and', 'then']) yield* walk(flow[k] || []);
}

export function locate(flow, id) {
  for (const list of allLists(flow)) {
    const idx = list.findIndex((c) => c.id === id);
    if (idx >= 0) return { list, idx, card: list[idx] };
  }
  return null;
}

export function findCard(flow, id) { return locate(flow, id)?.card || null; }

const edit = (flow, fn) => { const next = structuredClone(flow); fn(next); return next; };

export const addCard = (flow, lp, card) => edit(flow, (f) => { getList(f, lp)?.push(card); });
export const updateParams = (flow, id, patch) => edit(flow, (f) => { const l = locate(f, id); if (l) l.card.params = { ...l.card.params, ...patch }; });
export const removeCard = (flow, id) => edit(flow, (f) => { const l = locate(f, id); if (l) l.list.splice(l.idx, 1); });
export const moveCard = (flow, id, dir) => edit(flow, (f) => {
  const l = locate(f, id);
  if (!l) return;
  const j = l.idx + dir;
  if (j < 0 || j >= l.list.length) return;
  [l.list[l.idx], l.list[j]] = [l.list[j], l.list[l.idx]];
});

function reId(card) {
  card.id = uid();
  for (const s of Object.values(card.slots || {})) s.forEach(reId);
  return card;
}
export const duplicateCard = (flow, id) => edit(flow, (f) => {
  const l = locate(f, id);
  if (l) l.list.splice(l.idx + 1, 0, reId(structuredClone(l.card)));
});

export function countCards(flow) {
  let n = 0;
  for (const list of allLists(flow)) n += list.length;
  return n;
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
  if (typeof x === 'string') return /^[\w.\-/:+]+$/.test(x) && !/^(true|false|null|\d+(\.\d+)?)$/i.test(x) ? x : JSON.stringify(x);
  return String(x);
}
