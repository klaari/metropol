# Spec: tracks schema redesign — multi-source + content-addressed dedup

## Goal

Replace the YouTube-only `tracks` schema with a generalized model that
deduplicates **all** ingest paths (YouTube, future SoundCloud, direct file
upload) and fixes the broken mobile direct-import flow as part of the same
change.

## Current state (what's actually in the codebase)

Three ingest paths, three different conventions, two of them buggy:

| Path | File | R2 key | DB write | Dedup |
|---|---|---|---|---|
| YouTube background job | `apps/api/src/jobs/processor.ts` | `tracks/{trackId}.m4a` | `tracks` (real `youtubeId`) + `userTracks` ✓ | Yes — pre-check at `download.ts:74-101` |
| API direct upload (web) | `apps/api/src/routes/download.ts:187-268` | `tracks/{trackId}.{format}` | `tracks` (`youtubeId='upload:{trackId}'` hack) + `userTracks` ✓ | **No** — fake `youtubeId` defeats it |
| Mobile direct import | `apps/mobile/app/(tabs)/library.tsx:104-165` | `{userId}/{trackId}.{ext}` | `tracks` insert with bogus `userId` field, missing `youtubeId` → throws; **no `userTracks`** | **No** — fully broken |

The schema enforces `tracks.youtubeId NOT NULL UNIQUE` (`packages/db/src/schema.ts:14`),
which is what forces the `'upload:{trackId}'` hack and what causes the mobile
import to throw.

## Target schema

```ts
export const tracks = pgTable("tracks", {
  id: uuid("id").primaryKey().defaultRandom(),
  source: text("source").notNull(),         // 'youtube' | 'soundcloud' | 'upload'
  sourceId: text("source_id"),              // platform id (youtubeId for youtube, null for upload)
  contentHash: text("content_hash").notNull().unique(),  // SHA-256 hex of audio bytes
  title: text("title").notNull(),
  artist: text("artist"),
  duration: integer("duration"),
  fileKey: text("file_key").notNull(),      // tracks/{contentHash}.{ext}
  fileSize: integer("file_size"),
  format: text("format"),
  sourceUrl: text("source_url"),            // original URL when applicable
  downloadedAt: timestamp("downloaded_at").defaultNow().notNull(),
}, (t) => [
  uniqueIndex("tracks_source_id_idx")
    .on(t.source, t.sourceId)
    .where(sql`source_id IS NOT NULL`),    // partial unique
]);
```

Drop: `tracks.youtubeId` column entirely.
Keep: `userTracks`, `playlists`, `playlistTracks`, `playbackState`, `queueItems`,
`userPlayerState`, `downloadJobs` — all unchanged (they reference `tracks.id`).

## Ingest flow (unified)

For all three paths:

```
1. If sourceId known:
     row = SELECT FROM tracks WHERE source = $1 AND sourceId = $2
     if hit:
       INSERT userTracks (skip download/upload)
       return existing track

2. Acquire bytes (download / accept upload), compute SHA-256.

3. row = SELECT FROM tracks WHERE contentHash = $1
   if hit:
     // Same audio uploaded under a different sourceId, or upload of file
     // a YouTube track was already downloaded as.
     if row.sourceId IS NULL and we now have one:
       UPDATE tracks SET source = $1, sourceId = $2 WHERE id = row.id  (backfill)
     INSERT userTracks (skip R2 upload)
     return existing track

4. PUT bytes to R2 at tracks/{contentHash}.{ext}

5. Transaction:
     INSERT tracks (source, sourceId, contentHash, fileKey, ...)
     INSERT userTracks (userId, trackId)
   On unique-violation of contentHash (race condition):
     SELECT existing row, INSERT userTracks against it, delete the just-uploaded R2 object.
```

The `(source, sourceId)` lookup is the fast path — no download needed for
re-imports of the same URL. The `contentHash` lookup is the bandwidth-saver
for genuine duplicates across sources / uploads.

## Per-path changes

