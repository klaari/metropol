import {
  pgTable,
  uuid,
  text,
  integer,
  real,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const tracks = pgTable(
  "tracks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull(),
    title: text("title").notNull(),
    artist: text("artist"),
    duration: integer("duration"),
    originalBpm: real("original_bpm"),
    fileKey: text("file_key").notNull(),
    fileSize: integer("file_size"),
    format: text("format"),
    sourceUrl: text("source_url"),
    importedAt: timestamp("imported_at").defaultNow().notNull(),
    lastPlayedAt: timestamp("last_played_at"),
  },
  (table) => [index("tracks_user_id_idx").on(table.userId)],
);

export const playlists = pgTable(
  "playlists",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull(),
    name: text("name").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [index("playlists_user_id_idx").on(table.userId)],
);

export const playlistTracks = pgTable(
  "playlist_tracks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    playlistId: uuid("playlist_id")
      .notNull()
      .references(() => playlists.id, { onDelete: "cascade" }),
    trackId: uuid("track_id")
      .notNull()
      .references(() => tracks.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
  },
  (table) => [
    index("playlist_tracks_playlist_id_idx").on(table.playlistId),
    uniqueIndex("playlist_tracks_playlist_track_idx").on(
      table.playlistId,
      table.trackId,
    ),
  ],
);

export const playbackState = pgTable(
  "playback_state",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull(),
    trackId: uuid("track_id")
      .notNull()
      .references(() => tracks.id, { onDelete: "cascade" }),
    playbackRate: real("playback_rate").default(1.0).notNull(),
    lastPosition: integer("last_position").default(0).notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("playback_state_user_track_idx").on(
      table.userId,
      table.trackId,
    ),
  ],
);

export const downloadJobs = pgTable(
  "download_jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull(),
    url: text("url").notNull(),
    status: text("status").notNull().default("queued"),
    title: text("title"),
    artist: text("artist"),
    duration: integer("duration"),
    trackId: uuid("track_id").references(() => tracks.id, {
      onDelete: "set null",
    }),
    error: text("error"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    completedAt: timestamp("completed_at"),
  },
  (table) => [index("download_jobs_user_id_idx").on(table.userId)],
);
