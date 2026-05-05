# Aani — Spec

## Vision

Aani is a personal mobile music player for DJ use. The core idea: you
browse Discogs, find a track, download it — all in one app. The library
syncs to the cloud and the player has tempo / pitch control with a live
BPM display for set planning.

---

## Stack

- **Mobile:** Expo (SDK 52+) + Expo Router
- **Audio:** react-native-track-player
- **State:** Zustand
- **Auth:** Clerk (Expo SDK)
- **Database:** Neon (serverless Postgres) + Drizzle ORM
- **Storage:** Cloudflare R2
- **API:** Bun + Hono (Railway)
- **Downloader:** yt-dlp
- **Web:** Next.js (App Router) — companion app on Vercel
- **Monorepo:** Turborepo
- **Language:** TypeScript everywhere, strict mode

---

## Screens & Routes

### Mobile (Expo Router)

| Route | Screen | Auth |
|---|---|---|
| `/sign-in` | Sign In | No |
| `/sign-up` | Sign Up | No |
| `/(tabs)/library` | Track Library | Yes |
| `/(tabs)/playlists` | Playlists | Yes |
| `/(tabs)/playlists/[id]` | Playlist detail | Yes |
| `/(tabs)/downloads` | Downloads | Yes |
| `/(tabs)/settings` | Settings | Yes |
| `/player/[id]` | Player (with Discogs sheet) | Yes |

### Web (Next.js)

| Route | Page | Auth |
|---|---|---|
| `/sign-in`, `/sign-up` | Auth | No |
| `/library` | Track Library | Yes |
| `/playlists`, `/playlists/[id]` | Playlists | Yes |
| `/downloads` | Downloads | Yes |
| `/settings` | Settings | Yes |

---

## Phase 1 — Core Player ✅

- Clerk auth
- Library (file import from device)
- Player: transport controls, seek, playback rate, BPM display
- Playlists + reordering
- Neon + Drizzle, Cloudflare R2

---

## Phase 2 — YouTube downloads ✅

- Bun + Hono API on Railway
- yt-dlp downloads audio, uploads to R2
- BullMQ-style queue for processing jobs
- WebSocket connection: real-time status updates to mobile
- Downloads tab: clipboard-aware "+" button reveals URL input, validates
  YouTube URLs before submit
- Server-side BPM detection on ingest

---

## Phase 3 — Web companion app ✅

- Next.js (App Router) at `apps/web/`, deployed to Vercel
- Same Clerk app as mobile (`@clerk/nextjs`)
- Same API as mobile — no separate backend
- Routes shipped: sign-in / sign-up, library, playlists, downloads, settings
- WebSocket connection to the same API endpoint

---

## Phase 4 — Discogs integration

### Shipped

- Manual enrichment from the player screen: a disc icon opens a sheet
  that searches Discogs by `artist + title`, lets you pick the matching
  release, fetches genres/styles/year/label/cat#/cover, and persists them
  on the track
- Collection and wantlist toggles per release; writes to Discogs and
  mirrors membership in a local `discogs_user_items` cache
- Wantlist note round-trips through Discogs's own notes field
- Header dot signals state at a glance (green = collection, red = wantlist)

### Planned

**Local mirror of collection + wantlist** — paginate the
`/users/{u}/collection/folders/0/releases` and `/users/{u}/wants`
endpoints into a `discogs_user_releases` table. Powers fast scoped
search, reliable auto-matching at ingest, and the future browser. See
TODO.md ("Discogs mirror") for the schema and sync strategy.

**Auto-match at ingest** — after a YouTube download finishes, prompt
"In your collection / wantlist / other?" and run a scoped local search.
If exactly one hit → enrich silently. Otherwise show a small picker.
Depends on the local mirror.

**Custom in-app browser** — a full Discogs browser inside the app.
Search any release, see tracklist + YouTube links, one-tap download
with metadata flowing in from Discogs. Browse your own collection and
wantlist as first-class views.

### Technical notes

- Discogs REST API v2, free, 60 req/min authenticated
- Personal Access Token (no OAuth needed for a single-user app)
- Cover images: `api.discogs.com/images/...`
- YouTube links: `release.videos[]` (used by the future browser)

---

## Phase 5 — Future (no schedule)

**Share Extension** — Native iOS / Android share extension: share a
YouTube URL straight from the browser into Aani without opening it.
Requires Expo bare workflow or a custom native build target.

**Downbeat detection** — Server-side audio analysis at ingest, store
phase + downbeat array on each track. Foundation for beatmatch,
auto-cue, loops, and crossfade-on-the-one. See TODO.md.

**Waveform visualization** — Render a waveform under the seek bar.

**RN New Architecture migration** — Blocked on
react-native-track-player v5 stable or a concrete RN legacy-removal
timeline. See TODO.md.

---

## Data Models

### `tracks` (global, deduped, shared across users)

