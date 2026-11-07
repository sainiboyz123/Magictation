import express from 'express';
import crypto from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs';
import { compileFlow, automationId } from './compiler.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function createApp({ ha, store, webDir, log = () => {}, ingressOnly = false }) {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '2mb' }));

  if (ingressOnly) {
    // Supervisor ingress proxies from 172.30.32.2; refuse everything else.
    app.use((req, res, next) => {
      const ip = (req.socket.remoteAddress || '').replace('::ffff:', '');
      if (ip === '172.30.32.2' || ip === '127.0.0.1' || ip === '::1') return next();
      res.status(403).send('Forbidden');
    });
  }

  const wrap = (fn) => (req, res) => fn(req, res).catch((e) => {
    log('error', `${req.method} ${req.path}: ${e.message}`);
    res.status(e.status && e.status < 600 ? 502 : 500).json({ error: e.message, detail: e.body });
  });

  async function findAutomationEntity(flowId, retries = 12) {
    const id = automationId(flowId);
    for (let i = 0; i < retries; i++) {
      const states = await ha.rest('GET', '/states');
      const hit = states.find((s) => s.entity_id.startsWith('automation.') && s.attributes?.id === id);
      if (hit) return hit;
      await sleep(250);
    }
    return null;
  }

  async function deploy(flow) {
    const result = compileFlow(flow);
    if (!result.ok) return { deployed: false, errors: result.errors };
    await ha.rest('POST', `/config/automation/config/${result.automation.id}`, result.automation);
    const ent = await findAutomationEntity(flow.id);
    if (ent) {
      const wantOn = flow.enabled !== false;
      const isOn = ent.state === 'on';
      if (wantOn !== isOn) {
        await ha.rest('POST', `/services/automation/${wantOn ? 'turn_on' : 'turn_off'}`, { entity_id: ent.entity_id });
      }
    }
    return { deployed: true, entity_id: ent?.entity_id || null, errors: [] };
  }

  app.get('/api/health', wrap(async (req, res) => {
    let haOk = false;
    try { await ha.rest('GET', '/'); haOk = true; } catch { /* offline */ }
    res.json({ ok: true, ha: haOk, version: '0.1.0' });
  }));

  app.get('/api/meta', wrap(async (req, res) => {
    const [states, areas, devices, entReg, services] = await Promise.all([
      ha.rest('GET', '/states'),
      ha.send({ type: 'config/area_registry/list' }).catch(() => []),
      ha.send({ type: 'config/device_registry/list' }).catch(() => []),
      ha.send({ type: 'config/entity_registry/list' }).catch(() => []),
      ha.send({ type: 'get_services' }).catch(() => ({})),
    ]);
    const areaName = Object.fromEntries(areas.map((a) => [a.area_id, a.name]));
    const deviceById = Object.fromEntries(devices.map((d) => [d.id, d]));
    const regById = Object.fromEntries(entReg.map((e) => [e.entity_id, e]));
    const entities = states.map((s) => {
      const reg = regById[s.entity_id];
      const dev = reg?.device_id ? deviceById[reg.device_id] : null;
      const areaId = reg?.area_id || dev?.area_id || null;
      const a = s.attributes || {};
      return {
        entity_id: s.entity_id,
        domain: s.entity_id.split('.')[0],
        name: a.friendly_name || s.entity_id,
        state: s.state,
        area: areaId ? areaName[areaId] || areaId : null,
        device: dev ? dev.name_by_user || dev.name : null,
        attrs: {
          unit: a.unit_of_measurement,
          device_class: a.device_class,
          options: a.options,
          min: a.min,
          max: a.max,
          hvac_modes: a.hvac_modes,
        },
      };
    });
    const serviceList = [];
    for (const [domain, svcs] of Object.entries(services || {})) {
      for (const [name, def] of Object.entries(svcs)) serviceList.push({ id: `${domain}.${name}`, name: def.name || name });
    }
    res.json({ entities, areas: areas.map((a) => ({ id: a.area_id, name: a.name })), services: serviceList });
  }));

  app.get('/api/flows', (req, res) => res.json(store.list()));

  app.post('/api/compile', (req, res) => res.json(compileFlow(req.body.flow)));

  const saveFlow = wrap(async (req, res) => {
    const incoming = req.body || {};
    const id = req.params.id || incoming.id || crypto.randomUUID().slice(0, 8);
    const prev = store.get(id);
    const flow = {
      when: [], and: [], then: [], mode: 'single', enabled: true, folder: '',
      ...incoming,
      id,
      createdAt: prev?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    let deployInfo;
    try {
      deployInfo = await deploy(flow);
    } catch (e) {
      deployInfo = { deployed: false, errors: [{ card: null, message: `Home Assistant rejected the flow: ${e.message}` }], detail: e.body };
    }
    flow.deployed = deployInfo.deployed;
    flow.entity_id = deployInfo.entity_id || prev?.entity_id || null;
    store.upsert(flow);
    res.json({ flow, deploy: deployInfo });
  });
  app.post('/api/flows', saveFlow);
  app.put('/api/flows/:id', saveFlow);

  app.delete('/api/flows/:id', wrap(async (req, res) => {
    const flow = store.get(req.params.id);
    if (!flow) return res.status(404).json({ error: 'Flow not found' });
    try {
      await ha.rest('DELETE', `/config/automation/config/${automationId(flow.id)}`);
    } catch (e) {
      if (e.status !== 404) throw e;
    }
    store.remove(flow.id);
    res.json({ ok: true });
  }));

  app.post('/api/flows/:id/enabled', wrap(async (req, res) => {
    const flow = store.get(req.params.id);
    if (!flow) return res.status(404).json({ error: 'Flow not found' });
    flow.enabled = !!req.body.enabled;
    const ent = flow.deployed ? await findAutomationEntity(flow.id, 2) : null;
    if (ent) await ha.rest('POST', `/services/automation/${flow.enabled ? 'turn_on' : 'turn_off'}`, { entity_id: ent.entity_id });
    store.upsert(flow);
    res.json({ flow });
  }));

  app.post('/api/flows/:id/run', wrap(async (req, res) => {
    const flow = store.get(req.params.id);
    if (!flow) return res.status(404).json({ error: 'Flow not found' });
    const ent = flow.deployed ? await findAutomationEntity(flow.id, 2) : null;
    if (!ent) return res.status(409).json({ error: 'Flow is not deployed yet. Fix validation errors and save.' });
    await ha.rest('POST', '/services/automation/trigger', { entity_id: ent.entity_id, skip_condition: !!req.body?.skipConditions });
    res.json({ ok: true });
  }));

  app.get('/api/stream', (req, res) => {
    res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
    res.flushHeaders();
    res.write('retry: 3000\n\n');
    const off = ha.onState(({ entity_id, state }) => {
      if (!state) return;
      res.write(`data: ${JSON.stringify({ entity_id, state: state.state })}\n\n`);
    });
    const hb = setInterval(() => res.write(': hb\n\n'), 20000);
    req.on('close', () => { off(); clearInterval(hb); });
  });

  if (webDir && fs.existsSync(webDir)) {
    app.use(express.static(webDir, { index: 'index.html', maxAge: 0 }));
    app.get('*', (req, res) => res.sendFile(path.join(webDir, 'index.html')));
  }
  return app;
}
