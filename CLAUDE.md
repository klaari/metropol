# Aani — Claude Code Context

See AGENTS.md for universal implementation constraints.

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
Turborepo workspace. Only `apps/mobile` ships today; `apps/api` and
`apps/web` are reserved for Phase 2 and don't exist yet.

```
aani/
├── apps/
│   └── mobile/                        → Expo app (only shipping app right now)
│       ├── app/                       → Expo Router file-based routes
│       │   ├── _layout.tsx              root layout (Clerk + GestureHandler)
│       │   ├── index.tsx                auth gate / redirect
│       │   ├── (auth)/                  unauthenticated group
│       │   │   ├── _layout.tsx
│       │   │   ├── sign-in.tsx
│       │   │   └── sign-up.tsx
│       │   ├── (tabs)/                  main authenticated app
│       │   │   ├── _layout.tsx          tab bar
│       │   │   ├── library.tsx          track list
│       │   │   ├── playlists/           index.tsx + [id].tsx
│       │   │   ├── downloads.tsx        download jobs
│       │   │   └── settings.tsx
│       │   └── player/[id].tsx        full-screen player
│       ├── components/                → composed components (layer 3)
│       │   │                            Domain-aware: knows about tracks,
│       │   │                            playlists, sheets, the player.
│       │   │                            Built from primitives. Examples:
│       │   │                            MiniPlayer, QueueSheet, TrackItem,
│       │   │                            DiscogsSheet, EditTrackModal.
│       │   └── ui/                    → primitives (layer 2). See
│       │                                UI_ARCHITECTURE.md for the full
│       │                                catalogue. Flat directory, no
│       │                                subfolders.
│       ├── design/                    → tokens (layer 1)
│       │   ├── raw.js                   CommonJS source of truth — required
│       │   │                            by both tailwind.config.js and
│       │   │                            tokens.ts so the two cannot drift
│       │   └── tokens.ts                TS surface; adds RN-shaped tokens
│       │                                (motion, elevation, layout, icon, z)
│       ├── store/                     → Zustand stores, one per domain
│       │                                (player, library, playlists,
│       │                                downloads, discogsMatch, discogsSync)
│       ├── hooks/                     → custom hooks (use* prefix)
│       ├── lib/                       → clients & utilities
│       │                                api, db, r2, trackPlayer,
│       │                                localAudio, cn (className helper)
│       ├── tailwind.config.js         → consumes design/raw.js
│       ├── global.css                 → NativeWind entry
│       ├── metro.config.js            → Metro + NativeWind
│       ├── babel.config.js            → Expo + NativeWind
│       ├── android/, ios/             → native projects (EAS managed)
│       ├── app.json, eas.json         → Expo + EAS config
│       └── patches/                   → patch-package patches
└── packages/
    ├── db/                            → Drizzle schema + migrations
    │   ├── src/                         schema.ts, client.ts, index.ts
    │   ├── drizzle/                     hand-rolled NNNN_*.sql migration files
    │   └── scripts/                     db:apply / db:apply:dry / db:bootstrap
    └── types/                         → shared TypeScript interfaces (src/index.ts)
```

**UI layer model** (see `UI_ARCHITECTURE.md` for full detail):

```
design/  →  components/ui/  →  components/  →  app/
tokens       primitives        composed         screens
```

Imports flow downward; nothing skips a layer. Screens compose primitives,
not raw RN. Hex literals and px values live only in `design/`.

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

## AI Workflow

- Use planning/review agents for architecture, decomposition, and UI review.
- Use implementation agents for deterministic implementation and migrations.
- When implementing UI:
  - follow UI_RULES.md
  - follow UI_ARCHITECTURE.md