### `apps/api/src/jobs/processor.ts` (YouTube)

- Step 0 (new): hash check via `(source='youtube', sourceId=youtubeId)` is
  already done in `download.ts:74-101` before enqueueing — keep it there,
  no change to processor.
- Step 6: replace `fileKey = tracks/{trackId}.m4a` with
  `fileKey = tracks/{contentHash}.m4a`.
- Step 6.5 (new): after download, before upload, compute hash and check
  contentHash dedup. If hit, link to existing track instead of uploading.
- Step 7: insert with `source='youtube'`, `sourceId=youtubeId`, `contentHash`.
- Drop the `youtubeId` field from the insert.

### `apps/api/src/routes/download.ts:187` (API direct upload, used by web)

- Hash buffer before upload.
- Check contentHash dedup → if hit, link userTracks to existing, skip R2.
- Upload to `tracks/{contentHash}.{format}`.
- Insert with `source='upload'`, `sourceId=null`, `contentHash`.
- Remove the `youtubeId: 'upload:{trackId}'` hack.

### `apps/api/src/routes/download.ts:56` (POST /downloads, queue YouTube)

- The pre-check at `:74-101` already does `(youtubeId)` lookup. Change to
  `WHERE source = 'youtube' AND sourceId = $1`.

### `apps/mobile/app/(tabs)/library.tsx:104` (mobile direct import)

The current code is broken three ways. Fix all three:

1. Remove the bogus `userId` field from the tracks insert.
2. Provide `source='upload'`, `sourceId=null`, `contentHash` instead of `youtubeId`.
3. Insert the matching `userTracks` row (without it, the track is invisible —
   `store/library.ts:73-76` joins through `userTracks`).
4. Wrap both inserts in a transaction.

For hashing: use `expo-crypto` (already a dependency — `apps/mobile/package.json:25`).
Read the file with `expo-file-system` and pass to `Crypto.digestStringAsync` /
`Crypto.digest`. For large files, stream-hash if memory becomes a concern; for
typical track sizes (5-15 MB) a one-shot hash is fine.

R2 key changes from `{userId}/{trackId}.{ext}` to `tracks/{contentHash}.{ext}`.
`buildFileKey` in `apps/mobile/lib/r2.ts:52-58` should be updated to take a
content hash, or replaced with a `buildContentKey(hash, ext)` helper.

### `apps/mobile/lib/localAudio.ts`

References `tracks.fileKey` for the local cache. No change needed — the
fileKey value just changes from `{userId}/...` to `tracks/{hash}...`.

## Open decisions

| # | Question | Recommendation | Reason to revisit |
|---|---|---|---|
| 1 | Hash algorithm | SHA-256 hex (64 chars) | Standard, supported by expo-crypto and Bun.crypto natively |
| 2 | File extension in R2 key | Yes — `tracks/{hash}.{ext}` | Lets you content-type-sniff from key during admin / makes the dashboard human-readable. Costs nothing |
| 3 | Mobile: hash on-device or server-side | On-device | Saves the upload bandwidth on dedup hits (the main reason for content-hash dedup) |
| 4 | `source` enum or text | `text` | Drizzle enum migrations are fiddly; we can validate at the application layer for now |
| 5 | Mobile direct import: keep direct-DB pattern or route through API? | Keep direct-DB for #12. Note as future work | Routing through API doubles upload bandwidth; fixing the credentials-in-bundle smell is a separate concern |

## Out of scope (defer)

- Perceptual fingerprinting (Chromaprint) — only needed if cross-format dedup
  matters; today's byte-hash is sufficient.
- Server-side R2 signing for mobile (removing `EXPO_PUBLIC_R2_*` from the mobile
  bundle) — real security improvement but a separate refactor.
- Migrating the `downloadJobs.youtubeId` column — keep it on `download_jobs`
  since it's the link between the user-pasted URL and the `tracks` row that
  eventually gets created. It's not a uniqueness constraint there.

## Migration plan (coordinated with task #11)

