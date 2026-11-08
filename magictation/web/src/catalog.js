// Card catalog: every When / And / Then card, the "apps" they live in, and the
// cards each device offers (Homey-style: pick a device, then pick what it does).
// field kinds: entity, state, text, number, time, select, color, textarea, weekdays, service

export const asList = (v) => (v === undefined || v === null || v === '' ? [] : Array.isArray(v) ? v : [v]);
export const dur = (s) => {
  s = Number(s) || 0;
  if (!s) return '';
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60;
  return [h && `${h}h`, m && `${m}m`, x && `${x}s`].filter(Boolean).join(' ');
};
const names = (ctx, v) => asList(v).map(ctx.name).join(', ') || '…';

export const KINDS = {
  trigger: { label: 'When', hint: 'Starts the flow', tone: 'when' },
  condition: { label: 'And', hint: 'Checks something: Yes or No', tone: 'and' },
  action: { label: 'Then', hint: 'Does something', tone: 'then' },
};

// Which ports a card has. Conditions branch into Yes and No.
export const PORTS = {
  trigger: { input: false, outputs: ['out'] },
  condition: { input: true, outputs: ['yes', 'no'] },
  action: { input: true, outputs: ['out'] },
};

const ENTITY = (label = 'Device', extra = {}) => ({ key: 'entity', label, kind: 'entity', multi: true, ...extra });

