const BASE = location.pathname.endsWith('/') ? location.pathname : `${location.pathname}/`;

async function call(method, path, body) {
  const res = await fetch(`${BASE}api/${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

export const api = {
  health: () => call('GET', 'health'),
  meta: () => call('GET', 'meta'),
  flows: () => call('GET', 'flows'),
  save: (flow) => (flow.id ? call('PUT', `flows/${flow.id}`, flow) : call('POST', 'flows', flow)),
  remove: (id) => call('DELETE', `flows/${id}`),
  setEnabled: (id, enabled) => call('POST', `flows/${id}/enabled`, { enabled }),
  run: (id, skipConditions = false) => call('POST', `flows/${id}/run`, { skipConditions }),
  compile: (flow) => call('POST', 'compile', { flow }),
  stream(onState) {
    const es = new EventSource(`${BASE}api/stream`);
    es.onmessage = (e) => { try { onState(JSON.parse(e.data)); } catch { /* ignore */ } };
    return () => es.close();
  },
};
