import test from 'node:test';
import assert from 'node:assert/strict';
import { compileFlow, secondsToHms, hexToRgb } from '../server/compiler.js';

const card = (type, params = {}, slots) => ({ id: Math.random().toString(36).slice(2, 7), type, params, slots });
const flow = (over = {}) => ({ id: 'abc', name: 'Test', when: [], and: [], then: [], ...over });

test('secondsToHms formats durations', () => {
  assert.equal(secondsToHms(0), '00:00:00');
  assert.equal(secondsToHms(3725), '01:02:05');
});

test('hexToRgb parses colours', () => {
  assert.deepEqual(hexToRgb('#ff8000'), [255, 128, 0]);
  assert.equal(hexToRgb('nope'), undefined);
});

test('motion turns on light with condition and delay off', () => {
  const r = compileFlow(flow({
    when: [card('trigger.state', { entity: 'binary_sensor.hall_motion', to: 'on' })],
    and: [card('cond.sun', { after: 'sunset' })],
    then: [
      card('action.light', { entity: 'light.bedroom_lamp', brightness: 40 }),
      card('action.delay', { seconds: 90 }),
      card('action.turn_off', { entity: 'light.bedroom_lamp' }),
    ],
  }));
  assert.equal(r.ok, true, JSON.stringify(r.errors));
  const a = r.automation;
  assert.equal(a.id, 'magictation_abc');
  assert.equal(a.alias, '[Magictation] Test');
  assert.deepEqual(a.trigger[0].entity_id, ['binary_sensor.hall_motion']);
  assert.equal(a.trigger[0].platform, 'state');
  assert.deepEqual(a.condition, [{ condition: 'sun', after: 'sunset' }]);
  assert.equal(a.action[0].service, 'light.turn_on');
  assert.equal(a.action[0].data.brightness_pct, 40);
  assert.equal(a.action[1].delay, '00:01:30');
  assert.equal(a.action[2].service, 'light.turn_off');
});

test('mixed-domain turn_on falls back to homeassistant.turn_on', () => {
  const r = compileFlow(flow({
    when: [card('trigger.time', { at: '07:30' })],
    then: [card('action.turn_on', { entity: ['light.kitchen_strip', 'switch.coffee_machine'] })],
  }));
  assert.equal(r.automation.action[0].service, 'homeassistant.turn_on');
  assert.equal(r.automation.trigger[0].at, '07:30:00');
});

test('nested if/else, group and repeat compile', () => {
  const r = compileFlow(flow({
    when: [card('trigger.numeric', { entity: 'sensor.living_room_temperature', above: 25, forSeconds: 300 })],
    then: [
      card('action.if', {}, {
        conditions: [card('cond.group', { mode: 'or' }, { conditions: [
          card('cond.state', { entity: 'person.alex', state: 'home' }),
          card('cond.template', { template: '{{ true }}' }),
        ] })],
        then: [card('action.repeat', { count: 3 }, { sequence: [card('action.notify', { message: 'Hot!' })] })],
        else: [card('action.stop', {})],
      }),
    ],
  }));
  assert.equal(r.ok, true, JSON.stringify(r.errors));
  assert.equal(r.automation.trigger[0].for, '00:05:00');
  const step = r.automation.action[0];
  assert.equal(step.if[0].condition, 'or');
  assert.equal(step.if[0].conditions.length, 2);
  assert.equal(step.then[0].repeat.count, 3);
  assert.equal(step.then[0].repeat.sequence[0].service, 'notify.notify');
  assert.ok(step.else[0].stop);
});

test('validation reports missing pieces and bad cards', () => {
  const r = compileFlow(flow({ name: '  ', when: [card('trigger.state', {})], then: [] }));
  assert.equal(r.ok, false);
  const msgs = r.errors.map((e) => e.message).join('|');
  assert.match(msgs, /Pick a device/);
  assert.match(msgs, /THEN action/);
  assert.match(msgs, /name/);
});

test('invalid service JSON and unknown types are reported, not thrown', () => {
  const r = compileFlow(flow({
    when: [card('trigger.bogus')],
    then: [card('action.service', { service: 'light.turn_on', data: '{bad' }), card('action.nope')],
  }));
  assert.equal(r.ok, false);
  assert.ok(r.errors.length >= 3);
});

test('sun offset and zone triggers', () => {
  const r = compileFlow(flow({
    when: [card('trigger.sun', { event: 'sunset', offsetMinutes: -30 }), card('trigger.zone', { entity: 'person.alex', zone: 'zone.home', event: 'leave' })],
    then: [card('action.scene', { entity: 'scene.movie_night' })],
  }));
  assert.equal(r.automation.trigger[0].offset, '-00:30:00');
  assert.equal(r.automation.trigger[1].event, 'leave');
});

test('garbage input does not throw', () => {
  assert.doesNotThrow(() => compileFlow(undefined));
  assert.doesNotThrow(() => compileFlow({}));
});
