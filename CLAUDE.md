# Aani — Claude Code Context

## What This App Is
A personal mobile music player with tempo/pitch control, live BPM display,
playlist management, and cloud backup. Built for personal use by a single user.
Named: Aani (domain: aani.cc).

## Stack
- **Mobile:** Expo (SDK 52+) + Expo Router (file-based routing)
- **Audio:** react-native-track-player
- **State:** Zustand
- **Auth:** Clerk (Expo SDK)
- **Database:** Neon (serverless Postgres) + Drizzle ORM
- **Storage:** Cloudflare R2 (S3-compatible, zero egress)
- **Monorepo:** Turborepo
- **Language:** TypeScript everywhere, strict mode enabled
- **Runtime:** Bun (Phase 2+)

## Monorepo Structure
```
aani/
├── apps/
│   └── mobile/               → Expo app
│       ├── app/              → Expo Router file-based routes
│       │   ├── (auth)/       → Unauthenticated screens
│       │   ├── (tabs)/       → Main authenticated app
│       │   └── player/       → Player screen
│       ├── components/       → UI components
│       ├── store/            → Zustand stores
│       ├── hooks/            → Custom hooks
│       └── lib/              → Clients: db, r2, clerk
└── packages/
    ├── db/                   → Drizzle schema + migrations
    └── types/                → Shared TypeScript interfaces
```

## Conventions
- DB migrations: write hand-rolled SQL files in `packages/db/drizzle/NNNN_*.sql`
  and apply with `npm run db:apply` from `packages/db/`. Tracking lives in the
  custom `aani_migrations` table — do **not** use `drizzle-kit migrate` (the
  meta journal is stale past 0002 and silently skips later files). Use
  `db:apply:dry` to preview, `db:bootstrap` only on a fresh tracking table.
- All DB queries use Drizzle ORM — never raw SQL strings
- Zustand stores in `apps/mobile/store/` — one store per domain
- Hooks in `apps/mobile/hooks/` — prefix with `use`
- Expo Router file-based routing: `(auth)` for unauthenticated, `(tabs)` for main app
- `EXPO_PUBLIC_` prefix for all client-side environment variables
- R2 access via presigned URLs only — never expose credentials directly to client
- Error handling: Result pattern (`{ data, error }`) — no unhandled promise rejections
- BPM is always stored as the original value — current BPM is computed at runtime:
  `currentBpm = originalBpm * playbackRate`
- Playback rate stored as a float, e.g. `1.05`, `0.98` — two decimal precision
- All DB records include `userId` (Clerk user ID) as a filter — never query without it

## Key Business Logic
- Playback rate and pitch change together (no time-stretching) — simple rate adjustment
- `currentBpm = originalBpm * playbackRate` — computed live, never stored
- BPM entered manually by user in Phase 1 (auto-detection in Phase 2)
- Track files in R2 use two key patterns today:
  - YouTube downloads (global, deduped via `tracks.youtubeId`): `tracks/{trackId}.m4a`
  - Direct user uploads: `{userId}/{trackId}.{ext}`
  - Cookies: `cookies/{userId}/yt-cookies.txt`
  - Planned (task #12): unified content-addressable path `tracks/{contentHash}.{ext}`
- Playback position and rate persisted per track in `playback_state` table

## Deployment

| App | Platform | Notes |
|-----|----------|-------|
| `apps/api` | Railway | Bun + Hono API; auto-deploys from `main` branch |
| `apps/web` | Vercel | Next.js web companion; auto-deploys from `main` branch |
| `apps/mobile` | EAS Build | Android APK via `eas build`; OTA updates via `eas update` |

## Current Phase
**Phase 1 — Core player. No backend server yet.**
- Expo app + Clerk auth
- Neon + Drizzle (direct connection from app)
- Cloudflare R2 for audio file storage
- File import from device
- Playlist management
- Player with rate control + BPM display

## Phase 2 (do not implement yet)
- Bun + Hono backend API on Railway
- yt-dlp YouTube audio downloader
- Automatic BPM detection on ingest

## What NOT to Do
- Do not add a Hono/Bun backend — that is Phase 2
- Do not use Supabase — we use Neon + Cloudflare R2
- Do not use Firebase
- Do not use class components
- Do not use Redux or MobX
- Do not use the Supabase client SDK anywhere
- Do not implement YouTube downloading — Phase 2
- Do not use expo-av for audio — use react-native-track-player only

## Environment Variables
```
EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=
EXPO_PUBLIC_DATABASE_URL=
EXPO_PUBLIC_R2_ENDPOINT=
EXPO_PUBLIC_R2_ACCESS_KEY=
EXPO_PUBLIC_R2_SECRET_KEY=
EXPO_PUBLIC_R2_BUCKET=
```
