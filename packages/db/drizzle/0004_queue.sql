-- Queue support: persistent play queue with current-position pointer

CREATE TABLE IF NOT EXISTS queue_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  track_id uuid NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
  position integer NOT NULL,
  added_at timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS queue_items_user_position_idx
  ON queue_items(user_id, position);

CREATE TABLE IF NOT EXISTS user_player_state (
  user_id text PRIMARY KEY,
  current_position integer DEFAULT 0 NOT NULL,
  updated_at timestamp DEFAULT now() NOT NULL
);
