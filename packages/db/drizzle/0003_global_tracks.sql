-- Make tracks global (drop userId, add youtubeId)
ALTER TABLE tracks DROP COLUMN IF EXISTS user_id;
ALTER TABLE tracks ADD COLUMN IF NOT EXISTS youtube_id text UNIQUE;
-- Backfill: set youtube_id = id for existing rows (placeholder)
UPDATE tracks SET youtube_id = id WHERE youtube_id IS NULL;
ALTER TABLE tracks ALTER COLUMN youtube_id SET NOT NULL;

-- Drop old columns no longer on tracks
ALTER TABLE tracks DROP COLUMN IF EXISTS original_bpm;
ALTER TABLE tracks DROP COLUMN IF EXISTS last_played_at;

-- Rename importedAt → downloadedAt if needed (only if imported_at exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tracks' AND column_name = 'imported_at'
  ) THEN
    ALTER TABLE tracks RENAME COLUMN imported_at TO downloaded_at;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tracks' AND column_name = 'downloaded_at'
  ) THEN
    ALTER TABLE tracks ADD COLUMN downloaded_at timestamp DEFAULT now() NOT NULL;
  END IF;
END $$;

-- Create user_tracks
CREATE TABLE IF NOT EXISTS user_tracks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  track_id uuid NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
  added_at timestamp DEFAULT now() NOT NULL,
  original_bpm real,
  UNIQUE(user_id, track_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS user_tracks_user_track_idx ON user_tracks(user_id, track_id);

-- Add youtubeId to download_jobs
ALTER TABLE download_jobs ADD COLUMN IF NOT EXISTS youtube_id text;
