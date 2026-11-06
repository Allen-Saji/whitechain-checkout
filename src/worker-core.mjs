import { randomUUID } from 'node:crypto';
import { transaction } from './db.mjs';
import { createRelay } from './workers/relay.mjs';
import { createIndexer } from './workers/indexer.mjs';
import { createOutbox } from './workers/outbox.mjs';
export function createWorker(config, db, { fetcher = fetch } = {}) {
  const owner = randomUUID();
  const owns = () =>
    db
      .prepare(
        "SELECT 1 FROM leases WHERE name='worker' AND owner=? AND expires_at>?",
      )
      .get(owner, Date.now());
  const relay = createRelay(config, db, owns),
    index = createIndexer(config, db, owns),
    deliver = createOutbox(db, owns, fetcher);
  async function tick() {
    if (config.relayEnabled === false) return false;
    const acquired = transaction(db, () => {
      db.prepare(
        "INSERT INTO leases VALUES('worker',?,?) ON CONFLICT(name) DO UPDATE SET owner=excluded.owner,expires_at=excluded.expires_at WHERE leases.expires_at<=?",
      ).run(owner, Date.now() + 120000, Date.now());
      return !!owns();
    });
    if (!acquired) return false;
    const heartbeat = setInterval(
      () =>
        db
          .prepare(
            "UPDATE leases SET expires_at=? WHERE name='worker' AND owner=?",
          )
          .run(Date.now() + 120000, owner),
      20000,
    );
    try {
      db.prepare(
        "UPDATE refunds SET status='expired' WHERE status='created' AND deadline<=?",
      ).run(Math.floor(Date.now() / 1000));
      await index();
      await relay();
      await deliver();
      return true;
    } finally {
      clearInterval(heartbeat);
      db.prepare("DELETE FROM leases WHERE name='worker' AND owner=?").run(
        owner,
      );
    }
  }
  return { tick };
}
