import test from 'node:test';
import assert from 'node:assert/strict';
import { compileFlow, secondsToHms, hexToRgb } from '../server/compiler.js';

let n = 0;
const node = (type, params = {}, y = n * 10) => ({ id: `n${++n}`, type, params, x: 0, y });
const edge = (from, to, port = 'out') => ({ id: `e${from.id}${to.id}${port}`, from: from.id, to: to.id, port });
const flow = (nodes, edges, over = {}) => ({ id: 'abc', name: 'Test', nodes, edges, ...over });

test('secondsToHms formats durations', () => {
  assert.equal(secondsToHms(0), '00:00:00');
  assert.equal(secondsToHms(3725), '01:02:05');
});

test('hexToRgb parses colours', () => {
  assert.deepEqual(hexToRgb('#ff8000'), [255, 128, 0]);
  assert.equal(hexToRgb('nope'), undefined);
});

test('linear chain: trigger -> light -> delay -> off', () => {
  const t = node('trigger.state', { entity: 'binary_sensor.hall_motion', to: 'on' });
  const a = node('action.light', { entity: 'light.bedroom_lamp', brightness: 40 });
  const d = node('action.delay', { seconds: 90 });
  const o = node('action.turn_off', { entity: 'light.bedroom_lamp' });
  const r = compileFlow(flow([t, a, d, o], [edge(t, a), edge(a, d), edge(d, o)]));
  assert.equal(r.ok, true, JSON.stringify(r.errors));
  const x = r.automation;
  assert.equal(x.id, 'magictation_abc');
  assert.equal(x.alias, '[Magictation] Test');
  assert.deepEqual(x.trigger[0].entity_id, ['binary_sensor.hall_motion']);
  assert.equal(x.action[0].service, 'light.turn_on');
  assert.equal(x.action[0].data.brightness_pct, 40);
  assert.equal(x.action[1].delay, '00:01:30');
  assert.equal(x.action[2].service, 'light.turn_off');
});

test('condition yes/no branches compile to if/then/else', () => {
  const t = node('trigger.time', { at: '07:30' });
  const c = node('cond.state', { entity: 'person.alex', state: 'home' });
  const y = node('action.turn_on', { entity: ['light.kitchen_strip', 'switch.coffee_machine'] });
  const no = node('action.notify', { message: 'Nobody home' });
  const r = compileFlow(flow([t, c, y, no], [edge(t, c), edge(c, y, 'yes'), edge(c, no, 'no')]));
  assert.equal(r.ok, true, JSON.stringify(r.errors));
  const step = r.automation.action[0];
  assert.equal(step.if[0].condition, 'state');
  assert.equal(step.then[0].service, 'homeassistant.turn_on');
  assert.equal(step.else[0].service, 'notify.notify');
  assert.equal(r.automation.trigger[0].at, '07:30:00');
});

test('only the No output wired compiles to a NOT condition', () => {
  const t = node('trigger.time', { at: '08:00' });
  const c = node('cond.sun', { after: 'sunset' });
  const a = node('action.turn_off', { entity: 'light.bedroom_lamp' });
  const r = compileFlow(flow([t, c, a], [edge(t, c), edge(c, a, 'no')]));
  assert.equal(r.ok, true, JSON.stringify(r.errors));
  assert.equal(r.automation.action[0].if[0].condition, 'not');
  assert.equal(r.automation.action[0].then[0].service, 'light.turn_off');
});

test('fan-out runs in parallel', () => {
  const t = node('trigger.ha', {});
  const a = node('action.turn_on', { entity: 'light.a' }, 1);
  const b = node('action.turn_on', { entity: 'light.b' }, 2);
  const r = compileFlow(flow([t, a, b], [edge(t, a), edge(t, b)]));
  assert.equal(r.ok, true, JSON.stringify(r.errors));
  const p = r.automation.action[0].parallel;
  assert.equal(p.length, 2);
  assert.deepEqual(p[0].sequence[0].target.entity_id, ['light.a']);
});

