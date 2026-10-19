-- Generic last-write-wins record store. The server does not need to understand the app's
-- schema: each row is one client record (JSON) keyed by table name and id.
CREATE TABLE IF NOT EXISTS records (
  tbl TEXT NOT NULL,
  id TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  deleted INTEGER NOT NULL DEFAULT 0,
  seq INTEGER NOT NULL,
  data TEXT NOT NULL,
  PRIMARY KEY (tbl, id)
);

CREATE INDEX IF NOT EXISTS records_seq ON records (seq);

-- Monotonic change counter; pulls ask for records with seq greater than their cursor.
CREATE TABLE IF NOT EXISTS meta (
  k TEXT PRIMARY KEY,
  v INTEGER NOT NULL
);

INSERT OR IGNORE INTO meta (k, v) VALUES ('seq', 0);
