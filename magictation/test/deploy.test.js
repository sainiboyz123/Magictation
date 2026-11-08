import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startMock, TOKEN } from '../server/mock/ha-mock.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const script = path.join(here, '..', 'scripts', 'deploy-ha.mjs');
const version = /version:\s*"?([^"\n]+)"?/.exec(fs.readFileSync(path.join(here, '..', 'config.yaml'), 'utf8'))[1];

const run = (url, token = TOKEN) => new Promise((resolve) => {
  execFile(process.execPath, [script], { env: { ...process.env, HA_URL: url, HA_TOKEN: token } }, (err, stdout, stderr) => resolve({ code: err?.code || 0, out: stdout + stderr }));
});

test('deploy script adds the repo, installs, starts, then updates to a newer version', async () => {
  const mock = await startMock(0);
  try {
    mock.supervisor.available = version;
    let r = await run(mock.url);
    assert.equal(r.code, 0, r.out);
    assert.equal(mock.supervisor.repos.length, 1);
    assert.equal(mock.supervisor.installed, version);
    assert.equal(mock.supervisor.state, 'started');

    mock.supervisor.installed = '0.0.1';
    r = await run(mock.url);
    assert.equal(r.code, 0, r.out);
    assert.match(r.out, /Updating .* 0\.0\.1 ->/);
    assert.equal(mock.supervisor.installed, version);
    assert.equal(mock.supervisor.repos.length, 1);
  } finally { await mock.close(); }
});

test('deploy script reports a bad token clearly', async () => {
  const mock = await startMock(0);
  try {
    const r = await run(mock.url, 'wrong');
    assert.notEqual(r.code, 0);
    assert.match(r.out, /Could not log in/);
  } finally { await mock.close(); }
});
