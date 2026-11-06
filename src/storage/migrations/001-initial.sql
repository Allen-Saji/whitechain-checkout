CREATE TABLE IF NOT EXISTS merchants (
  id TEXT PRIMARY KEY,
  payout TEXT NOT NULL,
  api_hash TEXT UNIQUE NOT NULL,
  webhook_url TEXT NOT NULL,
  webhook_secret TEXT NOT NULL,
  daily_gas_budget TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS checkouts (
  id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL REFERENCES merchants(id),
  external_id TEXT NOT NULL,
  amount TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  buyer TEXT,
  state TEXT NOT NULL DEFAULT 'created',
  refunded TEXT NOT NULL DEFAULT '0',
  fulfillment TEXT NOT NULL DEFAULT 'pending',
  created_at INTEGER NOT NULL,
  UNIQUE(merchant_id,external_id)
);

CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY,
  checkout_id TEXT NOT NULL REFERENCES checkouts(id),
  kind TEXT NOT NULL,
  refund_id TEXT,
  amount TEXT NOT NULL,
  deadline INTEGER NOT NULL,
  signer TEXT NOT NULL,
  signature TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued',
  raw_tx TEXT,
  tx_hash TEXT,
  gas_reserved TEXT,
  error TEXT,
  created_at INTEGER NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS payment_once ON jobs(checkout_id) WHERE kind='pay';

CREATE TABLE IF NOT EXISTS refunds (
  id TEXT PRIMARY KEY,
  checkout_id TEXT NOT NULL REFERENCES checkouts(id),
  external_id TEXT NOT NULL,
  amount TEXT NOT NULL,
  deadline INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'created',
  UNIQUE(checkout_id,external_id)
);

CREATE TABLE IF NOT EXISTS chain_events (
  id TEXT PRIMARY KEY,
  checkout_id TEXT NOT NULL,
  type TEXT NOT NULL,
  tx_hash TEXT NOT NULL,
  block_number INTEGER NOT NULL,
  block_hash TEXT NOT NULL,
  payload TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS outbox (
  id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL,
  checkout_id TEXT NOT NULL,
  payload TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  attempts INTEGER NOT NULL DEFAULT 0,
  next_at INTEGER NOT NULL,
  last_http INTEGER,
  last_error TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS gas_reservations (
  job_id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL,
  day TEXT NOT NULL,
  amount TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS checkpoints (
  id INTEGER PRIMARY KEY CHECK(id=1),
  block_number INTEGER NOT NULL,
  block_hash TEXT,
  halted INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS leases (
  name TEXT PRIMARY KEY,
  owner TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS refund_once ON jobs(refund_id) WHERE refund_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS jobs_pending ON jobs(status, created_at);
CREATE INDEX IF NOT EXISTS outbox_due ON outbox(status, next_at);
CREATE INDEX IF NOT EXISTS events_checkout ON chain_events(checkout_id, block_number);
