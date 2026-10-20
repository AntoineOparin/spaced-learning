-- Each record remembers the shape (client schema version) it was written with, so a newer
-- client can upgrade old rows and an older client can refuse rows it doesn't understand.
ALTER TABLE records ADD COLUMN schema_version INTEGER NOT NULL DEFAULT 1;

-- The highest schema version any client has pushed; older clients are refused on push.
INSERT OR IGNORE INTO meta (k, v) VALUES ('schemaVersion', 1);
