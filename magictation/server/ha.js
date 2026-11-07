import WebSocket from 'ws';

export class HAClient {
  constructor({ url, token, log = () => {} }) {
    this.base = url.replace(/\/+$/, '');
    this.token = token;
    this.log = log;
    this.wsUrl = (this.base.endsWith('/core') ? `${this.base}/websocket` : `${this.base}/api/websocket`).replace(/^http/, 'ws');
    this.ws = null;
    this.ready = false;
    this.nextId = 1;
    this.pending = new Map();
    this.listeners = new Set();
    this.closed = false;
    this.waiters = [];
  }

  async rest(method, path, body) {
    const res = await fetch(`${this.base}/api${path}`, {
      method,
      headers: { Authorization: `Bearer ${this.token}`, 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    let data;
    try { data = text ? JSON.parse(text) : null; } catch { data = text; }
    if (!res.ok) {
      const err = new Error(`HA ${method} ${path} -> ${res.status}`);
      err.status = res.status;
      err.body = data;
      throw err;
    }
    return data;
  }

  connect() {
    if (this.closed) return;
    const ws = new WebSocket(this.wsUrl);
    this.ws = ws;
    ws.on('message', (raw) => {
      let msg;
      try { msg = JSON.parse(raw.toString()); } catch { return; }
      if (msg.type === 'auth_required') {
        ws.send(JSON.stringify({ type: 'auth', access_token: this.token }));
      } else if (msg.type === 'auth_ok') {
        this.ready = true;
        this.log('info', 'Connected to Home Assistant websocket');
        this.send({ type: 'subscribe_events', event_type: 'state_changed' }).catch(() => {});
        this.waiters.splice(0).forEach((fn) => fn());
      } else if (msg.type === 'auth_invalid') {
        this.log('error', `HA websocket auth failed: ${msg.message}`);
      } else if (msg.type === 'result') {
        const p = this.pending.get(msg.id);
        if (p) {
          this.pending.delete(msg.id);
          msg.success ? p.resolve(msg.result) : p.reject(new Error(msg.error?.message || 'HA error'));
        }
      } else if (msg.type === 'event' && msg.event?.event_type === 'state_changed') {
        const d = msg.event.data;
        this.listeners.forEach((fn) => fn({ entity_id: d.entity_id, state: d.new_state }));
      }
    });
    const retry = () => {
      this.ready = false;
      this.pending.forEach((p) => p.reject(new Error('HA websocket closed')));
      this.pending.clear();
      if (!this.closed) setTimeout(() => this.connect(), 3000);
    };
    ws.on('close', retry);
    ws.on('error', (e) => this.log('warning', `HA websocket error: ${e.message}`));
  }

  whenReady(timeoutMs = 8000) {
    if (this.ready) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error('HA websocket not ready')), timeoutMs);
      this.waiters.push(() => { clearTimeout(t); resolve(); });
    });
  }

  async send(payload) {
    await this.whenReady();
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ ...payload, id }));
    });
  }

  onState(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  close() {
    this.closed = true;
    this.ws?.close();
  }
}
