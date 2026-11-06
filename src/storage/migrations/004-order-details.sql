CREATE TABLE IF NOT EXISTS checkout_details (
  checkout_id TEXT PRIMARY KEY REFERENCES checkouts(id),
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  merchant_name TEXT NOT NULL
);
