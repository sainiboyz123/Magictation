import { startMock, TOKEN } from './ha-mock.js';

const m = await startMock(8124);
console.log(`Mock HA on ${m.url}  token=${TOKEN}`);
// wiggle a sensor so live state updates are visible in the UI
setInterval(() => m.setState('sensor.living_room_temperature', (20 + Math.random() * 4).toFixed(1)), 4000);
