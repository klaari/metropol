-- Replace the thin discogs_user_items membership cache with a richer mirror of
-- the user's Discogs collection + wantlist, so we can do local search and
-- scope-filtered matching without paging the Discogs API on every request.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE IF NOT EXISTS discogs_user_releases (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         TEXT NOT NULL,
  release_id      TEXT NOT NULL,
  type            TEXT NOT NULL,
  artist          TEXT,
  title           TEXT,
  label           TEXT,
  catalog_number  TEXT,
  year            INTEGER,
  format          TEXT,
  thumb_url       TEXT,
  cover_url       TEXT,
  folder_id       INTEGER,
  instance_id     INTEGER,
  notes           TEXT,
  date_added      TIMESTAMPTZ,
  search_text     TEXT,
  raw             JSONB,
  synced_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS discogs_user_releases_user_release_type_idx
  ON discogs_user_releases (user_id, release_id, type);

CREATE INDEX IF NOT EXISTS discogs_user_releases_user_type_idx
  ON discogs_user_releases (user_id, type);

CREATE INDEX IF NOT EXISTS discogs_user_releases_search_text_trgm_idx
  ON discogs_user_releases USING gin (search_text gin_trgm_ops);

CREATE INDEX IF NOT EXISTS discogs_user_releases_user_date_added_idx
  ON discogs_user_releases (user_id, type, date_added DESC);

DROP TABLE IF EXISTS discogs_user_items;
