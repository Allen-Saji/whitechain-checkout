import { loadConfig } from './config.mjs';
import { openDatabase } from './db.mjs';
import { buildApi } from './api.mjs';
const config = await loadConfig(),
  db = openDatabase(config.dbPath),
  app = buildApi(config, db);
await app.listen({ host: config.host, port: config.port });
console.log(`Checkout API listening on port ${config.port}`);
for (const signal of ['SIGINT', 'SIGTERM'])
  process.once(signal, async () => {
    await app.close();
    db.close();
  });
