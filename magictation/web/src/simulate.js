import { asList } from './catalog.js';

const DAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const toMin = (t) => { const [h, m] = String(t).split(':'); return Number(h) * 60 + Number(m || 0); };

// Evaluates conditions against live state. Returns { results: {cardId: {status, note}}, wouldRun }.
export function simulate(flow, getState, now = new Date()) {
  const results = {};
  const mark = (card, status, note) => { results[card.id] = { status, note }; return status; };

  function cond(card) {
    const p = card.params || {};
    const ids = asList(p.entity);
    switch (card.type) {
      case 'cond.state': {
        const bad = ids.find((i) => String(getState(i)) !== String(p.state));
        return mark(card, bad ? 'fail' : 'pass', bad ? `${bad} is ${getState(bad)}` : `now ${p.state}`);
      }
      case 'cond.numeric': {
        const bad = ids.find((i) => {
          const v = parseFloat(getState(i));
          return Number.isNaN(v) || (p.above !== '' && !(v > Number(p.above))) || (p.below !== '' && !(v < Number(p.below)));
        });
        return mark(card, bad ? 'fail' : 'pass', ids.map((i) => `${i.split('.')[1]}=${getState(i)}`).join(', '));
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
        return mark(card, ok ? 'pass' : 'fail', `now ${now.toTimeString().slice(0, 5)}`);
      }
      case 'cond.zone': {
        const want = p.zone === 'zone.home' ? 'home' : null;
        if (!want) return mark(card, 'assumed', 'zone not evaluated');
        const bad = ids.find((i) => getState(i) !== want);
        return mark(card, bad ? 'fail' : 'pass', bad ? `${bad} is ${getState(bad)}` : 'home');
      }
      case 'cond.group': {
        const kids = (card.slots?.conditions || []).map(cond);
        const known = kids.filter((k) => k !== 'assumed');
        if (!kids.length) return mark(card, 'assumed', 'empty');
        if (!known.length) return mark(card, 'assumed', 'cannot evaluate');
        const passes = known.map((k) => k === 'pass');
        const ok = p.mode === 'or' ? passes.some(Boolean) : p.mode === 'not' ? !passes.some(Boolean) : passes.every(Boolean);
        return mark(card, ok ? 'pass' : 'fail');
      }
      default:
        return mark(card, 'assumed', 'cannot be checked here');
    }
  }

  for (const t of flow.when || []) {
    const ids = asList(t.params?.entity);
    mark(t, 'info', ids.length ? ids.map((i) => `${i.split('.')[1]}: ${getState(i)}`).join(', ') : 'scheduled');
  }
  const outcomes = (flow.and || []).map(cond);
  const wouldRun = outcomes.every((o) => o !== 'fail');
  (flow.then || []).forEach((a) => mark(a, wouldRun ? 'pass' : 'skip', wouldRun ? 'would run' : 'blocked by conditions'));
  return { results, wouldRun };
}
