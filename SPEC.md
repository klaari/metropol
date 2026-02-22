# Marko Player — Phase 1 Feature Spec

## Overview
Marko Player is a personal mobile music player. Single user. The goal is a
fast, focused player where the core feature is creating playlists and adjusting tempo/pitch together
with live BPM feedback — useful for planning dj sets.

---

## Screens & Routes

| Route | Screen | Auth required |
|---|---|---|
| `/sign-in` | Sign In | No |
| `/sign-up` | Sign Up | No |
| `/(tabs)/library` | Track Library | Yes |
| `/(tabs)/playlists` | Playlists | Yes |
| `/(tabs)/playlists/[id]` | Playlist Detail | Yes |
| `/player/[id]` | Player | Yes |

---

## Feature Specs

### 1. Auth (Clerk)

- Sign in and sign up screens using `@clerk/clerk-expo`
- Email + password auth (no social login needed for personal use)
- All `(tabs)` routes redirect to `/sign-in` if unauthenticated
- Clerk `userId` is used as the user identifier across all DB tables
- Session persists across app restarts

---

### 2. Library Screen (`/(tabs)/library`)

**Display**
- List of all tracks belonging to the current user
- Each track item shows: title, artist (if set), duration, original BPM (if set)
- Empty state message when no tracks exist

**Sorting**
- Sort options: Date Added (default), Title A–Z, BPM low–high

**Actions**
- Tap track → navigate to `/player/[id]`
- Long press track → show action sheet: Edit metadata, Delete
- Delete shows confirmation dialog before removing track from DB and R2

**Import (FAB button)**
- Floating action button opens device file picker
- Accept audio formats: mp3, m4a, aac, wav, flac, ogg
- On file selected:
  1. Generate a new `trackId` (UUID)
  2. Upload file to R2 with key `{userId}/{trackId}.{ext}`
  3. Write track row to Neon `tracks` table
  4. Show upload progress indicator
  5. On success: track appears in library list
  6. On failure: show detailed error toast, clean up any partial upload

**Edit Metadata (sheet/modal)**
- Fields: Title (required), Artist, BPM (numeric, optional)
- Save updates the `tracks` row in Neon

---

### 3. Player Screen (`/player/[id]`)

**Track Info**
- Title and artist displayed at top

**Transport Controls**
- Play / Pause button
- Seek bar with current position and total duration
- Previous / Next (within current playlist context if applicable)
- Background playback supported via react-native-track-player

**Playback Rate Control**
- Numeric input field labeled "Speed"
- Accepts percentage values from `-8%` to `+8%`
- Increment/decrement buttons: ±0.5% and ±0.5% step buttons alongside input
- Changing the rate immediately affects playback
- Rate and pitch change together — no time-stretching, simple rate adjustment

**BPM Display**
- "Original BPM" — shows stored value, or "—" if not set
- "Current BPM" — shows `originalBpm * playbackRate`, rounded to 1 decimal
- Updates live as rate changes
- Tap "Original BPM" value → opens inline edit to set/update BPM

**Persistence**
- Playback rate saved to `playback_state` table on change (debounced 500ms)
- Last playback position saved on pause/exit
- On re-opening a track: restore last rate and seek to last position

---

### 4. Playlists Screen (`/(tabs)/playlists`)

**Display**
- List of user playlists
- Each item shows: playlist name, track count

**Actions**
- "New Playlist" button → prompt for name → creates playlist row in Neon
- Long press playlist → action sheet: Rename, Delete
- Tap playlist → navigate to `/(tabs)/playlists/[id]`

---

### 5. Playlist Detail Screen (`/(tabs)/playlists/[id]`)

**Display**
- Playlist name as header (editable inline)
- Ordered list of tracks in this playlist

**Actions**
- Drag handle to reorder tracks → updates `position` in `playlist_tracks`
- Tap track → navigate to player (with playlist context for prev/next)
- Swipe to remove track from playlist (does not delete the track from library)
- "Add Tracks" button → opens track picker from library → inserts into `playlist_tracks`

---

## Data Models

### `tracks`
```
id            uuid PK
userId        text (Clerk user ID)
title         text NOT NULL
artist        text
duration      integer (seconds)
originalBpm   real (nullable — user enters manually)
fileKey       text (R2 object key: {userId}/{trackId}.ext)
fileSize      integer (bytes)
format        text (mp3, m4a, etc)
importedAt    timestamp DEFAULT now()
lastPlayedAt  timestamp
```

### `playlists`
```
id         uuid PK
userId     text (Clerk user ID)
name       text NOT NULL
createdAt  timestamp DEFAULT now()
updatedAt  timestamp DEFAULT now()
```

### `playlist_tracks`
```
id          uuid PK
playlistId  uuid FK → playlists.id (cascade delete)
trackId     uuid FK → tracks.id (cascade delete)
position    integer NOT NULL (0-indexed, for ordering)
```

### `playback_state`
```
id            uuid PK
userId        text (Clerk user ID)
trackId       uuid FK → tracks.id (cascade delete)
playbackRate  real DEFAULT 1.0
lastPosition  integer DEFAULT 0 (seconds)
updatedAt     timestamp DEFAULT now()
```

---

## Cloudflare R2

- Bucket name: `marko-player`
- Object key pattern: `{userId}/{trackId}.{ext}`
- Upload: presigned PUT URL generated client-side (Phase 1)
- Download/stream: presigned GET URL, expires in 1 hour
- SDK: `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner`

---

## State Management (Zustand)

### `playerStore`
```typescript
{
  currentTrackId: string | null
  isPlaying: boolean
  playbackRate: number        // e.g. 1.05
  position: number            // seconds
  duration: number            // seconds
  currentPlaylistId: string | null
}
```

### `libraryStore`
```typescript
{
  tracks: Track[]
  playlists: Playlist[]
  isLoading: boolean
  error: string | null
}
```

---

## Build Order

Follow this sequence — complete and commit each step before moving to the next:

1. Turborepo monorepo scaffold + install all dependencies
2. `packages/db` — Drizzle schema + `drizzle.config.ts` + first migration run
3. `packages/types` — shared TypeScript interfaces matching schema
4. Clerk auth — sign-in/sign-up screens + protected route layout
5. R2 helpers in `lib/r2.ts` — presigned upload + download URL functions
6. Library screen — track list + file picker + R2 upload + Neon insert
7. react-native-track-player setup + audio playback
8. Player screen — transport controls + rate input + BPM display + persistence
9. Playlists screen + playlist detail + reorder

---

## Out of Scope for Phase 1
- YouTube / URL importing (Phase 2)
- Automatic BPM detection (Phase 2)
- Hono backend server (Phase 2)
- Waveform visualisation
- Equalizer
- Social features
- Multiple user accounts