export const CARDS = {
  // ---------- When ----------
  'trigger.state': {
    kind: 'trigger', label: 'Device changes state', icon: 'bolt', text: '{entity} becomes {to}',
    defaults: { entity: [], to: '', from: '', forSeconds: '' },
    fields: [
      ENTITY(),
      { key: 'to', label: 'Becomes', kind: 'state', entityKey: 'entity', hint: 'empty = any change' },
      { key: 'from', label: 'Was (optional)', kind: 'state', entityKey: 'entity' },
      { key: 'forSeconds', label: 'For at least (seconds)', kind: 'number' },
    ],
  },
  'trigger.numeric': {
    kind: 'trigger', label: 'Value crosses a level', icon: 'pulse', text: '{entity} goes above {above} / below {below}',
    defaults: { entity: [], above: '', below: '', forSeconds: '' },
    fields: [
      ENTITY('Sensor', { domains: ['sensor', 'input_number', 'number', 'climate', 'weather'] }),
      { key: 'above', label: 'Goes above', kind: 'number' },
      { key: 'below', label: 'Goes below', kind: 'number' },
      { key: 'forSeconds', label: 'For at least (seconds)', kind: 'number' },
    ],
  },
  'trigger.time': {
    kind: 'trigger', label: 'At a time', icon: 'clock', text: 'Every day at {at}',
    defaults: { at: '07:00' },
    fields: [{ key: 'at', label: 'Time', kind: 'time' }],
  },
  'trigger.interval': {
    kind: 'trigger', label: 'Every few minutes', icon: 'repeat', text: 'Every {minutes} minutes',
    defaults: { minutes: 5 },
    fields: [{ key: 'minutes', label: 'Every N minutes (1-59)', kind: 'number' }],
  },
  'trigger.sun': {
    kind: 'trigger', label: 'Sunrise or sunset', icon: 'sun', text: 'At {event}, offset {offsetMinutes} min',
    defaults: { event: 'sunset', offsetMinutes: 0 },
    fields: [
      { key: 'event', label: 'Event', kind: 'select', options: [['sunrise', 'Sunrise'], ['sunset', 'Sunset']] },
      { key: 'offsetMinutes', label: 'Offset in minutes (negative = before)', kind: 'number' },
    ],
  },
  'trigger.zone': {
    kind: 'trigger', label: 'Someone arrives or leaves', icon: 'pin', text: '{entity} {event} {zone}',
    defaults: { entity: [], zone: 'zone.home', event: 'enter' },
    fields: [
      ENTITY('Person', { domains: ['person', 'device_tracker'] }),
      { key: 'event', label: 'Event', kind: 'select', options: [['enter', 'arrives at'], ['leave', 'leaves']] },
      { key: 'zone', label: 'Zone', kind: 'entity', domains: ['zone'] },
    ],
  },
  'trigger.ha': {
    kind: 'trigger', label: 'Home Assistant starts', icon: 'home', text: 'Home Assistant {event}',
    defaults: { event: 'start' },
    fields: [{ key: 'event', label: 'Event', kind: 'select', options: [['start', 'starts'], ['shutdown', 'shuts down']] }],
  },
  'trigger.event': {
    kind: 'trigger', label: 'Custom event', icon: 'code', text: 'Event {eventType} fires',
    defaults: { eventType: '' },
    fields: [{ key: 'eventType', label: 'Event type', kind: 'text', placeholder: 'my_custom_event' }],
  },

  // ---------- And ----------
  'cond.state': {
    kind: 'condition', label: 'Device is in a state', icon: 'toggle', text: '{entity} is {state}',
    defaults: { entity: [], state: '', forSeconds: '' },
    fields: [
      ENTITY(),
      { key: 'state', label: 'State is', kind: 'state', entityKey: 'entity' },
      { key: 'forSeconds', label: 'For at least (seconds)', kind: 'number' },
    ],
  },
  'cond.numeric': {
    kind: 'condition', label: 'Value is above or below', icon: 'pulse', text: '{entity} is above {above} / below {below}',
    defaults: { entity: [], above: '', below: '' },
    fields: [
      ENTITY('Sensor', { domains: ['sensor', 'input_number', 'number', 'climate', 'weather'] }),
      { key: 'above', label: 'Above', kind: 'number' },
      { key: 'below', label: 'Below', kind: 'number' },
    ],
  },
  'cond.time': {
    kind: 'condition', label: 'Time of day / weekday', icon: 'clock', text: 'Time is between {after} and {before}',
    defaults: { after: '', before: '', weekdays: [] },
    fields: [
      { key: 'after', label: 'After', kind: 'time' },
      { key: 'before', label: 'Before', kind: 'time' },
      { key: 'weekdays', label: 'On days', kind: 'weekdays' },
    ],
  },
  'cond.sun': {
    kind: 'condition', label: 'Before or after sunrise/sunset', icon: 'sun', text: 'It is after {after}',
    defaults: { after: 'sunset', before: '' },
    fields: [
      { key: 'after', label: 'After', kind: 'select', options: [['', '—'], ['sunrise', 'Sunrise'], ['sunset', 'Sunset']] },
      { key: 'before', label: 'Before', kind: 'select', options: [['', '—'], ['sunrise', 'Sunrise'], ['sunset', 'Sunset']] },
    ],
  },
  'cond.zone': {
    kind: 'condition', label: 'Someone is in a zone', icon: 'pin', text: '{entity} is in {zone}',
    defaults: { entity: [], zone: 'zone.home' },
    fields: [
      ENTITY('Person', { domains: ['person', 'device_tracker'] }),
      { key: 'zone', label: 'Zone', kind: 'entity', domains: ['zone'] },
    ],
  },
  'cond.template': {
    kind: 'condition', label: 'Template (advanced)', icon: 'code', text: 'Template is true',
    defaults: { template: '' },
    fields: [{ key: 'template', label: 'Template', kind: 'textarea', placeholder: "{{ states('sensor.x') | float > 3 }}" }],
  },

  // ---------- Then ----------
  'action.turn_on': {
    kind: 'action', label: 'Turn on', icon: 'power', text: 'Turn on {entity}',
    defaults: { entity: [] }, fields: [ENTITY('Devices')],
  },
  'action.turn_off': {
    kind: 'action', label: 'Turn off', icon: 'power', text: 'Turn off {entity}',
    defaults: { entity: [] }, fields: [ENTITY('Devices')],
  },
  'action.toggle': {
    kind: 'action', label: 'Toggle', icon: 'toggle', text: 'Toggle {entity}',
    defaults: { entity: [] }, fields: [ENTITY('Devices')],
  },
  'action.light': {
    kind: 'action', label: 'Set light', icon: 'bulb', text: 'Set {entity} to {brightness}%',
    defaults: { entity: [], brightness: 80, kelvin: '', color: '', transition: '' },
    fields: [
      ENTITY('Lights', { domains: ['light'] }),
      { key: 'brightness', label: 'Brightness %', kind: 'number' },
      { key: 'kelvin', label: 'White temperature (K)', kind: 'number' },
      { key: 'color', label: 'Colour', kind: 'color' },
      { key: 'transition', label: 'Fade (seconds)', kind: 'number' },
    ],
  },
  'action.climate': {
    kind: 'action', label: 'Set temperature', icon: 'thermo', text: 'Set {entity} to {temperature}°',
    defaults: { entity: [], temperature: 21 },
    fields: [ENTITY('Thermostat', { domains: ['climate'] }), { key: 'temperature', label: 'Target', kind: 'number' }],
  },
  'action.scene': {
    kind: 'action', label: 'Activate scene', icon: 'scene', text: 'Activate {entity}',
    defaults: { entity: [] }, fields: [{ key: 'entity', label: 'Scene', kind: 'entity', domains: ['scene'] }],
  },
  'action.notify': {
    kind: 'action', label: 'Send notification', icon: 'bell', text: 'Send “{message}”',
    defaults: { target: 'notify', title: '', message: '' },
    fields: [
      { key: 'message', label: 'Message', kind: 'textarea' },
      { key: 'title', label: 'Title (optional)', kind: 'text' },
      { key: 'target', label: 'Send to', kind: 'service', prefix: 'notify.' },
    ],
  },
  'action.service': {
    kind: 'action', label: 'Call a service', icon: 'code', text: 'Call {service}',
    defaults: { service: '', entity: [], data: '' },
    fields: [
      { key: 'service', label: 'Service', kind: 'service', placeholder: 'light.turn_on' },
      ENTITY('Target (optional)'),
      { key: 'data', label: 'Data (JSON, optional)', kind: 'textarea', placeholder: '{"brightness_pct": 50}' },
    ],
  },
  'action.delay': {
    kind: 'action', label: 'Wait', icon: 'hourglass', text: 'Wait {seconds}',
    defaults: { seconds: 60 }, fields: [{ key: 'seconds', label: 'Seconds', kind: 'number' }],
  },
  'action.wait': {
    kind: 'action', label: 'Wait until', icon: 'hourglass', text: 'Wait until {entity} is {state}',
    defaults: { entity: [], state: '', timeoutSeconds: 300 },
    fields: [
      ENTITY(),
      { key: 'state', label: 'Becomes', kind: 'state', entityKey: 'entity' },
      { key: 'timeoutSeconds', label: 'Give up after (seconds)', kind: 'number' },
    ],
  },
  'action.stop': {
    kind: 'action', label: 'Stop the flow', icon: 'stop', text: 'Stop the flow',
    defaults: { message: '' }, fields: [{ key: 'message', label: 'Reason (optional)', kind: 'text' }],
  },
};