The schema change and the R2 bucket migration (#11) must run together because:
- New `contentHash` column requires hashing every existing R2 object.
- New `fileKey` value depends on the computed hash.
- The path-doubling fix in #11 already requires re-keying every object.

So: do all three rewrites (key, hash, schema) in one pass.

**Order:**

1. Drizzle migration #1: add new columns (`source`, `sourceId`, `contentHash`)
   as nullable; do not drop `youtubeId` yet. Deploy this. App keeps working.
2. Migration script (covers task #11):
   - For each existing R2 object under `metropol-player/metropol-player/tracks/{trackId}.{ext}`:
     - Download, SHA-256 hash, copy to `aani-player/tracks/{hash}.{ext}`.
     - Update the matching `tracks` row: `contentHash`, `fileKey`, `source`,
       `sourceId` (= `youtubeId` if not starting with `upload:`, else null with
       `source='upload'`).
   - For each `metropol-player/metropol-player/user_*/{trackId}.{ext}` orphan
     (no DB row): log and skip (these are the failed mobile imports).
   - Verify all `tracks` rows now have non-null `contentHash`.
3. Drizzle migration #2: enforce `NOT NULL` on `contentHash`, add unique
   constraints, add `(source, sourceId)` partial unique index, drop `youtubeId`
   column.
4. Cutover .env / Railway / EAS Secrets to new bucket + clean endpoint.

If migration #2 fails due to leftover nulls, the script in step 2 didn't
complete — re-run it.

## Test plan (manual smoke tests, no harness exists)

After implementation, before declaring done:

- [ ] Import a YouTube URL never seen before → check: `tracks` row created with
      `source='youtube'`, `sourceId=<videoId>`, real `contentHash`; R2 has one
      object at `tracks/{hash}.m4a`; `userTracks` row links you to it; track
      shows in library.
- [ ] Import same YouTube URL again → check: no re-download (server-side log
      shows the early-out at the `(source, sourceId)` lookup); only a new
      `userTracks` row inserted; ~instant response.
- [ ] Import same YouTube URL as a different user (sign in elsewhere) → check:
      no re-download; the same `tracks` row gets a second `userTracks` link.
- [ ] Direct upload a local audio file from mobile → check: `tracks` + `userTracks`
      both created; R2 object at `tracks/{hash}.{ext}`; track visible in library.
- [ ] Direct upload the same file again → check: contentHash dedup hits; no
      second R2 object; new `userTracks` row only.
- [ ] Direct upload file via web (POST /tracks/upload) → same checks.
- [ ] Cross-source: download a YouTube track, then upload a local copy of the
      same audio file → check: two `tracks` rows because byte hashes differ
      (re-encoded). Acceptable behavior, not a bug.
- [ ] Existing playback / playlists / queue continue to work post-migration
      (the `tracks.id` UUIDs are preserved; only fileKey + new columns change).

## Risk register

- **Race condition on contentHash unique constraint**: two concurrent uploads
  of the same byte-identical file by different users. Handled by the explicit
  catch in step 5 of the ingest flow (insert fails → SELECT existing → link).
- **Hash mismatch between mobile-computed and actual R2 bytes**: the presigned
  PUT could in theory upload different bytes than what was hashed (network
  corruption, file changes during read). Server has no way to verify because
  the upload bypasses it. Mitigation: rely on TLS for transit integrity; if
  tampering is a real concern later, switch to API-routed uploads (out of scope).
- **Migration interrupt**: if the script in step 2 dies halfway, we have a
  partial state. Mitigation: script must be idempotent — check for existing
  contentHash on each row before recomputing, skip already-migrated rows.
- **Old EAS APKs in the wild**: any installed APK still has the old
  `EXPO_PUBLIC_R2_BUCKET=metropol-player` baked in. After cutover, those
  installs talk to the wrong bucket and fail. Mitigation: trigger
  `eas update --channel preview` immediately after the cutover so the OTA
  update lands on devices the next time they open the app.
