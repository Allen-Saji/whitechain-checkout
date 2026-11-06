import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, chmodSync, readFileSync } from 'node:fs';
import { dirname } from 'node:path';
export function openDatabase(path) {
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(path);
  chmodSync(path, 0o600);
  try {
    db.exec(
      'PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; PRAGMA foreign_keys=ON;',
    );
    transaction(db, () => {
      const version = db.prepare('PRAGMA user_version').get().user_version;
      if (version > 4) throw Error('DATABASE_VERSION_TOO_NEW');
      if (version === 0) {
        db.exec(
          readFileSync(
            new URL('./storage/migrations/001-initial.sql', import.meta.url),
            'utf8',
          ),
        );
        db.exec('PRAGMA user_version=1');
      }
      if (version < 2) {
        db.exec(
          readFileSync(
            new URL(
              './storage/migrations/002-wallet-sessions.sql',
              import.meta.url,
            ),
            'utf8',
          ),
        );
        db.exec('PRAGMA user_version=2');
      }
      if (version < 3) {
        db.exec(
          readFileSync(
            new URL(
              './storage/migrations/003-merchant-onboarding.sql',
              import.meta.url,
            ),
            'utf8',
          ),
        );
        db.exec('PRAGMA user_version=3');
      }
      if (version < 4) {
        db.exec(
          readFileSync(
            new URL(
              './storage/migrations/004-order-details.sql',
              import.meta.url,
            ),
            'utf8',
          ),
        );
        db.exec('PRAGMA user_version=4');
      }
    });
  } catch (error) {
    db.close();
    throw error;
  }
  return db;
}
export function transaction(db, fn) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const value = fn();
    db.exec('COMMIT');
    return value;
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}
export function reserveGas(
  db,
  job,
  merchant,
  cost,
  now = Date.now(),
  globalBudget = null,
) {
  return transaction(db, () => {
    const prior = db
      .prepare('SELECT * FROM gas_reservations WHERE job_id=?')
      .get(job.id);
    if (prior && BigInt(prior.amount) >= cost) return;
    const day = new Date(now).toISOString().slice(0, 10);
    const used = db
      .prepare(
        'SELECT amount FROM gas_reservations WHERE merchant_id=? AND day=?',
      )
      .all(merchant.id, day)
      .reduce((sum, row) => sum + BigInt(row.amount), 0n);
    if (globalBudget !== null) {
      const globalUsed = db
        .prepare('SELECT amount FROM gas_reservations WHERE day=?')
        .all(day)
        .reduce((sum, row) => sum + BigInt(row.amount), 0n);
      const replace = prior?.day === day ? BigInt(prior.amount) : 0n;
      if (globalUsed - replace + cost > BigInt(globalBudget))
        throw Error('GLOBAL_GAS_BUDGET');
    }
    const priorToday = prior?.day === day ? BigInt(prior.amount) : 0n;
    if (used - priorToday + cost > BigInt(merchant.daily_gas_budget))
      throw Error('MERCHANT_GAS_BUDGET');
    db.prepare(
      'INSERT INTO gas_reservations VALUES(?,?,?,?) ON CONFLICT(job_id) DO UPDATE SET day=excluded.day,amount=excluded.amount',
    ).run(job.id, merchant.id, day, cost.toString());
    db.prepare('UPDATE jobs SET gas_reserved=? WHERE id=?').run(
      cost.toString(),
      job.id,
    );
  });
}