export const kindOf = (type) => CARDS[type]?.kind || null;

// ---------- formatting card text ----------
// Splits "Turn on {entity}" into text parts and value tokens for display.
export function cardTokens(node, ctx) {
  const def = CARDS[node.type];
  const text = node.text || def?.text || def?.label || node.type;
  const fields = Object.fromEntries((def?.fields || []).map((f) => [f.key, f]));
  return text.split(/(\{\w+\})/).filter(Boolean).map((part) => {
    const m = /^\{(\w+)\}$/.exec(part);
    if (!m) return { text: part };
    return { value: formatParam(m[1], node.params?.[m[1]], fields[m[1]], ctx, node) };
  });
}

export function cardText(node, ctx) {
  return cardTokens(node, ctx).map((t) => t.text ?? t.value).join('');
}

function formatParam(key, v, field, ctx, node) {
  if (field?.kind === 'entity') return names(ctx, v);
  if (v === undefined || v === null || v === '' || (Array.isArray(v) && !v.length)) return '…';
  if (field?.kind === 'select') return field.options.find(([o]) => o === v)?.[1] || String(v);
  if (field?.kind === 'weekdays') return asList(v).map((d) => d[0].toUpperCase() + d.slice(1)).join(' ');
  if (/seconds$/i.test(key)) return dur(v) || '…';
  if (field?.kind === 'service') return String(v);
  const unit = node?.unit && ['above', 'below', 'temperature'].includes(key) ? ` ${node.unit}` : '';
  return `${v}${unit}`;
}

