import { setTimeout as delay } from 'node:timers/promises';
import { loadConfig } from './config.mjs';
import { openDatabase } from './db.mjs';
import { buildApi } from './api.mjs';
import { createWorker } from './worker-core.mjs';
const config = await loadConfig(),
  db = openDatabase(config.dbPath),
  app = buildApi(config, db),
  worker = createWorker(config, db);
const stop = new AbortController();
let stopping = false;
await app.listen({ host: config.host, port: config.port });
console.log(`Checkout API and worker listening on port ${config.port}.`);
async function runWorker() {
  while (!stop.signal.aborted) {
    try {
      await worker.tick();
    } catch {
      console.error('Worker cycle failed; durable jobs retained for retry.');
    }
    try {
      await delay(1000, undefined, { signal: stop.signal });
    } catch {
      /* Shutdown cancels the idle wait. */
    }
  }
}
const running = runWorker();
async function shutdown() {
  if (stopping) return;
  stopping = true;
  stop.abort();
  await app.close();
  await running;
  db.close();
}
for (const signal of ['SIGINT', 'SIGTERM'])
  process.once(signal, () => {
    void shutdown();
  });
