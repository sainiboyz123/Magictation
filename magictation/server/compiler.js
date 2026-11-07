// Compiles a Magictation flow into a native Home Assistant automation config.
// Flow shape: { id, name, description, mode, when: Card[], and: Card[], then: Card[] }
// Card shape: { id, type, params: {}, slots?: { name: Card[] } }

const pad = (n) => String(n).padStart(2, '0');

export function secondsToHms(total) {
  const s = Math.max(0, Math.round(Number(total) || 0));
  return `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
}

export function toTime(v) {
  if (!v) return undefined;
  const parts = String(v).split(':');
  while (parts.length < 3) parts.push('00');
  return parts.map((p) => pad(p)).join(':');
}

export function asList(v) {
  if (v === undefined || v === null || v === '') return [];
  return Array.isArray(v) ? v.filter(Boolean) : [v];
}

const num = (v) => (v === '' || v === undefined || v === null || Number.isNaN(Number(v)) ? undefined : Number(v));
const clean = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== '' && !(Array.isArray(v) && v.length === 0)));
const domainOf = (id) => String(id).split('.')[0];
const offset = (mins) => {
  const m = num(mins) || 0;
  const sign = m < 0 ? '-' : '';
  return `${sign}${secondsToHms(Math.abs(m) * 60)}`;
};
const slot = (card, name) => (card.slots && card.slots[name]) || [];

function need(errors, card, cond, message) {
  if (!cond) errors.push({ card: card.id, message });
  return cond;
}

function compileTrigger(card, errors) {
  const p = card.params || {};
  switch (card.type) {
    case 'trigger.state': {
      const ids = asList(p.entity);
      if (!need(errors, card, ids.length, 'Pick a device or entity')) return null;
      const dur = num(p.forSeconds);
      return clean({ platform: 'state', entity_id: ids, to: p.to, from: p.from, for: dur ? secondsToHms(dur) : undefined, id: card.id });
    }
    case 'trigger.numeric': {
      const ids = asList(p.entity);
      if (!need(errors, card, ids.length, 'Pick a sensor')) return null;
      if (!need(errors, card, num(p.above) !== undefined || num(p.below) !== undefined, 'Set an "above" or "below" value')) return null;
      const dur = num(p.forSeconds);
      return clean({ platform: 'numeric_state', entity_id: ids, above: num(p.above), below: num(p.below), attribute: p.attribute, for: dur ? secondsToHms(dur) : undefined, id: card.id });
    }
    case 'trigger.time':
      if (!need(errors, card, p.at, 'Pick a time')) return null;
      return { platform: 'time', at: toTime(p.at), id: card.id };
    case 'trigger.interval': {
      const m = num(p.minutes);
      if (!need(errors, card, m && m > 0 && m <= 59, 'Minutes must be 1-59')) return null;
      return { platform: 'time_pattern', minutes: `/${m}`, id: card.id };
    }
    case 'trigger.sun':
      return { platform: 'sun', event: p.event === 'sunrise' ? 'sunrise' : 'sunset', offset: offset(p.offsetMinutes), id: card.id };
    case 'trigger.zone': {
      const ids = asList(p.entity);
      if (!need(errors, card, ids.length, 'Pick a person or device tracker')) return null;
      if (!need(errors, card, p.zone, 'Pick a zone')) return null;
      return { platform: 'zone', entity_id: ids, zone: p.zone, event: p.event === 'leave' ? 'leave' : 'enter', id: card.id };
    }
    case 'trigger.ha':
      return { platform: 'homeassistant', event: p.event === 'shutdown' ? 'shutdown' : 'start', id: card.id };
    case 'trigger.event':
      if (!need(errors, card, p.eventType, 'Enter an event type')) return null;
      return { platform: 'event', event_type: p.eventType, id: card.id };
    default:
      errors.push({ card: card.id, message: `Unknown trigger type ${card.type}` });
      return null;
  }
}

function compileCondition(card, errors) {
  const p = card.params || {};
  switch (card.type) {
    case 'cond.state': {
      const ids = asList(p.entity);
      if (!need(errors, card, ids.length, 'Pick a device or entity')) return null;
      if (!need(errors, card, p.state !== undefined && p.state !== '', 'Pick a state')) return null;
      const dur = num(p.forSeconds);
      return clean({ condition: 'state', entity_id: ids, state: p.state, for: dur ? secondsToHms(dur) : undefined });
    }
    case 'cond.numeric': {
      const ids = asList(p.entity);
      if (!need(errors, card, ids.length, 'Pick a sensor')) return null;
      if (!need(errors, card, num(p.above) !== undefined || num(p.below) !== undefined, 'Set an "above" or "below" value')) return null;
      return clean({ condition: 'numeric_state', entity_id: ids, above: num(p.above), below: num(p.below), attribute: p.attribute });
    }
    case 'cond.time': {
      const days = asList(p.weekdays);
      if (!need(errors, card, p.after || p.before || days.length, 'Set a time range or weekdays')) return null;
      return clean({ condition: 'time', after: toTime(p.after), before: toTime(p.before), weekday: days });
    }
    case 'cond.sun': {
      if (!need(errors, card, p.after || p.before, 'Choose sunrise/sunset')) return null;
      return clean({ condition: 'sun', after: p.after, before: p.before });
    }
    case 'cond.zone': {
      const ids = asList(p.entity);
      if (!need(errors, card, ids.length && p.zone, 'Pick a person and a zone')) return null;
      return { condition: 'zone', entity_id: ids, zone: p.zone };
    }
    case 'cond.template':
      if (!need(errors, card, p.template, 'Enter a template')) return null;
      return { condition: 'template', value_template: p.template };
    case 'cond.group': {
      const mode = ['and', 'or', 'not'].includes(p.mode) ? p.mode : 'and';
      const kids = compileConditions(slot(card, 'conditions'), errors);
      if (!need(errors, card, kids.length, 'Add at least one condition inside the group')) return null;
      return { condition: mode, conditions: kids };
    }
    default:
      errors.push({ card: card.id, message: `Unknown condition type ${card.type}` });
      return null;
  }
}

function compileConditions(cards, errors) {
  return cards.map((c) => compileCondition(c, errors)).filter(Boolean);
}

function entityDomainService(ids, service) {
  const domains = [...new Set(ids.map(domainOf))];
  return domains.length === 1 ? `${domains[0]}.${service}` : `homeassistant.${service}`;
}

function compileAction(card, errors) {
  const p = card.params || {};
  switch (card.type) {
    case 'action.turn_on':
    case 'action.turn_off':
    case 'action.toggle': {
      const ids = asList(p.entity);
      if (!need(errors, card, ids.length, 'Pick a device or entity')) return null;
      const svc = card.type.split('.')[1];
      return { service: entityDomainService(ids, svc), target: { entity_id: ids } };
    }
    case 'action.light': {
      const ids = asList(p.entity);
      if (!need(errors, card, ids.length, 'Pick a light')) return null;
      const data = clean({
        brightness_pct: num(p.brightness),
        color_temp_kelvin: num(p.kelvin),
        rgb_color: p.color ? hexToRgb(p.color) : undefined,
        transition: num(p.transition),
      });
      return { service: 'light.turn_on', target: { entity_id: ids }, data };
    }
    case 'action.climate': {
      const ids = asList(p.entity);
      if (!need(errors, card, ids.length, 'Pick a thermostat')) return null;
      if (!need(errors, card, num(p.temperature) !== undefined, 'Set a temperature')) return null;
      return { service: 'climate.set_temperature', target: { entity_id: ids }, data: { temperature: num(p.temperature) } };
    }
    case 'action.scene': {
      const ids = asList(p.entity);
      if (!need(errors, card, ids.length, 'Pick a scene')) return null;
      return { service: 'scene.turn_on', target: { entity_id: ids } };
    }
    case 'action.notify': {
      if (!need(errors, card, p.message, 'Write a message')) return null;
      const target = String(p.target || 'notify').replace(/^notify\./, '');
      return { service: `notify.${target}`, data: clean({ title: p.title, message: p.message }) };
    }
    case 'action.service': {
      if (!need(errors, card, /^[a-z_0-9]+\.[a-z_0-9]+$/i.test(p.service || ''), 'Enter a service like light.turn_on')) return null;
      const ids = asList(p.entity);
      let data;
      if (p.data) {
        try { data = typeof p.data === 'string' ? JSON.parse(p.data) : p.data; }
        catch { errors.push({ card: card.id, message: 'Service data must be valid JSON' }); return null; }
      }
      return clean({ service: p.service, target: ids.length ? { entity_id: ids } : undefined, data });
    }
    case 'action.delay': {
      if (!need(errors, card, num(p.seconds) > 0, 'Set a delay above 0 seconds')) return null;
      return { delay: secondsToHms(p.seconds) };
    }
    case 'action.wait': {
      const ids = asList(p.entity);
      if (!need(errors, card, ids.length && p.state, 'Pick an entity and state to wait for')) return null;
      const tpl = ids.map((id) => `is_state('${id}', '${String(p.state).replace(/'/g, "\\'")}')`).join(' and ');
      const timeout = num(p.timeoutSeconds);
      return clean({ wait_template: `{{ ${tpl} }}`, timeout: timeout ? secondsToHms(timeout) : undefined, continue_on_timeout: true });
    }
    case 'action.if': {
      const conds = compileConditions(slot(card, 'conditions'), errors);
      if (!need(errors, card, conds.length, 'Add at least one condition to the IF')) return null;
      const thenA = compileActions(slot(card, 'then'), errors);
      if (!need(errors, card, thenA.length, 'Add at least one action to THEN')) return null;
      const elseA = compileActions(slot(card, 'else'), errors);
      return clean({ if: conds, then: thenA, else: elseA });
    }
    case 'action.repeat': {
      const n = num(p.count);
      if (!need(errors, card, n >= 1 && n <= 1000, 'Repeat count must be 1-1000')) return null;
      const seq = compileActions(slot(card, 'sequence'), errors);
      if (!need(errors, card, seq.length, 'Add actions to repeat')) return null;
      return { repeat: { count: n, sequence: seq } };
    }
    case 'action.stop':
      return { stop: p.message || 'Stopped by Magictation flow' };
    default:
      errors.push({ card: card.id, message: `Unknown action type ${card.type}` });
      return null;
  }
}