// ---------- apps (cards that are not tied to one device) ----------
const P = (type, text, params = {}, fields) => ({ type, text, params, fields });
export const APPS = [
  { id: 'datetime', name: 'Date & time', icon: 'clock', cards: [
    P('trigger.time', 'Every day at {at}'),
    P('trigger.interval', 'Every {minutes} minutes'),
    P('trigger.sun', 'At sunrise', { event: 'sunrise' }, ['offsetMinutes']),
    P('trigger.sun', 'At sunset', { event: 'sunset' }, ['offsetMinutes']),
    P('cond.time', 'Time is between {after} and {before}', {}, ['after', 'before']),
    P('cond.time', 'Today is {weekdays}', { weekdays: ['mon', 'tue', 'wed', 'thu', 'fri'] }, ['weekdays']),
    P('cond.state', 'It is dark outside', { entity: ['sun.sun'], state: 'below_horizon' }, []),
    P('cond.state', 'It is daytime', { entity: ['sun.sun'], state: 'above_horizon' }, []),
  ] },
  { id: 'presence', name: 'Presence', icon: 'person', cards: [
    P('trigger.zone', '{entity} arrives at {zone}', { event: 'enter' }, ['entity', 'zone']),
    P('trigger.zone', '{entity} leaves {zone}', { event: 'leave' }, ['entity', 'zone']),
    P('cond.zone', '{entity} is in {zone}'),
  ] },
  { id: 'notify', name: 'Notifications', icon: 'bell', cards: [P('action.notify', 'Send “{message}”')] },
  { id: 'flow', name: 'Timers & flow', icon: 'hourglass', cards: [
    P('action.delay', 'Wait {seconds}'),
    P('action.wait', 'Wait until {entity} is {state}'),
    P('action.stop', 'Stop the flow'),
  ] },
  { id: 'scenes', name: 'Scenes', icon: 'scene', cards: [P('action.scene', 'Activate {entity}')] },
  { id: 'ha', name: 'Home Assistant', icon: 'home', cards: [
    P('trigger.ha', 'Home Assistant {event}'),
    P('trigger.event', 'Event {eventType} fires'),
    P('trigger.state', 'Any entity: {entity} becomes {to}'),
    P('trigger.numeric', 'Any sensor: {entity} goes above {above} / below {below}'),
    P('cond.state', 'Any entity: {entity} is {state}'),
    P('cond.numeric', 'Any sensor: {entity} is above {above} / below {below}'),
    P('cond.template', 'Template is true'),
    P('action.turn_on', 'Turn on {entity}'),
    P('action.turn_off', 'Turn off {entity}'),
    P('action.toggle', 'Toggle {entity}'),
    P('action.service', 'Call {service}'),
  ] },
];

// ---------- devices ----------
const SKIP_DOMAINS = new Set(['automation', 'zone', 'update', 'sun', 'event', 'image', 'tts', 'stt', 'conversation',
  'persistent_notification', 'todo', 'calendar', 'weather', 'scene', 'script', 'camera', 'assist_satellite', 'wake_word', 'ai_task']);
const DOMAIN_RANK = ['light', 'climate', 'cover', 'lock', 'media_player', 'fan', 'switch', 'vacuum', 'binary_sensor', 'person', 'device_tracker', 'sensor'];

export const isPrimary = (e) => !e.hidden && !e.entity_category;
const rank = (e) => { const i = DOMAIN_RANK.indexOf(e.domain); return i < 0 ? 99 : i; };

