import fs from 'node:fs';
import path from 'node:path';

export class FlowStore {
  constructor(dir) {
    this.file = path.join(dir, 'flows.json');
    fs.mkdirSync(dir, { recursive: true });
    this.flows = [];
    try {
      this.flows = JSON.parse(fs.readFileSync(this.file, 'utf8')).flows || [];
    } catch {
      this.flows = [];
    }
  }

  persist() {
    const tmp = `${this.file}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify({ flows: this.flows }, null, 2));
    fs.renameSync(tmp, this.file);
  }

  list() { return this.flows; }
  get(id) { return this.flows.find((f) => f.id === id); }

  upsert(flow) {
    const i = this.flows.findIndex((f) => f.id === flow.id);
    if (i >= 0) this.flows[i] = flow; else this.flows.push(flow);
    this.persist();
    return flow;
  }

  remove(id) {
    const before = this.flows.length;
    this.flows = this.flows.filter((f) => f.id !== id);
    this.persist();
    return this.flows.length < before;
  }
}
