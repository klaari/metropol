# Aani TODO

## 🔮 Later: Share Extension (iOS + Android)

**Priority:** Low (future)
**Description:**
Native share extension that lets you share a YouTube URL straight from the
browser or YouTube app into Aani without opening the app first.

**Flow:**
1. In the browser or YouTube → "Share" → pick Aani
2. Extension runs in the background and posts the URL to the API
3. Download starts in the background; the app doesn't need to be opened

**Technical notes:**
- iOS: App Extension (Share Extension) — needs Expo bare workflow or a custom native module
- Android: intent filter + background task
- Likely requires leaving Expo managed workflow or using an EAS custom build target
- Revisit once the clipboard flow is shipped and validated

---

## 🔜 Task: Search — follow-up work

**Priority:** Medium
**Description:**
Library search v1 is shipped. Follow-up:
- Filters: BPM range, key, genre, label, year
- Sort options: recently played, recently added, BPM
- Global search (library + Discogs in one input)
- "Find a compatible next track from the current BPM range" (mixing groundwork)

---

## 🔜 Task: Downbeat detection

**Priority:** Medium
**Description:**
Detect the downbeats (the "1" of each bar) so we can later build mixing
features: beatmatch, two-deck sync, auto-cue to next downbeat, loop
boundaries, transition effects.

**Future mixing use cases (motivation):**
- Beatmatch: align two tracks' bars automatically
- Auto-cue: jump to the next downbeat
- Loop: 4 / 8 / 16-bar loops snapped to downbeats
- Crossfade: switch tracks on the "1"

**Technical notes:**
- BPM alone isn't enough — we need the phase (first-downbeat offset)
- Options:
  1. Server-side analysis at ingest (e.g. `essentia`, `madmom`, `librosa`),
     store `downbeats: number[]` (seconds) on the `tracks` row
  2. Client-side analysis via a native module (heavy on mobile)
  3. Manual: user tap-tempo + a "mark first downbeat" gesture
- Start with server-side analysis as part of the Phase 2 yt-dlp pipeline
- Schema: add `firstDownbeatMs` and/or a `downbeats` JSONB column to `tracks`

**Phasing:**
1. Schema + storage (downbeat array per track)
2. Visualization in the player (e.g. tick marks over a waveform)
3. Auto-cue / loop actions
4. Beatmatch between two decks (needs a dual-deck UI)

---

## 🔮 Later: DJ-style mixing (crossfade + 3-band EQ)

**Priority:** Undecided — not committed yet, captured for research.
**Description:**
Two-deck mixing inside Aani: play two tracks simultaneously with a
crossfader between them and a per-deck 3-band EQ (low / mid / high), the
way a DJ mixer works.

**Open question — is this in scope?**
This shifts Aani from "music player with rate control" toward a DJ tool.
Decide before committing:
- How often would mixing actually be used vs. plain playback?
- Mixer UI is a separate screen, not a tweak to the existing player.
- Background playback / lock-screen controls don't map cleanly onto a
  two-deck mixer — the mixer is a foreground-only feature.

**Technical notes:**
- RNTP is single-track + queue. It cannot host two simultaneous sources
  with independent gain and filter chains, so the mixer needs a different
  audio engine. Crossfade is not a built-in RNTP feature either.
- `react-native-audio-api` (Software Mansion) is the natural fit — Web
  Audio API for RN. Mapping:
  - Crossfade → two `GainNode`s with linear/equal-power ramps
  - 3-band EQ per deck → `BiquadFilterNode` chain: low-shelf (≈ 80 Hz) →
    peaking (≈ 1 kHz) → high-shelf (≈ 10 kHz), each ±12 dB or so
  - Tempo/pitch already lives in our store; rate adjustment per deck
    stays the same model (`currentBpm = originalBpm * playbackRate`)
- Likely architecture: keep RNTP as the default playback engine (lock
  screen, notifications, queue) and instantiate `react-native-audio-api`
  only on the mixer screen. Two engines coexisting means careful audio
  session handling — only one of them owns output at a time.
- Alternative: migrate the whole player to `react-native-audio-api` and
  rebuild lock-screen / notification plumbing ourselves. Bigger lift, but
  one engine.
- Beatmatch / auto-cue depend on the **Downbeat detection** task above.

**Source for the engine choice:**
- RNTP issue #2629 (2026-04, "RNTP Alternatives") — alternatives surveyed
  by the community: `react-native-audio-api`, `react-native-nitro-player`,
  `expo-audio` (SDK 55+), `react-native-audio-browser`. Audio-api is the
  only one of these built around the multi-source / filter-graph model
  that mixing requires.