// One tile per physical device (plus one per stand-alone entity), grouped later by area.
export function deviceTiles(meta, { showAll = false } = {}) {
  const tiles = [];
  const byDevice = new Map();
  for (const e of meta.entities) {
    if (SKIP_DOMAINS.has(e.domain)) continue;
    if (!showAll && !isPrimary(e)) continue;
    if (e.device_id) {
      if (!byDevice.has(e.device_id)) byDevice.set(e.device_id, []);
      byDevice.get(e.device_id).push(e);
    } else {
      tiles.push({ id: e.entity_id, name: e.name, area: e.area, entities: [e] });
    }
  }
  const devs = Object.fromEntries((meta.devices || []).map((d) => [d.id, d]));
  for (const [id, ents] of byDevice) {
    const d = devs[id];
    ents.sort((a, b) => rank(a) - rank(b));
    tiles.push({ id, name: d?.name || ents[0].device || ents[0].name, area: d?.area || ents[0].area, entities: ents });
  }
  for (const t of tiles) t.icon = domainIcon(t.entities[0].domain, t.entities[0].attrs?.device_class);
  return tiles.sort((a, b) => a.name.localeCompare(b.name));
}

const shortName = (e, deviceName) => {
  const n = e.name || e.entity_id;
  if (deviceName && n.toLowerCase().startsWith(deviceName.toLowerCase())) {
    const rest = n.slice(deviceName.length).trim();
    if (rest) return rest[0].toUpperCase() + rest.slice(1);
  }
  return n;
};

const BINARY = {
  motion: ['Motion detected', 'Motion stopped', 'Detects motion', 'Detects no motion'],
  occupancy: ['Occupancy detected', 'Occupancy cleared', 'Is occupied', 'Is not occupied'],
  presence: ['Presence detected', 'Presence cleared', 'Detects presence', 'Detects no presence'],
  door: ['Opened', 'Closed', 'Is open', 'Is closed'],
  window: ['Opened', 'Closed', 'Is open', 'Is closed'],
  garage_door: ['Opened', 'Closed', 'Is open', 'Is closed'],
  opening: ['Opened', 'Closed', 'Is open', 'Is closed'],
  moisture: ['Water detected', 'Dry again', 'Detects water', 'Is dry'],
  smoke: ['Smoke detected', 'Smoke cleared', 'Detects smoke', 'Detects no smoke'],
  vibration: ['Vibration detected', 'Vibration stopped', 'Is vibrating', 'Is still'],
  plug: ['Plugged in', 'Unplugged', 'Is plugged in', 'Is unplugged'],
};
const ONOFF = new Set(['light', 'switch', 'fan', 'input_boolean', 'humidifier', 'siren']);