```
id                  uuid PK
source              text NOT NULL          -- 'youtube' | 'upload' | …
source_id           text                   -- e.g. YouTube video ID
content_hash        text UNIQUE NOT NULL   -- SHA-256 of audio bytes (dedup key)
title               text NOT NULL
artist              text
duration            integer (seconds)
file_key            text NOT NULL          -- R2: tracks/{content_hash}.{ext}
file_size           integer (bytes)
format              text
source_url          text                   -- original URL the track came from
downloaded_at       timestamp DEFAULT now()
discogs_release_id  text                   -- nullable, set after enrichment
discogs_metadata    jsonb                  -- nullable, full enrichment payload
UNIQUE (source, source_id) WHERE source_id IS NOT NULL
```

### `user_tracks` (per-user library)

```
id            uuid PK
user_id       text NOT NULL                -- Clerk user ID
track_id      uuid FK → tracks.id (cascade delete)
added_at      timestamp DEFAULT now()
original_bpm  real                         -- user-specific
local_uri     text                         -- nullable, on-device file URI cache
UNIQUE (user_id, track_id)
```

### `playlists`

```
id          uuid PK
user_id     text
name        text NOT NULL
created_at  timestamp DEFAULT now()
updated_at  timestamp DEFAULT now()
```

### `playlist_tracks`

```
id          uuid PK
playlist_id uuid FK → playlists.id
track_id    uuid FK → tracks.id
position    integer NOT NULL
UNIQUE (playlist_id, track_id)
```

### `playback_state`

```
id             uuid PK
user_id        text
track_id       uuid FK → tracks.id
playback_rate  real DEFAULT 1.0
last_position  integer DEFAULT 0 (seconds)
updated_at     timestamp DEFAULT now()
UNIQUE (user_id, track_id)
```

### `queue_items` (persistent play queue per user)

```
id        uuid PK
user_id   text NOT NULL
track_id  uuid FK → tracks.id
position  integer NOT NULL
added_at  timestamp DEFAULT now()
```

### `user_player_state`

```
user_id           text PK
current_position  integer DEFAULT 0
updated_at        timestamp DEFAULT now()
```

### `download_jobs`

```
id           uuid PK
user_id      text
url          text NOT NULL
youtube_id   text                          -- extracted from URL
status       text                          -- queued | downloading | uploading | completed | failed
title        text
artist       text
duration     integer
track_id     uuid FK → tracks.id           -- set when complete
error        text
created_at   timestamp DEFAULT now()
completed_at timestamp
```

### `discogs_user_items` (membership cache)

```
id           uuid PK
user_id      text NOT NULL
release_id   text NOT NULL                 -- Discogs release ID
type         text NOT NULL                 -- 'collection' | 'wantlist'
synced_at    timestamptz DEFAULT now()
UNIQUE (user_id, release_id, type)
```

Source of truth is always Discogs. This table is a local mirror so
badges render fast without round-tripping to Discogs every screen open.

---

## Deduplication

Tracks are content-addressed. The dedup key is `tracks.content_hash`
(SHA-256 of the audio bytes). The R2 file key follows the hash, so
identical audio uploaded twice resolves to the same R2 object.

For source-based pre-checks (avoid downloading the same YouTube video
twice), there's also a unique index on `(source, source_id)` when
`source_id IS NOT NULL`.

**Ingest flow:**

1. yt-dlp downloads the audio and computes the content hash (or, for
   uploads, the client computes it before upload).
2. If a row in `tracks` already has that `content_hash` → reuse it,
   create only a `user_tracks` row → instant.
3. Otherwise → upload to `tracks/{content_hash}.{ext}` in R2, insert a
   `tracks` row, then insert `user_tracks`.

For YouTube URLs specifically:

```typescript
function extractYoutubeId(url: string): string | null {
  const patterns = [
    /[?&]v=([a-zA-Z0-9_-]{11})/,
    /youtu\.be\/([a-zA-Z0-9_-]{11})/,
  ];
  for (const re of patterns) {
    const m = url.match(re);
    if (m) return m[1];
  }
  return null;
}
```

`source_id` is set to the extracted YouTube ID at ingest, which lets us
short-circuit before downloading: if a track already exists with
`source='youtube'` and that `source_id`, we just link the user without
fetching.

---

## Conventions

- DB: Drizzle ORM, no raw SQL strings (migrations are hand-rolled SQL,
  applied via `npm run db:apply` from `packages/db/`)
- Zustand stores: one per domain (`library`, `player`, `playlists`,
  `downloads`, …)
- Hooks: `use*` prefix, in `hooks/`
- Env vars: `EXPO_PUBLIC_` for client; everything else stays server-side
- R2 access via presigned URLs only; never expose credentials to the client
- Error handling: `{ data, error }` result pattern — no unhandled rejections
- BPM: always store the original; current = `originalBpm * playbackRate`
- Playback rate: float to two decimals (e.g. `1.05`, `0.98`)
- All user-scoped DB queries filter on `userId` (Clerk user ID)
