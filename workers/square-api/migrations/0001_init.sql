CREATE TABLE IF NOT EXISTS publishers (
  id TEXT PRIMARY KEY,
  token_hash TEXT NOT NULL UNIQUE,
  display_name TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'blocked')),
  created_at INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_publishers_token_hash
  ON publishers(token_hash);

CREATE TABLE IF NOT EXISTS shares (
  id TEXT PRIMARY KEY,
  publisher_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('image', 'task', 'prompt')),
  title TEXT NOT NULL,
  prompt TEXT NOT NULL,
  manifest_json TEXT NOT NULL,
  cover_asset_id TEXT,
  tags_json TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('published', 'pending_review', 'hidden', 'deleted', 'rejected')),
  client_request_id TEXT NOT NULL,
  view_count INTEGER NOT NULL DEFAULT 0,
  report_count INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (publisher_id) REFERENCES publishers(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_shares_publisher_request
  ON shares(publisher_id, client_request_id);

CREATE INDEX IF NOT EXISTS idx_shares_feed
  ON shares(status, kind, created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_shares_publisher
  ON shares(publisher_id, created_at DESC);

CREATE TABLE IF NOT EXISTS share_assets (
  id TEXT PRIMARY KEY,
  share_id TEXT NOT NULL,
  client_asset_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('output', 'origin_input')),
  r2_key TEXT NOT NULL,
  thumb_r2_key TEXT,
  mime_type TEXT NOT NULL,
  byte_size INTEGER NOT NULL,
  width INTEGER,
  height INTEGER,
  content_hash TEXT,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (share_id) REFERENCES shares(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_share_assets_share_client_asset
  ON share_assets(share_id, client_asset_id);

CREATE INDEX IF NOT EXISTS idx_share_assets_share_id
  ON share_assets(share_id);

CREATE TABLE IF NOT EXISTS publisher_quota_days (
  publisher_id TEXT NOT NULL,
  quota_day TEXT NOT NULL,
  media_share_count INTEGER NOT NULL DEFAULT 0,
  prompt_share_count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (publisher_id, quota_day),
  FOREIGN KEY (publisher_id) REFERENCES publishers(id)
);

CREATE TABLE IF NOT EXISTS reports (
  id TEXT PRIMARY KEY,
  share_id TEXT NOT NULL,
  publisher_id TEXT,
  reporter_ip_hash TEXT,
  reason TEXT,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (share_id) REFERENCES shares(id),
  FOREIGN KEY (publisher_id) REFERENCES publishers(id)
);

CREATE INDEX IF NOT EXISTS idx_reports_share_id
  ON reports(share_id);

CREATE TABLE IF NOT EXISTS rate_limits (
  key TEXT PRIMARY KEY,
  window_start INTEGER NOT NULL,
  request_count INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_rate_limits_updated_at
  ON rate_limits(updated_at);
