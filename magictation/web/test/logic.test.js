import test from 'node:test';
import assert from 'node:assert/strict';
import { addCard, newCard, newFlow, removeCard, duplicateCard, moveCard, findCard, countCards, toYaml } from '../src/flowOps.js';
import { simulate } from '../src/simulate.js';
import { CARDS } from '../src/catalog.js';

test('every card type has a summary, fields and defaults that do not throw', () => {
  for (const [type, def] of Object.entries(CARDS)) {
    const c = newCard(type);
    assert.doesNotThrow(() => def.summary(c.params, { name: (x) => x }, c), type);
    assert.ok(Array.isArray(def.fields), type);
  }
});

test('add, move, duplicate and remove work on nested slots', () => {
  let f = newFlow('x');
  const iff = newCard('action.if');
  f = addCard(f, ['then'], iff);
  const inner = newCard('action.delay');
  f = addCard(f, ['then', iff.id, 'then'], inner);
  assert.equal(countCards(f), 2);
  f = duplicateCard(f, iff.id);
  assert.equal(f.then.length, 2);
  assert.equal(countCards(f), 4);
  assert.notEqual(f.then[0].slots.then[0].id, f.then[1].slots.then[0].id);
  f = moveCard(f, iff.id, 1);
  assert.equal(f.then[1].id, iff.id);
  f = removeCard(f, inner.id);
  assert.equal(findCard(f, inner.id), null);
});

test('simulate evaluates state, numeric and group conditions', () => {
  let f = newFlow('s');
  const a = newCard('cond.state'); a.params = { entity: ['light.a'], state: 'on' };
  const b = newCard('cond.numeric'); b.params = { entity: ['sensor.t'], above: 20, below: '' };
  const g = newCard('cond.group'); g.params = { mode: 'or' };
  f = addCard(f, ['and'], a); f = addCard(f, ['and'], b); f = addCard(f, ['and'], g);
  f = addCard(f, ['then'], newCard('action.turn_on'));
  const states = { 'light.a': 'on', 'sensor.t': '18' };
  const r = simulate(f, (id) => states[id]);
  assert.equal(r.results[a.id].status, 'pass');
  assert.equal(r.results[b.id].status, 'fail');
  assert.equal(r.wouldRun, false);
  assert.equal(r.results[f.then[0].id].status, 'skip');
});

test('toYaml renders lists of objects', () => {
  const y = toYaml({ trigger: [{ platform: 'state', entity_id: ['a.b'] }], mode: 'single' });
  assert.match(y, /trigger:\n  - platform: state/);
  assert.match(y, /mode: single/);
});
