import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, chmodSync } from 'node:fs';
import { dirname } from 'node:path';
export function openDatabase(path) {
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(path);
  chmodSync(path, 0o600);
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; PRAGMA foreign_keys=ON;
 CREATE TABLE IF NOT EXISTS merchants(id TEXT PRIMARY KEY,payout TEXT NOT NULL,api_hash TEXT UNIQUE NOT NULL,webhook_url TEXT NOT NULL,webhook_secret TEXT NOT NULL,daily_gas_budget TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS checkouts(id TEXT PRIMARY KEY,merchant_id TEXT NOT NULL REFERENCES merchants(id),external_id TEXT NOT NULL,amount TEXT NOT NULL,expires_at INTEGER NOT NULL,buyer TEXT,state TEXT NOT NULL DEFAULT 'created',refunded TEXT NOT NULL DEFAULT '0',fulfillment TEXT NOT NULL DEFAULT 'pending',created_at INTEGER NOT NULL,UNIQUE(merchant_id,external_id));
 CREATE TABLE IF NOT EXISTS jobs(id TEXT PRIMARY KEY,checkout_id TEXT NOT NULL REFERENCES checkouts(id),kind TEXT NOT NULL,refund_id TEXT,amount TEXT NOT NULL,deadline INTEGER NOT NULL,signer TEXT NOT NULL,signature TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'queued',raw_tx TEXT,tx_hash TEXT,gas_reserved TEXT,error TEXT,created_at INTEGER NOT NULL);
 CREATE UNIQUE INDEX IF NOT EXISTS payment_once ON jobs(checkout_id) WHERE kind='pay';
 CREATE TABLE IF NOT EXISTS refunds(id TEXT PRIMARY KEY,checkout_id TEXT NOT NULL REFERENCES checkouts(id),external_id TEXT NOT NULL,amount TEXT NOT NULL,deadline INTEGER NOT NULL,status TEXT NOT NULL DEFAULT 'created',UNIQUE(checkout_id,external_id));
 CREATE TABLE IF NOT EXISTS chain_events(id TEXT PRIMARY KEY,checkout_id TEXT NOT NULL,type TEXT NOT NULL,tx_hash TEXT NOT NULL,block_number INTEGER NOT NULL,block_hash TEXT NOT NULL,payload TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS outbox(id TEXT PRIMARY KEY,merchant_id TEXT NOT NULL,checkout_id TEXT NOT NULL,payload TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'pending',attempts INTEGER NOT NULL DEFAULT 0,next_at INTEGER NOT NULL,last_http INTEGER,last_error TEXT,created_at INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS gas_reservations(job_id TEXT PRIMARY KEY,merchant_id TEXT NOT NULL,day TEXT NOT NULL,amount TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS checkpoints(id INTEGER PRIMARY KEY CHECK(id=1),block_number INTEGER NOT NULL,block_hash TEXT,halted INTEGER NOT NULL DEFAULT 0);
 CREATE TABLE IF NOT EXISTS leases(name TEXT PRIMARY KEY,owner TEXT NOT NULL,expires_at INTEGER NOT NULL);
 `);
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
export function reserveGas(db, job, merchant, cost, now = Date.now()) {
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