// Cards one entity offers for a column (kind), as presets.
function entityCards(e, kind, prefix) {
  const id = e.entity_id;
  const ent = { entity: [id] };
  const out = [];
  const add = (type, text, params = {}, fields = [], extra = {}) => out.push({ type, text: prefix + text, params: { ...ent, ...params }, fields, ...extra });
  const unit = e.attrs?.unit || '';
  const numeric = e.domain === 'sensor' || e.domain === 'input_number' || e.domain === 'number'
    ? unit || (e.state !== '' && !Number.isNaN(Number(e.state))) : false;

  if (ONOFF.has(e.domain)) {
    if (kind === 'trigger') { add('trigger.state', 'Turned on', { to: 'on' }, ['forSeconds']); add('trigger.state', 'Turned off', { to: 'off' }, ['forSeconds']); }
    if (kind === 'condition') { add('cond.state', 'Is on', { state: 'on' }, ['forSeconds']); add('cond.state', 'Is off', { state: 'off' }, ['forSeconds']); }
    if (kind === 'action') {
      add('action.turn_on', 'Turn on'); add('action.turn_off', 'Turn off'); add('action.toggle', 'Toggle');
      if (e.domain === 'light') {
        add('action.light', 'Set brightness to {brightness}%', { brightness: 80 }, ['brightness', 'transition']);
        add('action.light', 'Set colour', { brightness: '', color: '#ffb347' }, ['color', 'brightness', 'transition']);
        add('action.light', 'Set white temperature {kelvin} K', { brightness: '', kelvin: 2700 }, ['kelvin', 'brightness', 'transition']);
      }
    }
  } else if (e.domain === 'binary_sensor') {
    const [on, off, isOn, isOff] = BINARY[e.attrs?.device_class] || ['Turned on', 'Turned off', 'Is on', 'Is off'];
    if (kind === 'trigger') { add('trigger.state', on, { to: 'on' }, ['forSeconds']); add('trigger.state', off, { to: 'off' }, ['forSeconds']); }
    if (kind === 'condition') { add('cond.state', isOn, { state: 'on' }, ['forSeconds']); add('cond.state', isOff, { state: 'off' }, ['forSeconds']); }
  } else if (numeric) {
    if (kind === 'trigger') {
      add('trigger.numeric', 'Rises above {above}', { above: '' }, ['above', 'forSeconds'], { unit });
      add('trigger.numeric', 'Falls below {below}', { below: '' }, ['below', 'forSeconds'], { unit });
      add('trigger.state', 'Changed', { to: '' }, []);
    }
    if (kind === 'condition') {
      add('cond.numeric', 'Is above {above}', { above: '' }, ['above'], { unit });
      add('cond.numeric', 'Is below {below}', { below: '' }, ['below'], { unit });
    }
  } else if (e.domain === 'cover') {
    if (kind === 'trigger') { add('trigger.state', 'Opened', { to: 'open' }); add('trigger.state', 'Closed', { to: 'closed' }); }
    if (kind === 'condition') { add('cond.state', 'Is open', { state: 'open' }); add('cond.state', 'Is closed', { state: 'closed' }); }
    if (kind === 'action') {
      add('action.service', 'Open', { service: 'cover.open_cover' });
      add('action.service', 'Close', { service: 'cover.close_cover' });
      add('action.service', 'Stop', { service: 'cover.stop_cover' });
    }
  } else if (e.domain === 'lock') {
    if (kind === 'trigger') { add('trigger.state', 'Locked', { to: 'locked' }); add('trigger.state', 'Unlocked', { to: 'unlocked' }); }
    if (kind === 'condition') { add('cond.state', 'Is locked', { state: 'locked' }); add('cond.state', 'Is unlocked', { state: 'unlocked' }); }
    if (kind === 'action') { add('action.service', 'Lock', { service: 'lock.lock' }); add('action.service', 'Unlock', { service: 'lock.unlock' }); }
  } else if (e.domain === 'climate') {
    const temp = { attribute: 'current_temperature' };
    if (kind === 'trigger') {
      add('trigger.numeric', 'Temperature rises above {above}', { ...temp, above: '' }, ['above', 'forSeconds'], { unit: '°' });
      add('trigger.numeric', 'Temperature falls below {below}', { ...temp, below: '' }, ['below', 'forSeconds'], { unit: '°' });
      add('trigger.state', 'Mode changes to {to}', { to: '' }, ['to']);
    }
    if (kind === 'condition') {
      add('cond.numeric', 'Temperature is above {above}', { ...temp, above: '' }, ['above'], { unit: '°' });
      add('cond.numeric', 'Temperature is below {below}', { ...temp, below: '' }, ['below'], { unit: '°' });
      add('cond.state', 'Mode is {state}', { state: '' }, ['state']);
    }
    if (kind === 'action') {
      add('action.climate', 'Set temperature to {temperature}°', { temperature: 21 }, ['temperature']);
      add('action.service', 'Turn off', { service: 'climate.turn_off' });
      add('action.service', 'Turn on', { service: 'climate.turn_on' });
    }
  } else if (e.domain === 'media_player') {
    if (kind === 'trigger') { add('trigger.state', 'Starts playing', { to: 'playing' }); add('trigger.state', 'Is paused', { to: 'paused' }); add('trigger.state', 'Turned off', { to: 'off' }); }
    if (kind === 'condition') { add('cond.state', 'Is playing', { state: 'playing' }); add('cond.state', 'Is off', { state: 'off' }); }
    if (kind === 'action') {
      add('action.service', 'Play / pause', { service: 'media_player.media_play_pause' });
      add('action.turn_on', 'Turn on'); add('action.turn_off', 'Turn off');
    }
  } else if (e.domain === 'person' || e.domain === 'device_tracker') {
    if (kind === 'trigger') { add('trigger.state', 'Arrives home', { to: 'home' }); add('trigger.state', 'Leaves home', { from: 'home', to: '' }); }
    if (kind === 'condition') { add('cond.state', 'Is home', { state: 'home' }); add('cond.state', 'Is away', { state: 'not_home' }); }
  } else if (e.domain === 'button' || e.domain === 'input_button') {
    if (kind === 'action') add('action.service', 'Press', { service: `${e.domain}.press` });
  } else if (e.domain === 'vacuum') {
    if (kind === 'trigger') { add('trigger.state', 'Starts cleaning', { to: 'cleaning' }); add('trigger.state', 'Docked', { to: 'docked' }); }
    if (kind === 'condition') add('cond.state', 'Is docked', { state: 'docked' });
    if (kind === 'action') { add('action.service', 'Start cleaning', { service: 'vacuum.start' }); add('action.service', 'Return to dock', { service: 'vacuum.return_to_base' }); }
  } else {
    if (kind === 'trigger') add('trigger.state', 'Changes to {to}', { to: '' }, ['to']);
    if (kind === 'condition') add('cond.state', 'Is {state}', { state: '' }, ['state']);
  }
  return out;
}

