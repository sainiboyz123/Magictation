#!/usr/bin/env node
// Installs or updates the Magictation app on a Home Assistant OS / Supervised system
// using the Supervisor API through Home Assistant's websocket (admin token required).
//
//   node magictation/scripts/deploy-ha.mjs
//
// HA_URL   defaults to http://192.168.68.54:8123
// HA_TOKEN or the file %USERPROFILE%/.magictation/ha_token (a long-lived access token)
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { HAClient } from '../server/ha.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const REPO = 'https://github.com/sainiboyz123/Magictation';
const HA_URL = (process.env.HA_URL || 'http://192.168.68.54:8123').replace(/\/+$/, '');
const tokenFile = path.join(os.homedir(), '.magictation', 'ha_token');
const tokenPath = [tokenFile, `${tokenFile}.txt`].find((p) => fs.existsSync(p) && fs.readFileSync(p, 'utf8').trim());
const TOKEN = process.env.HA_TOKEN || (tokenPath ? fs.readFileSync(tokenPath, 'utf8').replace(/^﻿/, '').trim() : '');
const localVersion = /version:\s*"?([^"\n]+)"?/.exec(fs.readFileSync(path.join(here, '..', 'config.yaml'), 'utf8'))[1].trim();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log('[deploy]', ...a);

if (!TOKEN) {
  console.error(`No token. Create a long-lived access token in Home Assistant (your profile > Security) and save it to ${tokenFile}`);
  process.exit(2);
}

const ha = new HAClient({
  url: HA_URL,
  token: TOKEN,
  log: (lvl, msg) => {
    if (/auth failed/.test(msg)) {
      console.error(`Could not log in to ${HA_URL}: the token was rejected. Create a new long-lived token and save it to ${tokenFile}`);
      process.exit(3);
    }
  },
});
ha.connect();
try {
  await ha.whenReady(15000);
} catch {
  console.error(`Could not log in to ${HA_URL}. Check that the address is right and the token is valid.`);
  process.exit(3);
}

const sup = (endpoint, method = 'get', data) => ha.send({ type: 'supervisor/api', endpoint, method, ...(data ? { data } : {}), timeout: null });

async function findApp() {
  const store = await sup('/store');
  return { store, app: (store.addons || []).find((a) => a.slug === 'magictation' || a.slug.endsWith('_magictation')) };
}

try {
  log(`Home Assistant ${HA_URL}, local version ${localVersion}`);
  let { store, app } = await findApp();
  const hasRepo = (store.repositories || []).some((r) => (r.source || r.url || '').toLowerCase().replace(/\.git$/, '') === REPO.toLowerCase());
  if (!hasRepo) {
    log('Adding the Magictation repository to the app store');
    await sup('/store/repositories', 'post', { repository: REPO });
  }

  // GitHub can take a moment to serve the new commit; reload until the store sees our version.
  for (let i = 0; i < 6; i++) {
    await sup('/store/reload', 'post');
    ({ app } = await findApp());
    if (app && (app.version_latest || app.version) === localVersion) break;
    log(`Store shows ${app ? app.version_latest || app.version : 'nothing yet'}, waiting for ${localVersion}…`);
    await sleep(15000);
  }
  if (!app) throw new Error('Magictation is not in the app store after adding the repository');
  const slug = app.slug;
  const latest = app.version_latest || app.version;
  if (latest !== localVersion) log(`Warning: store still offers ${latest}, not ${localVersion}. Did you push?`);

  if (!app.installed) {
    log(`Installing ${slug} ${latest} (builds on the HA host, can take several minutes)…`);
    await sup(`/store/addons/${slug}/install`, 'post');
    await sup(`/addons/${slug}/options`, 'post', { ingress_panel: true }).catch(() => {});
  } else {
    const info = await sup(`/addons/${slug}/info`);
    if (info.version === latest) log(`Already on ${latest}`);
    else {
      log(`Updating ${slug} ${info.version} -> ${latest} (builds on the HA host, can take several minutes)…`);
      await sup(`/store/addons/${slug}/update`, 'post').catch(() => sup(`/addons/${slug}/update`, 'post'));
    }
  }

  let info = await sup(`/addons/${slug}/info`);
  if (info.state !== 'started') {
    log('Starting the app');
    await sup(`/addons/${slug}/start`, 'post');
  }
  for (let i = 0; i < 10; i++) {
    info = await sup(`/addons/${slug}/info`);
    if (info.state === 'started') break;
    await sleep(2000);
  }
  log(`Installed version ${info.version}, state ${info.state}`);

  // Health check through Home Assistant's ingress is not reachable with a token, so read the app log instead.
  const res = await fetch(`${HA_URL}/api/hassio/addons/${slug}/logs`, { headers: { Authorization: `Bearer ${TOKEN}` } }).catch(() => null);
  if (res?.ok) {
    const lines = (await res.text()).trim().split('\n').slice(-12).join('\n');
    log(`Last log lines:\n${lines}`);
  }
  if (info.state !== 'started') process.exitCode = 1;
} catch (e) {
  console.error(`[deploy] Failed: ${e.message}`);
  process.exitCode = 1;
} finally {
  ha.close();
}
