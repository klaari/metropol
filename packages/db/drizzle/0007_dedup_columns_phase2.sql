-- Phase 2 of the multi-source + content-hash dedup redesign.
-- ONLY apply this AFTER apps/api/scripts/backfill-content-hash.ts has finished
-- — it requires every tracks row to have a non-null content_hash and the new
-- file_key to point at tracks/{content_hash}.{ext}.

ALTER TABLE tracks ALTER COLUMN source SET NOT NULL;
ALTER TABLE tracks ALTER COLUMN content_hash SET NOT NULL;

ALTER TABLE tracks ADD CONSTRAINT tracks_content_hash_unique UNIQUE (content_hash);

CREATE UNIQUE INDEX IF NOT EXISTS tracks_source_source_id_idx
  ON tracks (source, source_id)
  WHERE source_id IS NOT NULL;

-- Drop the legacy column. Anything still reading youtube_id at this point is a bug.
ALTER TABLE tracks DROP COLUMN IF EXISTS youtube_id;
