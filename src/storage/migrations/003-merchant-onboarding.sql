CREATE TABLE merchant_profiles (
  merchant_id TEXT PRIMARY KEY REFERENCES merchants(id),
  business_name TEXT NOT NULL,
  webhook_verified_at INTEGER,
  webhook_checked_at INTEGER,
  webhook_last_http INTEGER,
  webhook_last_error TEXT,
  settings_version INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE registration_challenges (
  id TEXT PRIMARY KEY,
  address TEXT NOT NULL,
  business_name TEXT NOT NULL,
  message TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  used INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX registration_expiry ON registration_challenges(expires_at);
CREATE INDEX IF NOT EXISTS merchant_payout ON merchants(lower(payout));