test('triggers with different paths use choose with a default', () => {
  const t1 = node('trigger.time', { at: '07:00' });
  const t2 = node('trigger.sun', { event: 'sunset', offsetMinutes: -30 });
  const a = node('action.turn_on', { entity: 'light.a' });
  const b = node('action.scene', { entity: 'scene.movie_night' });
  const r = compileFlow(flow([t1, t2, a, b], [edge(t1, a), edge(t2, b)]));
  assert.equal(r.ok, true, JSON.stringify(r.errors));
  const ch = r.automation.action[0];
  assert.equal(ch.choose.length, 2);
  assert.deepEqual(ch.choose[0].conditions, [{ condition: 'trigger', id: t1.id }]);
  assert.equal(ch.default[0].service, 'light.turn_on');
  assert.equal(r.automation.trigger[1].offset, '-00:30:00');
});

test('triggers sharing one path need no choose', () => {
  const t1 = node('trigger.time', { at: '07:00' });
  const t2 = node('trigger.ha', {});
  const a = node('action.turn_on', { entity: 'light.a' });
  const r = compileFlow(flow([t1, t2, a], [edge(t1, a), edge(t2, a)]));
  assert.equal(r.automation.action[0].service, 'light.turn_on');
  assert.equal(r.automation.trigger.length, 2);
});

test('cycles are reported, not followed forever', () => {
  const t = node('trigger.ha', {});
  const a = node('action.toggle', { entity: 'light.a' });
  const b = node('action.delay', { seconds: 5 });
  const r = compileFlow(flow([t, a, b], [edge(t, a), edge(a, b), edge(b, a)]));
  assert.equal(r.ok, false);
  assert.match(r.errors.map((e) => e.message).join('|'), /loops back/);
});

test('unconnected cards are warnings, not errors; empty fields are errors', () => {
  const t = node('trigger.ha', {});
  const a = node('action.turn_on', { entity: 'light.a' });
  const stray = node('action.turn_on', {});
  const r = compileFlow(flow([t, a, stray], [edge(t, a)]));
  assert.equal(r.ok, true, JSON.stringify(r.errors));
  assert.equal(r.warnings[0].card, stray.id);
  const r2 = compileFlow(flow([t, stray], [edge(t, stray)]));
  assert.equal(r2.ok, false);
  assert.match(r2.errors[0].message, /Pick a device/);
});

test('missing pieces are reported', () => {
  const r = compileFlow(flow([], [], { name: ' ' }));
  const msgs = r.errors.map((e) => e.message).join('|');
  assert.match(msgs, /When card/);
  assert.match(msgs, /name/);
  const t = node('trigger.ha', {});
  const r2 = compileFlow(flow([t], []));
  assert.match(r2.errors.map((e) => e.message).join('|'), /Connect this When card/);
});

test('bad service JSON and unknown types are reported, not thrown', () => {
  const t = node('trigger.bogus');
  const t2 = node('trigger.ha');
  const s = node('action.service', { service: 'light.turn_on', data: '{bad' });
  const u = node('action.nope');
  const r = compileFlow(flow([t, t2, s, u], [edge(t2, s), edge(s, u)]));
  assert.equal(r.ok, false);
  assert.ok(r.errors.length >= 3, JSON.stringify(r.errors));
});

test('wide diamond graphs hit the complexity cap instead of exploding', () => {
  const t = node('trigger.ha', {});
  const nodes = [t];
  const edges = [];
  let prev = [t];
  for (let i = 0; i < 12; i++) {
    const layer = [node('action.delay', { seconds: 1 }), node('action.delay', { seconds: 1 })];
    prev.forEach((p) => layer.forEach((l) => edges.push(edge(p, l))));
    nodes.push(...layer);
    prev = layer;
  }
  const r = compileFlow(flow(nodes, edges));
  assert.equal(r.ok, false);
  assert.match(r.errors.map((e) => e.message).join('|'), /too many paths/);
});

test('garbage input does not throw', () => {
  assert.doesNotThrow(() => compileFlow(undefined));
  assert.doesNotThrow(() => compileFlow({}));
  assert.doesNotThrow(() => compileFlow({ nodes: [null, { id: 'x' }], edges: [{ from: 'x', to: 'nope' }] }));
});
