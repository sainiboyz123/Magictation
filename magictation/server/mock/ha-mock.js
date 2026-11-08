// Minimal in-memory Home Assistant used for tests and local UI development.
import http from 'node:http';
import { WebSocketServer } from 'ws';

export const TOKEN = 'mock-token';

const S = (entity_id, state, attributes = {}) => ({ entity_id, state, attributes, last_changed: new Date().toISOString() });

export function sampleStates() {
  return [
    S('light.living_room_ceiling', 'on', { friendly_name: 'Living Room Ceiling', brightness: 180 }),
    S('light.kitchen_strip', 'off', { friendly_name: 'Kitchen Strip' }),
    S('light.bedroom_lamp', 'off', { friendly_name: 'Bedroom Lamp' }),
    S('switch.coffee_machine', 'off', { friendly_name: 'Coffee Machine' }),
    S('switch.garden_pump', 'off', { friendly_name: 'Garden Pump' }),
    S('binary_sensor.front_door', 'off', { friendly_name: 'Front Door', device_class: 'door' }),
    S('binary_sensor.hall_motion', 'off', { friendly_name: 'Hall Motion', device_class: 'motion' }),
    S('sensor.living_room_temperature', '21.4', { friendly_name: 'Living Room Temperature', unit_of_measurement: '°C', device_class: 'temperature' }),
    S('sensor.outdoor_lux', '5400', { friendly_name: 'Outdoor Illuminance', unit_of_measurement: 'lx', device_class: 'illuminance' }),
    S('climate.main_floor', 'heat', { friendly_name: 'Main Floor Thermostat', hvac_modes: ['off', 'heat', 'cool', 'auto'] }),
    S('cover.garage_door', 'closed', { friendly_name: 'Garage Door' }),
    S('lock.front_door_lock', 'locked', { friendly_name: 'Front Door Lock' }),
    S('media_player.living_room_tv', 'off', { friendly_name: 'Living Room TV' }),
    S('person.alex', 'home', { friendly_name: 'Alex' }),
    S('zone.home', 'zoning', { friendly_name: 'Home' }),
    S('zone.work', 'zoning', { friendly_name: 'Work' }),
    S('scene.movie_night', 'unknown', { friendly_name: 'Movie Night' }),
    S('input_select.house_mode', 'Home', { friendly_name: 'House Mode', options: ['Home', 'Away', 'Night'] }),
    // extra entities of the same physical devices (should not clutter the picker)
    S('sensor.hall_motion_battery', '87', { friendly_name: 'Hall Motion Battery', unit_of_measurement: '%', device_class: 'battery' }),
    S('sensor.hall_motion_signal', '-61', { friendly_name: 'Hall Motion Signal strength', unit_of_measurement: 'dBm', device_class: 'signal_strength' }),
    S('sensor.hall_motion_illuminance', '12', { friendly_name: 'Hall Motion Illuminance', unit_of_measurement: 'lx', device_class: 'illuminance' }),
    S('update.living_room_ceiling_firmware', 'off', { friendly_name: 'Living Room Ceiling Firmware' }),
    S('button.living_room_ceiling_identify', 'unknown', { friendly_name: 'Living Room Ceiling Identify' }),
  ];
}

const DEVICES = [
  { id: 'dev_ceiling', name: 'Living Room Ceiling', area_id: 'living_room', manufacturer: 'Lumen', model: 'Bulb A19' },
  { id: 'dev_motion', name: 'Hall Motion', area_id: 'hallway', manufacturer: 'Sensio', model: 'Motion 2' },
  { id: 'dev_kitchen', name: 'Kitchen Strip', area_id: 'kitchen', manufacturer: 'Lumen', model: 'Strip' },
  { id: 'dev_lamp', name: 'Bedroom Lamp', area_id: 'bedroom', manufacturer: 'Lumen', model: 'Lamp' },
  { id: 'dev_coffee', name: 'Coffee Machine', area_id: 'kitchen', manufacturer: 'Plugco', model: 'Plug' },
  { id: 'dev_door', name: 'Front Door', area_id: 'hallway', manufacturer: 'Sensio', model: 'Contact' },
  { id: 'dev_thermo', name: 'Main Floor Thermostat', area_id: 'living_room', manufacturer: 'Thermo', model: 'T6' },
];
const ENTITY_DEVICES = {
  'light.living_room_ceiling': 'dev_ceiling', 'update.living_room_ceiling_firmware': 'dev_ceiling', 'button.living_room_ceiling_identify': 'dev_ceiling',
  'binary_sensor.hall_motion': 'dev_motion', 'sensor.hall_motion_battery': 'dev_motion', 'sensor.hall_motion_signal': 'dev_motion', 'sensor.hall_motion_illuminance': 'dev_motion',
  'light.kitchen_strip': 'dev_kitchen', 'light.bedroom_lamp': 'dev_lamp', 'switch.coffee_machine': 'dev_coffee',
  'binary_sensor.front_door': 'dev_door', 'climate.main_floor': 'dev_thermo',
};
const ENTITY_CATEGORY = {
  'sensor.hall_motion_battery': 'diagnostic', 'sensor.hall_motion_signal': 'diagnostic',
  'update.living_room_ceiling_firmware': 'config', 'button.living_room_ceiling_identify': 'config',
};

