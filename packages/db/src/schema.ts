import { sql } from "drizzle-orm";
import {
  pgTable,
  uuid,
  text,
  integer,
  real,
  timestamp,
  index,
  uniqueIndex,
  jsonb,
} from "drizzle-orm/pg-core";

export type DiscogsMetadata = {
  releaseId: string;
  masterId?: string | null;
  title?: string | null;
  artist?: string | null;
  year?: number | null;
  label?: string | null;
  catalogNumber?: string | null;
  country?: string | null;
  format?: string[] | null;
  genres?: string[] | null;
  styles?: string[] | null;
  coverUrl?: string | null;
  thumbUrl?: string | null;
  resourceUrl?: string | null;
  fetchedAt: string;
};

export const tracks = pgTable(
  "tracks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    source: text("source").notNull(),
    sourceId: text("source_id"),
    contentHash: text("content_hash").notNull().unique(),
    title: text("title").notNull(),
    artist: text("artist"),
    duration: integer("duration"),
    fileKey: text("file_key").notNull(),
    fileSize: integer("file_size"),
    format: text("format"),
    sourceUrl: text("source_url"),
    downloadedAt: timestamp("downloaded_at").defaultNow().notNull(),
    discogsReleaseId: text("discogs_release_id"),
    discogsMetadata: jsonb("discogs_metadata").$type<DiscogsMetadata | null>(),
  },
  (t) => [
    uniqueIndex("tracks_source_source_id_idx")
      .on(t.source, t.sourceId)
      .where(sql`${t.sourceId} IS NOT NULL`),
    index("tracks_discogs_release_id_idx")
      .on(t.discogsReleaseId)
      .where(sql`${t.discogsReleaseId} IS NOT NULL`),
  ],
);

export type DiscogsUserReleaseType = "collection" | "wantlist";

export const discogsUserReleases = pgTable(
  "discogs_user_releases",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull(),
    releaseId: text("release_id").notNull(),
    type: text("type").$type<DiscogsUserReleaseType>().notNull(),
    artist: text("artist"),
    title: text("title"),
    label: text("label"),
    catalogNumber: text("catalog_number"),
    year: integer("year"),
    format: text("format"),
    thumbUrl: text("thumb_url"),
    coverUrl: text("cover_url"),
    folderId: integer("folder_id"),
    instanceId: integer("instance_id"),
    notes: text("notes"),
    dateAdded: timestamp("date_added", { withTimezone: true }),
    searchText: text("search_text"),
    syncedAt: timestamp("synced_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    uniqueIndex("discogs_user_releases_user_release_type_idx").on(
      t.userId,
      t.releaseId,
      t.type,
    ),
    index("discogs_user_releases_user_type_idx").on(t.userId, t.type),
    index("discogs_user_releases_user_date_added_idx").on(
      t.userId,
      t.type,
      t.dateAdded,
    ),
  ],
);

export const userTracks = pgTable(
  "user_tracks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull(),
    trackId: uuid("track_id")
      .notNull()
      .references(() => tracks.id, { onDelete: "cascade" }),
    addedAt: timestamp("added_at").defaultNow().notNull(),
    originalBpm: real("original_bpm"),
    beatOffset: real("beat_offset"),
    localUri: text("local_uri"),
  },
  (t) => [uniqueIndex("user_tracks_user_track_idx").on(t.userId, t.trackId)],
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

export const queueItems = pgTable(
  "queue_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull(),
    trackId: uuid("track_id")
      .notNull()
      .references(() => tracks.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    addedAt: timestamp("added_at").defaultNow().notNull(),
  },
  (table) => [
    index("queue_items_user_position_idx").on(table.userId, table.position),
  ],
);

export const userPlayerState = pgTable("user_player_state", {
  userId: text("user_id").primaryKey(),
  currentPosition: integer("current_position").default(0).notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const downloadJobs = pgTable(
  "download_jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull(),
    url: text("url").notNull(),
    youtubeId: text("youtube_id"),
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
