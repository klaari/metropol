-- Per-device local copy of the audio so the player can read from disk
-- (file://) instead of streaming from R2 on every play.
ALTER TABLE user_tracks ADD COLUMN IF NOT EXISTS local_uri text;