**If we commit, suggested phasing:**
1. Spike: load two tracks in `react-native-audio-api`, wire a single
   crossfade gain ramp, confirm the engine can coexist with RNTP.
2. Mixer screen UI: two deck strips + crossfader + three EQ knobs each.
3. Per-deck rate control reusing the existing rate model.
4. Beatmatch / auto-cue (depends on downbeat detection landing).

---

## 🔜 Task: Discogs mirror (local sync of collection + wantlist)

**Priority:** High
**Description:**
Sync collection + wantlist from Discogs into a local Postgres table so we
can do fast search, scope-filtered matching, and browsing without
hammering the Discogs API on every request.

**Why this comes before auto-matching or the browser:**
- Discogs's `database/search?q=...` returns at most 25 hits per query and
  uses its own ranking. "Filter the response by `user_data`" is not
  exhaustive: if the right release isn't in the top 25, scope-filtered
  search returns empty even though you own it.
- The website's "Export to CSV" button is **not** API-accessible — it
  emails a link, can't be triggered programmatically.
- The same data is fully exposed via the regular paginated endpoints:
  `GET /users/{u}/collection/folders/0/releases?per_page=100&page=N` and
  `GET /users/{u}/wants?per_page=100&page=N`. Each item carries a
  `basic_information` block with artist / title / label / catno / year /
  format / thumb already populated — no per-release follow-up calls.
- See https://github.com/fscm/discogs2xlsx — same approach: paginate
  through the API and write the result to xlsx. We'd write to Postgres.

**Cost:** for the `kair` account, 6291 + 3055 = 9346 items → 94 requests
(at 100/page) → ~95 s under the 60 req/min ceiling. One-time job, not a
request handler.

**Schema:** replace the current `discogs_user_items` table with a richer
version (the current table is a strict subset):

```sql
CREATE TABLE discogs_user_releases (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         TEXT NOT NULL,
  release_id      TEXT NOT NULL,
  type            TEXT NOT NULL,         -- 'collection' | 'wantlist'
  artist          TEXT,
  title           TEXT,
  label           TEXT,
  catalog_number  TEXT,
  year            INTEGER,
  format          TEXT,
  thumb_url       TEXT,
  cover_url       TEXT,
  folder_id       INTEGER,                -- collection only
  instance_id     INTEGER,                -- collection only
  notes           TEXT,                   -- wantlist note from Discogs
  search_text     TEXT,                   -- "artist title label catno year"
  raw             JSONB,                  -- full Discogs row, for future fields
  synced_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX ON discogs_user_releases (user_id, release_id, type);
CREATE INDEX ON discogs_user_releases (user_id, type);
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX ON discogs_user_releases USING gin (search_text gin_trgm_ops);
```

**API surface:**
- `POST /discogs/sync` — full sync via API, idempotent.
  Returns `{ collection: 6291, wantlist: 3055, durationMs }`.
- `GET /discogs/local-search?q=...&scope=collection|wantlist|any&limit=10`
  — trigram-ranked local search, sub-millisecond response.
- `POST /discogs/auto-match` body `{ trackId, scope }` — runs local search
  internally; if exactly one hit → enrich and return. Otherwise return a
  candidate list for a small picker.

**Lib helpers** (`apps/api/src/lib/discogs.ts`):
- `paginateUserList(endpoint, username)` — async generator
- `syncCollection(userId)` / `syncWantlist(userId)` — consume the generator
- 429 handling: sleep based on the `X-Discogs-Ratelimit-Remaining` header
  or 60 s after a 429 (mirror the discogs2xlsx approach).

**Sync triggers** (in order of aggressiveness):
1. **App-foreground sync** — incremental sync whenever mobile foregrounds.
   Discogs sorts `added desc` → stop paging once we hit a `date_added` we
   already have locally → typical incremental = 1–2 requests.
2. **Push-on-write** — when the app itself mutates collection/wantlist
   (POST/DELETE), upsert locally in the same handler. Today's
   `syncMembership` does this thinly — extend it to write the full row.
3. **Nightly background full sync** — Railway cron hits `POST /discogs/sync`
   once a day. Catches changes made directly on discogs.com.

**Phasing:**
1. ✅ Schema + migration + replace the existing `discogs_user_items` table
   (migration 0010, table `discogs_user_releases` with pg_trgm index)
2. ✅ `paginateUserList` async generator + `syncDiscogsForUser` (full +
   incremental modes, prunes deleted releases on full sync)
