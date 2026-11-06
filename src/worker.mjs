import { loadConfig } from './config.mjs';
import { openDatabase } from './db.mjs';
import { createWorker } from './worker-core.mjs';
const config = await loadConfig(),
  db = openDatabase(config.dbPath),
  worker = createWorker(config, db);
let stopping = false;
for (const signal of ['SIGINT', 'SIGTERM'])
  process.on(signal, () => {
    stopping = true;
  });
while (!stopping) {
  try {
    await worker.tick();
  } catch {
    console.error('Worker cycle failed; retained durable state for retry.');
    if (process.argv.includes('--once')) {
      process.exitCode = 1;
      break;
    }
  }
  if (process.argv.includes('--once')) break;
  await new Promise((resolve) => setTimeout(resolve, 1000));
}
db.close();