function compileActions(cards, errors) {
  return cards.map((c) => compileAction(c, errors)).filter(Boolean);
}

export function hexToRgb(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex).trim());
  if (!m) return undefined;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function automationId(flowId) {
  return `magictation_${String(flowId).replace(/[^a-z0-9_]/gi, '_')}`;
}

export function compileFlow(flow) {
  const errors = [];
  const f = flow || {};
  const trigger = (f.when || []).map((c) => compileTrigger(c, errors)).filter(Boolean);
  const condition = compileConditions(f.and || [], errors);
  const action = compileActions(f.then || [], errors);
  if (!(f.when || []).length) errors.push({ card: null, message: 'Add at least one WHEN trigger' });
  if (!(f.then || []).length) errors.push({ card: null, message: 'Add at least one THEN action' });
  if (!String(f.name || '').trim()) errors.push({ card: null, message: 'Give the flow a name' });
  const mode = ['single', 'restart', 'queued', 'parallel'].includes(f.mode) ? f.mode : 'single';
  const automation = clean({
    id: automationId(f.id),
    alias: `[Magictation] ${String(f.name || '').trim()}`,
    description: f.description || 'Managed by Magictation. Edit this flow in the Magictation panel.',
    mode,
    trigger,
    condition,
    action,
  });
  return { ok: errors.length === 0, errors, automation };
}
