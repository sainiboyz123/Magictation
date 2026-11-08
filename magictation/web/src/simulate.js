import { asList, kindOf } from './catalog.js';

const DAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const toMin = (t) => { const [h, m] = String(t).split(':'); return Number(h) * 60 + Number(m || 0); };

// Evaluates a condition card against live state: 'pass' | 'fail' | 'assumed'.
export function evalCondition(card, getState, now = new Date()) {
  const p = card.params || {};
  const ids = asList(p.entity);
  switch (card.type) {
    case 'cond.state': {
      if (!ids.length) return { status: 'assumed', note: 'no device picked' };
      const bad = ids.find((i) => String(getState(i)) !== String(p.state));
      return { status: bad ? 'fail' : 'pass', note: bad ? `now ${getState(bad)}` : `now ${p.state}` };
    }
    case 'cond.numeric': {
      if (p.attribute || !ids.length) return { status: 'assumed', note: 'cannot be checked here' };
      const bad = ids.find((i) => {
        const v = parseFloat(getState(i));
        return Number.isNaN(v) || (p.above !== '' && p.above !== undefined && !(v > Number(p.above)))
          || (p.below !== '' && p.below !== undefined && !(v < Number(p.below)));
      });
      return { status: bad ? 'fail' : 'pass', note: `now ${ids.map((i) => getState(i)).join(', ')}` };
    }
    case 'cond.time': {
      const mins = now.getHours() * 60 + now.getMinutes();
      const days = asList(p.weekdays);
      let ok = true;
      if (p.after && p.before) {
        const a = toMin(p.after), b = toMin(p.before);
        ok = a <= b ? mins >= a && mins < b : mins >= a || mins < b;
      } else if (p.after) ok = mins >= toMin(p.after);
      else if (p.before) ok = mins < toMin(p.before);
      if (days.length && !days.includes(DAYS[now.getDay()])) ok = false;
      return { status: ok ? 'pass' : 'fail', note: `now ${now.toTimeString().slice(0, 5)}` };
    }
    case 'cond.zone': {
      if (p.zone !== 'zone.home' || !ids.length) return { status: 'assumed', note: 'cannot be checked here' };
      const bad = ids.find((i) => getState(i) !== 'home');
      return { status: bad ? 'fail' : 'pass', note: bad ? `now ${getState(bad)}` : 'home' };
    }
    default:
      return { status: 'assumed', note: 'cannot be checked here' };
  }
}

// Walks the graph from every When card as if it fired now.
// Conditions follow Yes when they pass (or cannot be checked), No when they fail.
export function simulate(flow, getState, now = new Date()) {
  const results = {};
  const taken = new Set();
  const nodes = new Map((flow.nodes || []).map((n) => [n.id, n]));
  const edges = flow.edges || [];
  const seen = new Set();

  const follow = (id, port) => {
    for (const e of edges) {
      if (e.from !== id || (port && e.port !== port)) continue;
      if (!nodes.has(e.to)) continue;
      taken.add(e.id);
      visit(e.to);
    }
  };
  const visit = (id) => {
    if (seen.has(id)) return;
    seen.add(id);
    const n = nodes.get(id);
    const k = kindOf(n.type);
    if (k === 'condition') {
      const r = evalCondition(n, getState, now);
      results[id] = r;
      follow(id, r.status === 'fail' ? 'no' : 'yes');
    } else if (k === 'action') {
      results[id] = { status: 'run', note: 'would run' };
      follow(id, 'out');
    }
  };

  for (const n of nodes.values()) {
    if (kindOf(n.type) !== 'trigger') continue;
    results[n.id] = { status: 'start', note: 'starts here' };
    follow(n.id, 'out');
  }
  for (const n of nodes.values()) if (!results[n.id]) results[n.id] = { status: 'skip', note: 'not reached' };
  const wouldRun = Object.values(results).some((r) => r.status === 'run');
  return { results, taken, wouldRun };
}