3. ✅ `POST /discogs/sync` route + `discogs:sync` WS progress messages
4. Sync button in Settings (manual trigger + progress UI)
5. ✅ `GET /discogs/local-search` + `GET /discogs/local/counts` —
   trigram-ranked local search. Library UI still TODO.
6. App-foreground incremental sync
7. ✅ `POST /discogs/auto-match` endpoint (auto-applies on dominant single hit,
   otherwise returns candidates). Post-download UI prompt still TODO.

---

## 🔜 Task: Discogs enrichment — follow-up work

**Priority:** Medium
**Depends on:** Discogs mirror (above) — auto-match becomes meaningfully
more reliable with a local index.
**Description:**
Manual Discogs enrichment is shipped (search → match → enrich +
collection/wantlist toggles + notes). Remaining:

- Library list shows collection / wantlist badges (JOIN tracks against
  `discogs_user_releases`)
- Library search considers Discogs metadata (label, catalog#, year, genre)
- Cover art on the player screen when `discogsMetadata.coverUrl` is set
- Auto-match at ingest — moved into the mirror task (needs the local
  index to work reliably)

---

## 🔮 Later: Discogs integration (custom in-app browser)

**Priority:** High (later)
**Description:**
A full Discogs browser inside the app. Shifts Aani from a download tool
into a Discogs-integrated music library.

### Features

**Search & browse**
- Release search by name, artist, label, catalog number
- Result rows: cover, artist, release, year, format
- Release page: tracklist, YouTube links, notes, versions

**Download via Discogs**
- YouTube links surface directly on the release page
- One tap → download starts; metadata (artist, title, cover, year) comes
  from Discogs automatically
- Fallback to clipboard / YouTube search if no link is present

**Collection & Wantlist**
- Browse and search your own record collection
- Wantlist — browse what you want, download previews or full tracks
- Mark which releases you've already downloaded into Aani

**Auth**
- Discogs OAuth 1.0a — sign in with your Discogs account
- Enables collection + wantlist + rating actions

### Technical notes
- Discogs API: free, 60 req/min authenticated
- OAuth 1.0a needs a backend token-exchange endpoint (added to `apps/api`)
- Covers come from the Discogs CDN (`api.discogs.com/images/...`)
- YouTube links live in the Discogs `videos` field per release

### Suggested phasing
1. Search + release page + YouTube download (no auth)
2. Discogs OAuth + collection browsing
3. Wantlist + management (add / remove)

---

## 🔮 Later: React Native New Architecture migration

**Priority:** Low (future)
**Description:**
The app currently runs on Legacy Architecture (`apps/mobile/app.json`:
`"newArchEnabled": false`). RN warns that legacy will be removed in a
future version, so we'll have to migrate to Fabric / TurboModules at some
point.

**Why we're on legacy now:**
- `react-native-track-player` 4.1.2 extends `ReactContextBaseJavaModule`
  (old-arch only). On New Architecture the module fails to register as
  a TurboModule and the player reports "audio playback not available."
- Three previous attempts have been reverted (commits `75952a5`,
  `f7d02b5`, `fd09300` → reverts `7f12c47` and friends).

**Options when the time comes:**
1. Wait for RNTP v5 stable with New Architecture support (cleanest).
2. Try the RNTP v5 alpha again — development has progressed since the
   last attempt.
3. Replace RNTP with `expo-audio` + a custom service. Native-on-new-arch
   but loses lock-screen controls, queue, and notification integration —
   we'd need to rebuild those.

**Trigger:**
- RNTP ships v5 stable, OR
- RN announces a concrete removal timeline for legacy.

---

## ✅ Done

- **Web app (Next.js)** — `apps/web/` in the Turborepo. Clerk auth, with
  library / playlists / downloads / settings routes, hitting the same API
  as mobile. Deploy: Vercel.
- **Library search** — TextInput at the top of the Library tab, filters
  by title + artist. Distinguishes empty-library from no-search-results.
- **Clipboard "+" quick-add** — replaced the always-visible URL bar on
  Downloads with a "+" button. Pre-fills the input from the clipboard if
  the contents look like a YouTube URL. Cancel button collapses.
- **Discogs enrichment (manual)** — disc icon on the player screen opens
  a sheet: search → match → enrich. Genres/styles/year/label/cat#/cover
  are persisted as jsonb in `tracks.discogs_metadata`. Per-track
  collection/wantlist toggles write to both Discogs and a local
  `discogs_user_items` membership cache. Wantlist note round-trips
  through Discogs's own notes field. Header dot signals state: green =
  collection, red = wantlist.
