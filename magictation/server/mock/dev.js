// Local development: mock Home Assistant on :8124 plus Magictation on :8099.
import os from 'node:os';
import path from 'node:path';
import { startMock, TOKEN } from './ha-mock.js';

const m = await startMock(8124);
setInterval(() => m.setState('sensor.living_room_temperature', (20 + Math.random() * 4).toFixed(1)), 4000);
process.env.HA_URL = m.url;
process.env.HA_TOKEN = TOKEN;
process.env.DATA_DIR = process.env.DATA_DIR || path.join(os.tmpdir(), 'magictation-dev');
await import('../index.js');
