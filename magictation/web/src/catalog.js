// Card catalog: every trigger, condition and action the editor can place.
// field kinds: entity, state, text, number, time, select, color, textarea, weekdays

export const asList = (v) => (v === undefined || v === null || v === '' ? [] : Array.isArray(v) ? v : [v]);
const names = (ctx, v) => asList(v).map(ctx.name).join(', ') || '…';
const dur = (s) => {
  s = Number(s) || 0;
  if (!s) return '';
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60;
  return [h && `${h}h`, m && `${m}m`, x && `${x}s`].filter(Boolean).join(' ');
};

export const KINDS = {
  trigger: { label: 'WHEN', hint: 'Starts the flow', color: 'cyan', list: 'when' },
  condition: { label: 'AND', hint: 'Only continue if…', color: 'amber', list: 'and' },
  action: { label: 'THEN', hint: 'Do this', color: 'violet', list: 'then' },
};

export const CARDS = {
  // ---------- triggers ----------
  'trigger.state': {
    kind: 'trigger', label: 'Device changes state', icon: 'bolt', desc: 'A device turns on, opens, is detected…',
    defaults: { entity: [], to: '', from: '', forSeconds: '' },
    fields: [
      { key: 'entity', label: 'Device', kind: 'entity', multi: true },
      { key: 'to', label: 'Becomes (state)', kind: 'state', entityKey: 'entity', hint: 'Leave empty for any change' },
      { key: 'from', label: 'Was (optional)', kind: 'state', entityKey: 'entity' },
      { key: 'forSeconds', label: 'For at least (seconds)', kind: 'number' },
    ],
    summary: (p, c) => `${names(c, p.entity)}${p.to ? ` becomes ${p.to}` : ' changes'}${p.forSeconds ? ` for ${dur(p.forSeconds)}` : ''}`,
  },
  'trigger.numeric': {
    kind: 'trigger', label: 'Value crosses a level', icon: 'pulse', desc: 'A sensor goes above or below a number',
    defaults: { entity: [], above: '', below: '', forSeconds: '' },
    fields: [
      { key: 'entity', label: 'Sensor', kind: 'entity', multi: true, domains: ['sensor', 'input_number', 'number', 'climate', 'weather'] },
      { key: 'above', label: 'Goes above', kind: 'number' },
      { key: 'below', label: 'Goes below', kind: 'number' },
      { key: 'forSeconds', label: 'For at least (seconds)', kind: 'number' },
    ],
    summary: (p, c) => `${names(c, p.entity)} ${p.above !== '' ? `> ${p.above}` : ''}${p.above !== '' && p.below !== '' ? ' and ' : ''}${p.below !== '' ? `< ${p.below}` : ''}`,
  },
  'trigger.time': {
    kind: 'trigger', label: 'At a time', icon: 'clock', desc: 'Every day at a set time',
    defaults: { at: '07:00' },
    fields: [{ key: 'at', label: 'Time', kind: 'time' }],
    summary: (p) => `Every day at ${p.at || '…'}`,
  },
  'trigger.interval': {
    kind: 'trigger', label: 'Every few minutes', icon: 'repeat', desc: 'Repeat on an interval',
    defaults: { minutes: 5 },
    fields: [{ key: 'minutes', label: 'Every N minutes (1-59)', kind: 'number' }],
    summary: (p) => `Every ${p.minutes || '…'} minutes`,
  },
  'trigger.sun': {
    kind: 'trigger', label: 'Sunrise or sunset', icon: 'sun', desc: 'With an optional offset',
    defaults: { event: 'sunset', offsetMinutes: 0 },
    fields: [
      { key: 'event', label: 'Event', kind: 'select', options: [['sunrise', 'Sunrise'], ['sunset', 'Sunset']] },
      { key: 'offsetMinutes', label: 'Offset in minutes (negative = before)', kind: 'number' },
    ],
    summary: (p) => `${p.event === 'sunrise' ? 'Sunrise' : 'Sunset'}${Number(p.offsetMinutes) ? ` ${p.offsetMinutes > 0 ? '+' : ''}${p.offsetMinutes}m` : ''}`,
  },
  'trigger.zone': {
    kind: 'trigger', label: 'Someone arrives or leaves', icon: 'pin', desc: 'Person enters or leaves a zone',
    defaults: { entity: [], zone: 'zone.home', event: 'enter' },
    fields: [
      { key: 'entity', label: 'Person', kind: 'entity', multi: true, domains: ['person', 'device_tracker'] },
      { key: 'zone', label: 'Zone', kind: 'entity', domains: ['zone'] },
      { key: 'event', label: 'Event', kind: 'select', options: [['enter', 'Arrives'], ['leave', 'Leaves']] },
    ],
    summary: (p, c) => `${names(c, p.entity)} ${p.event === 'leave' ? 'leaves' : 'arrives at'} ${p.zone ? c.name(p.zone) : '…'}`,
  },
  'trigger.ha': {
    kind: 'trigger', label: 'Home Assistant starts', icon: 'home', desc: 'On startup or shutdown',
    defaults: { event: 'start' },
    fields: [{ key: 'event', label: 'Event', kind: 'select', options: [['start', 'Starts'], ['shutdown', 'Shuts down']] }],
    summary: (p) => `Home Assistant ${p.event === 'shutdown' ? 'shuts down' : 'starts'}`,
  },
  'trigger.event': {
    kind: 'trigger', label: 'Custom event', icon: 'code', desc: 'Fire on any HA event type',
    defaults: { eventType: '' },
    fields: [{ key: 'eventType', label: 'Event type', kind: 'text', placeholder: 'my_custom_event' }],
    summary: (p) => `Event ${p.eventType || '…'}`,
  },

  // ---------- conditions ----------
  'cond.state': {
    kind: 'condition', label: 'Device is in a state', icon: 'toggle', desc: 'Check on/off, open/closed, home/away…',
    defaults: { entity: [], state: '', forSeconds: '' },
    fields: [
      { key: 'entity', label: 'Device', kind: 'entity', multi: true },
      { key: 'state', label: 'State is', kind: 'state', entityKey: 'entity' },
      { key: 'forSeconds', label: 'For at least (seconds)', kind: 'number' },
    ],
    summary: (p, c) => `${names(c, p.entity)} is ${p.state || '…'}`,
  },
  'cond.numeric': {
    kind: 'condition', label: 'Value is above or below', icon: 'pulse', desc: 'Compare a sensor with a number',
    defaults: { entity: [], above: '', below: '' },
    fields: [
      { key: 'entity', label: 'Sensor', kind: 'entity', multi: true, domains: ['sensor', 'input_number', 'number', 'climate', 'weather'] },
      { key: 'above', label: 'Above', kind: 'number' },
      { key: 'below', label: 'Below', kind: 'number' },
    ],
    summary: (p, c) => `${names(c, p.entity)} ${p.above !== '' ? `> ${p.above}` : ''}${p.above !== '' && p.below !== '' ? ' and ' : ''}${p.below !== '' ? `< ${p.below}` : ''}`,
  },
  'cond.time': {
    kind: 'condition', label: 'Time of day / weekday', icon: 'clock', desc: 'Between times, on certain days',
    defaults: { after: '', before: '', weekdays: [] },
    fields: [
      { key: 'after', label: 'After', kind: 'time' },
      { key: 'before', label: 'Before', kind: 'time' },
      { key: 'weekdays', label: 'On days', kind: 'weekdays' },
    ],
    summary: (p) => [p.after && `after ${p.after}`, p.before && `before ${p.before}`, asList(p.weekdays).length && asList(p.weekdays).join(' ')].filter(Boolean).join(', ') || '…',
  },
  'cond.sun': {
    kind: 'condition', label: 'Day or night', icon: 'sun', desc: 'After sunset, before sunrise…',
    defaults: { after: 'sunset', before: 'sunrise' },
    fields: [
      { key: 'after', label: 'After', kind: 'select', options: [['', '—'], ['sunrise', 'Sunrise'], ['sunset', 'Sunset']] },
      { key: 'before', label: 'Before', kind: 'select', options: [['', '—'], ['sunrise', 'Sunrise'], ['sunset', 'Sunset']] },
    ],
    summary: (p) => [p.after && `after ${p.after}`, p.before && `before ${p.before}`].filter(Boolean).join(' and ') || '…',
  },
  'cond.zone': {
    kind: 'condition', label: 'Someone is in a zone', icon: 'pin', desc: 'Presence check',
    defaults: { entity: [], zone: 'zone.home' },
    fields: [
      { key: 'entity', label: 'Person', kind: 'entity', multi: true, domains: ['person', 'device_tracker'] },
      { key: 'zone', label: 'Zone', kind: 'entity', domains: ['zone'] },
    ],
    summary: (p, c) => `${names(c, p.entity)} in ${p.zone ? c.name(p.zone) : '…'}`,
  },
  'cond.template': {
    kind: 'condition', label: 'Template (advanced)', icon: 'code', desc: 'Any Jinja template that returns true',
    defaults: { template: '' },
    fields: [{ key: 'template', label: 'Template', kind: 'textarea', placeholder: "{{ states('sensor.x') | float > 3 }}" }],
    summary: (p) => p.template || '…',
  },
  'cond.group': {
    kind: 'condition', label: 'Logic group (AND / OR / NOT)', icon: 'group', desc: 'Combine several conditions',
    defaults: { mode: 'or' },
    slots: [{ name: 'conditions', label: 'Conditions', kind: 'condition' }],
    fields: [{ key: 'mode', label: 'Match', kind: 'select', options: [['and', 'ALL of these (AND)'], ['or', 'ANY of these (OR)'], ['not', 'NONE of these (NOT)']] }],
    summary: (p, c, card) => `${{ and: 'All', or: 'Any', not: 'None' }[p.mode] || 'All'} of ${(card.slots?.conditions || []).length} conditions`,
  },

  // ---------- actions ----------
  'action.turn_on': {
    kind: 'action', label: 'Turn on', icon: 'power', desc: 'Lights, switches, anything',
    defaults: { entity: [] },
    fields: [{ key: 'entity', label: 'Devices', kind: 'entity', multi: true }],
    summary: (p, c) => `Turn on ${names(c, p.entity)}`,
  },
  'action.turn_off': {
    kind: 'action', label: 'Turn off', icon: 'power', desc: 'Lights, switches, anything',
    defaults: { entity: [] },
    fields: [{ key: 'entity', label: 'Devices', kind: 'entity', multi: true }],
    summary: (p, c) => `Turn off ${names(c, p.entity)}`,
  },
  'action.toggle': {
    kind: 'action', label: 'Toggle', icon: 'toggle', desc: 'Flip current state',
    defaults: { entity: [] },
    fields: [{ key: 'entity', label: 'Devices', kind: 'entity', multi: true }],
    summary: (p, c) => `Toggle ${names(c, p.entity)}`,
  },
  'action.light': {
    kind: 'action', label: 'Set light', icon: 'bulb', desc: 'Brightness, colour, temperature',
    defaults: { entity: [], brightness: 80, kelvin: '', color: '', transition: '' },
    fields: [
      { key: 'entity', label: 'Lights', kind: 'entity', multi: true, domains: ['light'] },
      { key: 'brightness', label: 'Brightness %', kind: 'number' },
      { key: 'kelvin', label: 'White temperature (K)', kind: 'number' },
      { key: 'color', label: 'Colour', kind: 'color' },
      { key: 'transition', label: 'Transition (seconds)', kind: 'number' },
    ],
    summary: (p, c) => `Set ${names(c, p.entity)}${p.brightness !== '' ? ` to ${p.brightness}%` : ''}`,
  },
  'action.climate': {
    kind: 'action', label: 'Set temperature', icon: 'thermo', desc: 'Thermostat target',
    defaults: { entity: [], temperature: 21 },
    fields: [
      { key: 'entity', label: 'Thermostat', kind: 'entity', multi: true, domains: ['climate'] },
      { key: 'temperature', label: 'Target', kind: 'number' },
    ],
    summary: (p, c) => `${names(c, p.entity)} → ${p.temperature}°`,
  },
  'action.scene': {
    kind: 'action', label: 'Activate scene', icon: 'scene', desc: 'Run a saved scene',
    defaults: { entity: [] },
    fields: [{ key: 'entity', label: 'Scene', kind: 'entity', domains: ['scene'] }],
    summary: (p, c) => `Activate ${names(c, p.entity)}`,
  },
  'action.notify': {
    kind: 'action', label: 'Send notification', icon: 'bell', desc: 'Push to a phone or service',
    defaults: { target: 'notify', title: '', message: '' },
    fields: [
      { key: 'target', label: 'Notify service', kind: 'service', prefix: 'notify.' },
      { key: 'title', label: 'Title', kind: 'text' },
      { key: 'message', label: 'Message', kind: 'textarea' },
    ],
    summary: (p) => `Notify: ${p.message || '…'}`,
  },
  'action.service': {
    kind: 'action', label: 'Call a service', icon: 'code', desc: 'Any Home Assistant service',
    defaults: { service: '', entity: [], data: '' },
    fields: [
      { key: 'service', label: 'Service', kind: 'service', placeholder: 'light.turn_on' },
      { key: 'entity', label: 'Target (optional)', kind: 'entity', multi: true },
      { key: 'data', label: 'Data (JSON, optional)', kind: 'textarea', placeholder: '{"brightness_pct": 50}' },
    ],
    summary: (p) => p.service || '…',
  },
  'action.delay': {
    kind: 'action', label: 'Wait (delay)', icon: 'hourglass', desc: 'Pause before the next step',
    defaults: { seconds: 60 },
    fields: [{ key: 'seconds', label: 'Seconds', kind: 'number' }],
    summary: (p) => `Wait ${dur(p.seconds) || '…'}`,
  },
  'action.wait': {
    kind: 'action', label: 'Wait until state', icon: 'hourglass', desc: 'Continue once a device reaches a state',
    defaults: { entity: [], state: '', timeoutSeconds: 300 },
    fields: [
      { key: 'entity', label: 'Device', kind: 'entity', multi: true },
      { key: 'state', label: 'Becomes', kind: 'state', entityKey: 'entity' },
      { key: 'timeoutSeconds', label: 'Give up after (seconds)', kind: 'number' },
    ],
    summary: (p, c) => `Wait until ${names(c, p.entity)} is ${p.state || '…'}`,
  },
  'action.if': {
    kind: 'action', label: 'If / then / else', icon: 'branch', desc: 'Branch the flow on a condition',
    defaults: {},
    slots: [
      { name: 'conditions', label: 'IF', kind: 'condition' },
      { name: 'then', label: 'THEN', kind: 'action' },
      { name: 'else', label: 'ELSE', kind: 'action' },
    ],
    fields: [],
    summary: () => 'Branch on a condition',
  },
  'action.repeat': {
    kind: 'action', label: 'Repeat', icon: 'repeat', desc: 'Run steps several times',
    defaults: { count: 3 },
    slots: [{ name: 'sequence', label: 'REPEAT', kind: 'action' }],
    fields: [{ key: 'count', label: 'Times', kind: 'number' }],
    summary: (p) => `Repeat ${p.count || '…'}×`,
  },
  'action.stop': {
    kind: 'action', label: 'Stop here', icon: 'stop', desc: 'End the flow',
    defaults: { message: '' },
    fields: [{ key: 'message', label: 'Reason (optional)', kind: 'text' }],
    summary: (p) => p.message || 'Stop the flow',
  },
};

export const domainIcon = (domain) => ({
  light: 'bulb', switch: 'toggle', input_boolean: 'toggle', sensor: 'pulse', binary_sensor: 'pulse', climate: 'thermo',
  cover: 'cover', lock: 'lock', person: 'person', device_tracker: 'person', media_player: 'media', scene: 'scene',
  automation: 'bolt', zone: 'pin', script: 'code', fan: 'fan',
}[domain] || 'dot');

export function stateSuggestions(entity) {
  if (!entity) return [];
  if (entity.attrs?.options) return entity.attrs.options;
  const d = entity.domain;
  const map = {
    light: ['on', 'off'], switch: ['on', 'off'], input_boolean: ['on', 'off'], fan: ['on', 'off'], binary_sensor: ['on', 'off'],
    lock: ['locked', 'unlocked'], cover: ['open', 'closed', 'opening', 'closing'], person: ['home', 'not_home'], device_tracker: ['home', 'not_home'],
    media_player: ['playing', 'paused', 'idle', 'on', 'off'], climate: entity.attrs?.hvac_modes || ['heat', 'cool', 'off'],
    automation: ['on', 'off'], scene: [],
  };
  return map[d] || [entity.state].filter(Boolean);
}
