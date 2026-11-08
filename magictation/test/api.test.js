import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { startMock, TOKEN } from '../server/mock/ha-mock.js';
import { HAClient } from '../server/ha.js';
import { FlowStore } from '../server/store.js';
import { createApp } from '../server/app.js';

let mock, ha, server, base, dir;

before(async () => {
  mock = await startMock(0);
  ha = new HAClient({ url: mock.url, token: TOKEN });
  ha.connect();
  await ha.whenReady();
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'magictation-'));
  const app = createApp({ ha, store: new FlowStore(dir) });
  await new Promise((r) => { server = app.listen(0, '127.0.0.1', r); });
  base = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  ha.close();
  server.close();
  await mock.close();
  fs.rmSync(dir, { recursive: true, force: true });
});

const j = async (method, p, body) => {
  const res = await fetch(base + p, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  return { status: res.status, body: await res.json() };
};

const goodFlow = (over = {}) => ({
  name: 'Hall light',
  version: 2,
  nodes: [
    { id: 't1', type: 'trigger.state', params: { entity: 'binary_sensor.hall_motion', to: 'on' }, x: 0, y: 0 },
    { id: 'a1', type: 'action.turn_on', params: { entity: 'light.bedroom_lamp' }, x: 300, y: 0 },
  ],
  edges: [{ id: 'e1', from: 't1', port: 'out', to: 'a1' }],
  ...over,
});

test('meta merges states with areas and devices', async () => {
  const { body } = await j('GET', '/api/meta');
  const lamp = body.entities.find((e) => e.entity_id === 'light.bedroom_lamp');
  assert.equal(lamp.area, 'Bedroom');
  assert.equal(lamp.device_id, 'dev_lamp');
  assert.ok(body.areas.length >= 3);
  assert.ok(body.services.some((s) => s.id === 'light.turn_on'));
  const motion = body.devices.find((d) => d.id === 'dev_motion');
  assert.equal(motion.area, 'Hallway');
  const battery = body.entities.find((e) => e.entity_id === 'sensor.hall_motion_battery');
  assert.equal(battery.entity_category, 'diagnostic');
  assert.equal(battery.area, 'Hallway');
});

test('valid flow is saved, deployed to HA and listed', async () => {
  const { status, body } = await j('POST', '/api/flows', goodFlow());
  assert.equal(status, 200);
  assert.equal(body.deploy.deployed, true, JSON.stringify(body.deploy));
  const cfg = mock.automations.get(`magictation_${body.flow.id}`);
  assert.equal(cfg.alias, '[Magictation] Hall light');
  assert.ok(body.flow.entity_id.startsWith('automation.'));
  const list = await j('GET', '/api/flows');
  assert.ok(list.body.some((f) => f.id === body.flow.id));
});

test('invalid flow is saved as draft and not deployed', async () => {
  const before = mock.automations.size;
  const { body } = await j('POST', '/api/flows', goodFlow({ name: 'Broken', edges: [] }));
  assert.equal(body.deploy.deployed, false);
  assert.ok(body.deploy.errors.length > 0);
  assert.equal(mock.automations.size, before);
  assert.equal(body.flow.deployed, false);
});

test('disable, run and delete a flow', async () => {
  const { body } = await j('POST', '/api/flows', goodFlow({ name: 'Lifecycle' }));
  const id = body.flow.id;
  const off = await j('POST', `/api/flows/${id}/enabled`, { enabled: false });
  assert.equal(off.body.flow.enabled, false);
  assert.equal(mock.states.get(body.flow.entity_id).state, 'off');
  const run = await j('POST', `/api/flows/${id}/run`, {});
  assert.equal(run.status, 200);
  assert.ok(mock.serviceCalls.some((c) => c.domain === 'automation' && c.service === 'trigger'));
  const del = await j('DELETE', `/api/flows/${id}`);
  assert.equal(del.status, 200);
  assert.equal(mock.automations.has(`magictation_${id}`), false);
  assert.equal((await j('DELETE', `/api/flows/${id}`)).status, 404);
});

test('updating a flow replaces its automation', async () => {
  const { body } = await j('POST', '/api/flows', goodFlow({ name: 'Rename me' }));
  const upd = await j('PUT', `/api/flows/${body.flow.id}`, { ...body.flow, name: 'Renamed' });
  assert.equal(upd.body.deploy.deployed, true);
  assert.equal(mock.automations.get(`magictation_${body.flow.id}`).alias, '[Magictation] Renamed');
});

test('compile endpoint returns errors without side effects', async () => {
  const { body } = await j('POST', '/api/compile', { flow: { name: 'x', nodes: [], edges: [] } });
  assert.equal(body.ok, false);
});

test('SSE stream forwards state changes', async () => {
  const ctrl = new AbortController();
  const res = await fetch(`${base}/api/stream`, { signal: ctrl.signal });
  const reader = res.body.getReader();
  await new Promise((r) => setTimeout(r, 200));
  mock.setState('switch.garden_pump', 'on');
  let text = '';
  const dec = new TextDecoder();
  while (!text.includes('switch.garden_pump')) {
    const { value, done } = await reader.read();
    if (done) break;
    text += dec.decode(value);
  }
  ctrl.abort();
  assert.match(text, /"entity_id":"switch.garden_pump","state":"on"/);
});

test('HA rejection surfaces as a draft with an error, not a crash', async () => {
  const orig = mock.automations.set.bind(mock.automations);
  const bad = goodFlow({ name: 'Bad' });
  // Force an HA-side 400 by sending a flow whose compiled trigger list is empty is blocked earlier,
  // so instead verify a bad token path: temporarily break the client token.
  const saved = ha.token;
  ha.token = 'wrong';
  const { body } = await j('POST', '/api/flows', bad);
  ha.token = saved;
  assert.equal(body.deploy.deployed, false);
  assert.match(body.deploy.errors[0].message, /Home Assistant rejected/);
  mock.automations.set = orig;
});
