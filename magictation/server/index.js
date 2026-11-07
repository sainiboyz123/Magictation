import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { HAClient } from './ha.js';
import { FlowStore } from './store.js';
import { createApp } from './app.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const levels = { debug: 0, info: 1, warning: 2, error: 3 };
let options = {};
try { options = JSON.parse(fs.readFileSync('/data/options.json', 'utf8')); } catch { /* not in add-on */ }
const threshold = levels[process.env.LOG_LEVEL || options.log_level || 'info'] ?? 1;
const log = (level, msg) => { if ((levels[level] ?? 1) >= threshold) console.log(`[${new Date().toISOString()}] ${level.toUpperCase()} ${msg}`); };

const token = process.env.HA_TOKEN || process.env.SUPERVISOR_TOKEN;
const url = process.env.HA_URL || 'http://supervisor/core';
const dataDir = process.env.DATA_DIR || (fs.existsSync('/data') ? '/data' : path.join(here, '..', '.data'));
const port = Number(process.env.PORT || 8099);

if (!token) {
  log('error', 'No SUPERVISOR_TOKEN or HA_TOKEN available. Cannot talk to Home Assistant.');
  process.exit(1);
}

const ha = new HAClient({ url, token, log });
ha.connect();
const store = new FlowStore(dataDir);
const app = createApp({
  ha,
  store,
  log,
  webDir: path.join(here, '..', 'web', 'dist'),
  ingressOnly: !!process.env.SUPERVISOR_TOKEN && !process.env.ALLOW_ANY,
});

app.listen(port, '0.0.0.0', () => log('info', `Magictation listening on :${port} (HA at ${url}, ${store.list().length} flows)`));
process.on('SIGTERM', () => { ha.close(); process.exit(0); });
