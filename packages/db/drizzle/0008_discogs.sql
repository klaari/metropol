ALTER TABLE tracks ADD COLUMN IF NOT EXISTS discogs_release_id TEXT;

ALTER TABLE tracks ADD COLUMN IF NOT EXISTS discogs_metadata JSONB;

CREATE INDEX IF NOT EXISTS tracks_discogs_release_id_idx
  ON tracks (discogs_release_id)
  WHERE discogs_release_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS discogs_user_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  release_id TEXT NOT NULL,
  type TEXT NOT NULL,
  note TEXT,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS discogs_user_items_user_release_type_idx
  ON discogs_user_items (user_id, release_id, type);

CREATE INDEX IF NOT EXISTS discogs_user_items_user_idx
  ON discogs_user_items (user_id);