// All cards a device tile offers for a column.
export function deviceCards(tile, kind) {
  const multi = tile.entities.length > 1;
  // The device's main entity gets plain labels; extra entities are prefixed with their own name.
  return tile.entities.flatMap((e, i) => entityCards(e, kind, multi && i > 0 ? `${shortName(e, tile.name)}: ` : ''))
    .map((p) => ({ ...p, device: tile.id }));
}

export const appCards = (app, kind) => app.cards.filter((c) => CARDS[c.type].kind === kind).map((c) => ({ ...c, app: app.id }));

export const domainIcon = (domain, deviceClass) => {
  if (domain === 'binary_sensor') {
    if (['door', 'window', 'garage_door', 'opening'].includes(deviceClass)) return 'door';
    if (['motion', 'occupancy', 'presence'].includes(deviceClass)) return 'motion';
  }
  if (domain === 'sensor' && deviceClass === 'temperature') return 'thermo';
  return {
    light: 'bulb', switch: 'plug', input_boolean: 'toggle', sensor: 'pulse', binary_sensor: 'pulse', climate: 'thermo',
    cover: 'cover', lock: 'lock', person: 'person', device_tracker: 'person', media_player: 'media', scene: 'scene',
    automation: 'bolt', zone: 'pin', script: 'code', fan: 'fan', vacuum: 'home', button: 'dot',
  }[domain] || 'dot';
};

export function stateSuggestions(entity) {
  if (!entity) return [];
  if (entity.attrs?.options) return entity.attrs.options;
  const d = entity.domain;
  const map = {
    light: ['on', 'off'], switch: ['on', 'off'], input_boolean: ['on', 'off'], fan: ['on', 'off'], binary_sensor: ['on', 'off'],
    lock: ['locked', 'unlocked'], cover: ['open', 'closed', 'opening', 'closing'], person: ['home', 'not_home'], device_tracker: ['home', 'not_home'],
    media_player: ['playing', 'paused', 'idle', 'on', 'off'], climate: entity.attrs?.hvac_modes || ['heat', 'cool', 'off'],
    automation: ['on', 'off'], scene: [], sun: ['above_horizon', 'below_horizon'],
  };
  return map[d] || [entity.state].filter(Boolean);
}
