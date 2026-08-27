CREATE TABLE customers (
  id TEXT PRIMARY KEY NOT NULL,
  org_id TEXT NOT NULL,
  name TEXT NOT NULL,
  phone TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  address TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX customers_org_id_idx ON customers (org_id);

ALTER TABLE services ADD COLUMN price INTEGER NOT NULL DEFAULT 0;
ALTER TABLE services ADD COLUMN options TEXT NOT NULL DEFAULT '[]';

ALTER TABLE jobs ADD COLUMN customer_id TEXT;
ALTER TABLE jobs ADD COLUMN phone TEXT NOT NULL DEFAULT '';
CREATE INDEX jobs_customer_id_idx ON jobs (customer_id);
