-- Phase 1 of the multi-source + content-hash dedup redesign.
--   * Adds new columns (source / source_id / content_hash) as nullable.
--   * Drops NOT NULL on youtube_id so the new code paths (which write source
--     instead) don't hit a constraint.
--   * Backfills source/source_id from the existing youtube_id.
--
-- After this migration, run apps/api/scripts/backfill-content-hash.ts to
-- populate content_hash and copy R2 objects to the new bucket. THEN apply
-- 0007_dedup_columns_phase2.sql to enforce the final constraints.

ALTER TABLE tracks ADD COLUMN IF NOT EXISTS source text;
ALTER TABLE tracks ADD COLUMN IF NOT EXISTS source_id text;
ALTER TABLE tracks ADD COLUMN IF NOT EXISTS content_hash text;

ALTER TABLE tracks ALTER COLUMN youtube_id DROP NOT NULL;

-- Existing rows: classify direct uploads (which used the youtube_id='upload:{trackId}'
-- workaround) vs real youtube downloads.
UPDATE tracks
SET source = CASE
      WHEN youtube_id LIKE 'upload:%' THEN 'upload'
      ELSE 'youtube'
    END,
    source_id = CASE
      WHEN youtube_id LIKE 'upload:%' THEN NULL
      ELSE youtube_id
    END
WHERE source IS NULL;