function entityRegistry() {
  const ids = new Set([...Object.keys(ENTITY_AREAS), ...Object.keys(ENTITY_DEVICES)]);
  return [...ids].map((entity_id) => ({
    entity_id,
    area_id: ENTITY_DEVICES[entity_id] ? null : ENTITY_AREAS[entity_id] || null,
    device_id: ENTITY_DEVICES[entity_id] || null,
    entity_category: ENTITY_CATEGORY[entity_id] || null,
    hidden_by: null,
    disabled_by: null,
  }));
}

const AREAS = [
  { area_id: 'living_room', name: 'Living Room' },
  { area_id: 'kitchen', name: 'Kitchen' },
  { area_id: 'bedroom', name: 'Bedroom' },
  { area_id: 'hallway', name: 'Hallway' },
];
const ENTITY_AREAS = {
  'light.living_room_ceiling': 'living_room', 'media_player.living_room_tv': 'living_room', 'sensor.living_room_temperature': 'living_room',
  'light.kitchen_strip': 'kitchen', 'switch.coffee_machine': 'kitchen',
  'light.bedroom_lamp': 'bedroom',
  'binary_sensor.front_door': 'hallway', 'binary_sensor.hall_motion': 'hallway', 'lock.front_door_lock': 'hallway',
};

export function startMock(port = 0) {
  const states = new Map(sampleStates().map((s) => [s.entity_id, s]));
  const automations = new Map();
  const serviceCalls = [];
  const sockets = new Set();

  const broadcast = (entity_id, newState) => {
    for (const ws of sockets) {
      if (ws.subscribed) ws.send(JSON.stringify({ id: ws.subscribed, type: 'event', event: { event_type: 'state_changed', data: { entity_id, new_state: newState } } }));
    }
  };
  const setState = (entity_id, state, attributes) => {
    const cur = states.get(entity_id) || S(entity_id, state, attributes || {});
    const next = { ...cur, state, attributes: attributes || cur.attributes };
    states.set(entity_id, next);
    broadcast(entity_id, next);
  };

  function syncAutomationEntities() {
    for (const [id, cfg] of automations) {
      const eid = `automation.${cfg.alias.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')}`;
      if (!states.has(eid)) setState(eid, 'on', { id, friendly_name: cfg.alias });
    }
    for (const eid of [...states.keys()]) {
      if (eid.startsWith('automation.') && !automations.has(states.get(eid).attributes.id)) states.delete(eid);
    }
  }

  const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      const send = (code, data) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(data)); };
      if (req.headers.authorization !== `Bearer ${TOKEN}`) return send(401, { message: 'Unauthorized' });
      const json = body ? JSON.parse(body) : {};
      const url = req.url;
      if (url === '/api/') return send(200, { message: 'API running.' });
      if (url === '/api/states' && req.method === 'GET') return send(200, [...states.values()]);
      let m = /^\/api\/services\/([a-z_]+)\/([a-z_]+)$/.exec(url);
      if (m && req.method === 'POST') {
        serviceCalls.push({ domain: m[1], service: m[2], data: json });
        if (m[1] === 'automation' && (m[2] === 'turn_on' || m[2] === 'turn_off')) setState(json.entity_id, m[2] === 'turn_on' ? 'on' : 'off');
        else if (m[2] === 'turn_on' || m[2] === 'turn_off') asArray(json.entity_id).forEach((e) => setState(e, m[2] === 'turn_on' ? 'on' : 'off'));
        return send(200, []);
      }
      m = /^\/api\/config\/automation\/config\/([A-Za-z0-9_]+)$/.exec(url);
      if (m) {
        if (req.method === 'POST') {
          if (!Array.isArray(json.trigger) || !Array.isArray(json.action)) return send(400, { message: 'Message malformed: trigger and action required' });
          automations.set(m[1], json);
          syncAutomationEntities();
          return send(200, { result: 'ok' });
        }
        if (req.method === 'DELETE') {
          if (!automations.has(m[1])) return send(404, { message: 'Resource not found' });
          automations.delete(m[1]);
          syncAutomationEntities();
          return send(200, { result: 'ok' });
        }
        if (req.method === 'GET') return automations.has(m[1]) ? send(200, automations.get(m[1])) : send(404, { message: 'Resource not found' });
      }
      send(404, { message: 'Not found' });
    });
  });

  // A tiny Supervisor: one app store repository with Magictation in it.
  const sup = { repos: [], available: process.env.MOCK_APP_VERSION || '0.2.0', installed: null, state: 'stopped', calls: [] };
  function supervisor(endpoint, method, data) {
    sup.calls.push(`${method} ${endpoint}`);
    const slug = 'abc123_magictation';
    const app = () => ({ slug, name: 'Magictation', version_latest: sup.available, installed: !!sup.installed, version: sup.installed || sup.available });
    if (endpoint === '/store') return { repositories: sup.repos.map((u) => ({ source: u })), addons: sup.repos.length ? [app()] : [] };
    if (endpoint === '/store/reload') return {};
    if (endpoint === '/store/repositories' && method === 'post') { sup.repos.push(data.repository); return {}; }
    if (endpoint === `/store/addons/${slug}/install`) { sup.installed = sup.available; return {}; }
    if (endpoint === `/store/addons/${slug}/update`) { sup.installed = sup.available; return {}; }
    if (endpoint === `/addons/${slug}/info`) return { slug, version: sup.installed, state: sup.state };
    if (endpoint === `/addons/${slug}/start`) { sup.state = 'started'; return {}; }
    if (endpoint === `/addons/${slug}/options`) return {};
    return undefined;
  }

  const wss = new WebSocketServer({ server, path: '/api/websocket' });
  wss.on('connection', (ws) => {
    sockets.add(ws);
    ws.on('close', () => sockets.delete(ws));
    ws.send(JSON.stringify({ type: 'auth_required' }));
    ws.on('message', (raw) => {
      const msg = JSON.parse(raw.toString());
      if (msg.type === 'auth') {
        return ws.send(JSON.stringify({ type: msg.access_token === TOKEN ? 'auth_ok' : 'auth_invalid', message: 'bad token' }));
      }
      const ok = (result) => ws.send(JSON.stringify({ id: msg.id, type: 'result', success: true, result }));
      switch (msg.type) {
        case 'subscribe_events': ws.subscribed = msg.id; return ok(null);
        case 'supervisor/api': {
          const r = supervisor(msg.endpoint, msg.method || 'get', msg.data);
          if (r === undefined) return ws.send(JSON.stringify({ id: msg.id, type: 'result', success: false, error: { message: `unknown endpoint ${msg.endpoint}` } }));
          return ok(r);
        }
        case 'config/area_registry/list': return ok(AREAS);
        case 'config/device_registry/list': return ok(DEVICES);
        case 'config/entity_registry/list': return ok(entityRegistry());
        case 'get_services': return ok({ light: { turn_on: { name: 'Turn on' } }, notify: { notify: { name: 'Send a notification' }, mobile_app_phone: { name: 'Notify phone' } } });
        default: return ws.send(JSON.stringify({ id: msg.id, type: 'result', success: false, error: { message: 'unknown command' } }));
      }
    });
  });

  return new Promise((resolve) => {
    server.listen(port, '127.0.0.1', () => {
      const p = server.address().port;
      resolve({
        url: `http://127.0.0.1:${p}`,
        port: p,
        states, automations, serviceCalls, setState, supervisor: sup,
        close: () => new Promise((r) => { sockets.forEach((s) => s.terminate()); wss.close(); server.close(r); }),
      });
    });
  });
}

function asArray(v) { return Array.isArray(v) ? v : v ? [v] : []; }
