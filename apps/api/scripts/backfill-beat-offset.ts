/**
 * Backfill `beat_offset` (and `original_bpm` if also missing) on user_tracks
 * rows where beat_offset is NULL.
 *
 * Usage (Railway shell or local):
 *   bun run apps/api/scripts/backfill-beat-offset.ts            # all null rows
 *   bun run apps/api/scripts/backfill-beat-offset.ts --user=<id> # one user
 *   bun run apps/api/scripts/backfill-beat-offset.ts --limit=20  # cap iterations
 *   bun run apps/api/scripts/backfill-beat-offset.ts --dry-run   # detect, don't write
 *
 * Downloads each track from R2, runs detectBpm (ffmpeg → aubiotrack),
 * and writes beatOffset (and originalBpm if missing) back to user_tracks.
 */

import { unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { eq, isNull, and, sql } from "drizzle-orm";
import { createDb, tracks, userTracks } from "@aani/db";
import { detectBpm } from "../src/lib/bpm";
import { env } from "../src/lib/env";

const r2 = new S3Client({
  region: "auto",
  endpoint: env.r2Endpoint,
  credentials: {
    accessKeyId: env.r2AccessKey,
    secretAccessKey: env.r2SecretKey,
  },
});

async function downloadObject(fileKey: string, dest: string): Promise<void> {
  const res = await r2.send(
    new GetObjectCommand({ Bucket: env.r2Bucket, Key: fileKey }),
  );
  const bytes = await res.Body?.transformToByteArray();
  if (!bytes) throw new Error(`empty body for ${fileKey}`);
  await writeFile(dest, bytes);
}

function parseArgs() {
  const args = process.argv.slice(2);
  const out: { userId?: string; limit?: number; dryRun: boolean } = { dryRun: false };
  for (const a of args) {
    if (a === "--dry-run") out.dryRun = true;
    else if (a.startsWith("--user=")) out.userId = a.slice("--user=".length);
    else if (a.startsWith("--limit=")) out.limit = Number(a.slice("--limit=".length));
  }
  return out;
}

async function main() {
  const opts = parseArgs();
  const db = createDb(env.databaseUrl);

  // Target: rows where beat_offset is null (process even if bpm already set)
  const query = db
    .select({
      userTrackId: userTracks.id,
      userId: userTracks.userId,
      trackId: tracks.id,
      title: tracks.title,
      fileKey: tracks.fileKey,
      format: tracks.format,
      existingBpm: userTracks.originalBpm,
    })
    .from(userTracks)
    .innerJoin(tracks, eq(userTracks.trackId, tracks.id))
    .where(
      opts.userId
        ? and(isNull(userTracks.beatOffset), sql`${userTracks.userId} = ${opts.userId}`)
        : isNull(userTracks.beatOffset),
    );

  const rows = opts.limit ? await query.limit(opts.limit) : await query;

  console.log(
    `[backfill-beat-offset] ${rows.length} candidate row(s)${opts.dryRun ? " (dry run)" : ""}`,
  );

  let ok = 0;
  let skipped = 0;
  let failed = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!;
    const ext = row.format ?? "m4a";
    const localPath = join(tmpdir(), `aani-bf-${row.trackId}.${ext}`);
    process.stdout.write(`  [${i + 1}/${rows.length}] ${row.title.slice(0, 60)} … `);
    try {
      await downloadObject(row.fileKey, localPath);
      const result = await detectBpm(localPath);
      if (result == null) {
        console.log("skip (no beat data detected)");
        skipped++;
      } else {
        if (!opts.dryRun) {
          const update: Record<string, unknown> = { beatOffset: result.beatOffset };
          // Also backfill BPM if it was missing
          if (row.existingBpm == null) update.originalBpm = result.bpm;
          await db
            .update(userTracks)
            .set(update)
            .where(eq(userTracks.id, row.userTrackId));
        }
        const bpmNote = row.existingBpm == null ? ` (bpm: ${result.bpm})` : "";
        console.log(`offset=${result.beatOffset.toFixed(3)}s${bpmNote}${opts.dryRun ? " (dry)" : ""}`);
        ok++;
      }
    } catch (e) {
      console.log(`fail: ${e instanceof Error ? e.message : e}`);
      failed++;
    } finally {
      unlink(localPath).catch(() => {});
    }
  }

  console.log(
    `[backfill-beat-offset] done — ok=${ok} skip=${skipped} fail=${failed}`,
  );
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
