CREATE TABLE auth_challenges (
  id TEXT PRIMARY KEY,
  address TEXT NOT NULL,
  message TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  used INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE merchant_sessions (
  token_hash TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL REFERENCES merchants(id),
  expires_at INTEGER NOT NULL
);
CREATE INDEX sessions_expiry ON merchant_sessions(expires_at);
