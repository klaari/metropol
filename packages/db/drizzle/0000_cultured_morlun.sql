CREATE TABLE "playback_state" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"track_id" uuid NOT NULL,
	"playback_rate" real DEFAULT 1 NOT NULL,
	"last_position" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "playlist_tracks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"playlist_id" uuid NOT NULL,
	"track_id" uuid NOT NULL,
	"position" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "playlists" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tracks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"title" text NOT NULL,
	"artist" text,
	"duration" integer,
	"original_bpm" real,
	"file_key" text NOT NULL,
	"file_size" integer,
	"format" text,
	"imported_at" timestamp DEFAULT now() NOT NULL,
	"last_played_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "playback_state" ADD CONSTRAINT "playback_state_track_id_tracks_id_fk" FOREIGN KEY ("track_id") REFERENCES "public"."tracks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "playlist_tracks" ADD CONSTRAINT "playlist_tracks_playlist_id_playlists_id_fk" FOREIGN KEY ("playlist_id") REFERENCES "public"."playlists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "playlist_tracks" ADD CONSTRAINT "playlist_tracks_track_id_tracks_id_fk" FOREIGN KEY ("track_id") REFERENCES "public"."tracks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "playback_state_user_track_idx" ON "playback_state" USING btree ("user_id","track_id");--> statement-breakpoint
CREATE INDEX "playlist_tracks_playlist_id_idx" ON "playlist_tracks" USING btree ("playlist_id");--> statement-breakpoint
CREATE INDEX "playlists_user_id_idx" ON "playlists" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "tracks_user_id_idx" ON "tracks" USING btree ("user_id");