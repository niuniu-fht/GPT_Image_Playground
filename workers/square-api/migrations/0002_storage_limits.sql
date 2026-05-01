ALTER TABLE share_assets ADD COLUMN thumb_byte_size INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS storage_counters (
  key TEXT PRIMARY KEY,
  used_bytes INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL
);

INSERT OR IGNORE INTO storage_counters (key, used_bytes, updated_at)
SELECT
  'r2',
  COALESCE(SUM(byte_size + COALESCE(thumb_byte_size, 0)), 0),
  CAST(strftime('%s', 'now') AS INTEGER) * 1000
FROM share_assets;
