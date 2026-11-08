import test from 'node:test';
import assert from 'node:assert/strict';
import { addNode, connect, connectProblem, duplicateNodes, newFlow, newNode, removeNodes, replaceNode, toYaml, freeSpot } from '../src/graph.js';
import { simulate } from '../src/simulate.js';
import { APPS, CARDS, appCards, cardText, deviceCards, deviceTiles } from '../src/catalog.js';

const ctx = { name: (x) => x, tile: () => null };

test('every card type has text, fields and defaults that format without throwing', () => {
  for (const [type, def] of Object.entries(CARDS)) {
    const n = newNode({ type });
    assert.doesNotThrow(() => cardText(n, ctx), type);
    assert.ok(Array.isArray(def.fields), type);
  }
  for (const app of APPS) for (const c of app.cards) assert.ok(CARDS[c.type], `${app.id}: ${c.type}`);
});

test('connect rules: no self, no into triggers, no duplicates, no loops', () => {
  let f = newFlow('x');
  const t = newNode({ type: 'trigger.time' });
  const c = newNode({ type: 'cond.state' });
  const a = newNode({ type: 'action.delay' });
  f = addNode(addNode(addNode(f, t), c), a);
  assert.match(connectProblem(f, a.id, 'out', a.id), /itself/);
  assert.match(connectProblem(f, a.id, 'out', t.id), /When cards/);
  assert.match(connectProblem(f, c.id, 'out', a.id), /output/);
  f = connect(f, t.id, 'out', c.id);
  f = connect(f, c.id, 'yes', a.id);
  f = connect(f, c.id, 'no', a.id);
  assert.equal(f.edges.length, 3);
  assert.match(connectProblem(f, c.id, 'yes', a.id), /already/);
  assert.match(connectProblem(f, a.id, 'out', c.id), /loop/);
  assert.equal(connect(f, a.id, 'out', c.id).edges.length, 3);
});

test('removing a card removes its wires; duplicate copies internal wires', () => {
  let f = newFlow('x');
  const t = newNode({ type: 'trigger.time' });
  const a = newNode({ type: 'action.delay' });
  const b = newNode({ type: 'action.stop' });
  f = [t, a, b].reduce(addNode, f);
  f = connect(connect(f, t.id, 'out', a.id), a.id, 'out', b.id);
  const d = duplicateNodes(f, [a.id, b.id]);
  assert.equal(d.flow.nodes.length, 5);
  assert.equal(d.flow.edges.length, 3);
  const r = removeNodes(f, [a.id]);
  assert.equal(r.nodes.length, 2);
  assert.equal(r.edges.length, 0);
});

test('replacing a condition with an action drops yes/no wires', () => {
  let f = newFlow('x');
  const t = newNode({ type: 'trigger.time' });
  const c = newNode({ type: 'cond.state' });
  const a = newNode({ type: 'action.delay' });
  f = [t, c, a].reduce(addNode, f);
  f = connect(connect(f, t.id, 'out', c.id), c.id, 'yes', a.id);
  const g = replaceNode(f, c.id, { type: 'action.turn_on' });
  assert.equal(g.nodes.find((n) => n.id === c.id).type, 'action.turn_on');
  assert.equal(g.edges.length, 1);
});

test('freeSpot avoids overlapping cards', () => {
  const f = addNode(newFlow('x'), newNode({ type: 'trigger.time' }, 0, 0));
  const s = freeSpot(f, 0, 0);
  assert.ok(s.y > 0);
});

test('simulate follows Yes or No depending on live state', () => {
  let f = newFlow('s');
  const t = newNode({ type: 'trigger.time' });
  const c = newNode({ type: 'cond.state', params: { entity: ['light.a'], state: 'on' } });
  const y = newNode({ type: 'action.turn_on' });
  const n = newNode({ type: 'action.turn_off' });
  f = [t, c, y, n].reduce(addNode, f);
  f = connect(connect(connect(f, t.id, 'out', c.id), c.id, 'yes', y.id), c.id, 'no', n.id);
  const on = simulate(f, () => 'on');
  assert.equal(on.results[y.id].status, 'run');
  assert.equal(on.results[n.id].status, 'skip');
  const off = simulate(f, () => 'off');
  assert.equal(off.results[c.id].status, 'fail');
  assert.equal(off.results[n.id].status, 'run');
  assert.equal(off.taken.size, 2);
});

const meta = {
  devices: [{ id: 'd1', name: 'Hall Motion', area: 'Hallway' }, { id: 'd2', name: 'Kitchen Light', area: 'Kitchen' }],
  entities: [
    { entity_id: 'binary_sensor.hall_motion', domain: 'binary_sensor', name: 'Hall Motion', state: 'off', device_id: 'd1', attrs: { device_class: 'motion' } },
    { entity_id: 'sensor.hall_motion_battery', domain: 'sensor', name: 'Hall Motion Battery', state: '80', device_id: 'd1', entity_category: 'diagnostic', attrs: { unit: '%' } },
    { entity_id: 'sensor.hall_motion_lux', domain: 'sensor', name: 'Hall Motion Illuminance', state: '12', device_id: 'd1', attrs: { unit: 'lx' } },
    { entity_id: 'light.kitchen', domain: 'light', name: 'Kitchen Light', state: 'on', device_id: 'd2', attrs: {} },
    { entity_id: 'update.kitchen_fw', domain: 'update', name: 'Kitchen Light Firmware', state: 'off', device_id: 'd2', entity_category: 'config', attrs: {} },
    { entity_id: 'automation.x', domain: 'automation', name: 'X', state: 'on', attrs: {} },
    { entity_id: 'person.alex', domain: 'person', name: 'Alex', state: 'home', attrs: {} },
  ],
};

test('one tile per device; diagnostic and config entities are hidden', () => {
  const tiles = deviceTiles(meta);
  assert.deepEqual(tiles.map((t) => t.name), ['Alex', 'Hall Motion', 'Kitchen Light']);
  const motion = tiles.find((t) => t.id === 'd1');
  assert.deepEqual(motion.entities.map((e) => e.entity_id), ['binary_sensor.hall_motion', 'sensor.hall_motion_lux']);
  assert.equal(deviceTiles(meta, { showAll: true }).find((t) => t.id === 'd1').entities.length, 3);
});

test('device cards are relevant to the device and the column', () => {
  const tiles = deviceTiles(meta);
  const motion = tiles.find((t) => t.id === 'd1');
  const when = deviceCards(motion, 'trigger').map((c) => c.text);
  assert.ok(when.includes('Motion detected'));
  assert.ok(when.includes('Illuminance: Rises above {above}'));
  assert.equal(deviceCards(motion, 'action').length, 0);
  const light = tiles.find((t) => t.id === 'd2');
  const then = deviceCards(light, 'action');
  assert.ok(then.some((c) => c.text === 'Turn on' && c.params.entity[0] === 'light.kitchen' && c.device === 'd2'));
  assert.ok(appCards(APPS[0], 'trigger').length > 0);
  const n = newNode(deviceCards(motion, 'trigger')[0]);
  assert.equal(n.device, 'd1');
  assert.equal(cardText(n, ctx), 'Motion detected');
});

test('toYaml renders lists of objects', () => {
  const y = toYaml({ trigger: [{ platform: 'state', entity_id: ['a.b'] }], mode: 'single' });
  assert.match(y, /trigger:\n  - platform: state/);
  assert.match(y, /mode: single/);
});
