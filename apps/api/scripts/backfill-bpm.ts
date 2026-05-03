/**
 * Backfill `originalBpm` on user_tracks rows where it is NULL.
 *
 * Usage (Railway shell or local):
 *   bun run apps/api/scripts/backfill-bpm.ts            # all null rows
 *   bun run apps/api/scripts/backfill-bpm.ts --user=<id> # one user
 *   bun run apps/api/scripts/backfill-bpm.ts --limit=20  # cap iterations
 *   bun run apps/api/scripts/backfill-bpm.ts --dry-run   # detect, don't write
 *
 * Reads the audio for each track from R2 to /tmp, runs detectBpm
 * (ffmpeg → aubiotrack), and writes the result back. Skips rows where
 * detection returns null. Cleans up tmp files on each iteration.
 */

import { unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { eq, isNull, sql } from "drizzle-orm";
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

  const baseQuery = db
    .select({
      userTrackId: userTracks.id,
      userId: userTracks.userId,
      trackId: tracks.id,
      title: tracks.title,
      fileKey: tracks.fileKey,
      format: tracks.format,
    })
    .from(userTracks)
    .innerJoin(tracks, eq(userTracks.trackId, tracks.id))
    .where(isNull(userTracks.originalBpm));

  const conditions = opts.userId
    ? baseQuery.where(sql`${userTracks.userId} = ${opts.userId} AND ${userTracks.originalBpm} IS NULL`)
    : baseQuery;
  const rows = opts.limit ? await conditions.limit(opts.limit) : await conditions;

  console.log(`[backfill-bpm] ${rows.length} candidate row(s)${opts.dryRun ? " (dry run)" : ""}`);

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
      const bpm = await detectBpm(localPath);
      if (bpm == null) {
        console.log("skip (no bpm detected)");
        skipped++;
      } else {
        if (!opts.dryRun) {
          await db
            .update(userTracks)
            .set({ originalBpm: bpm })
            .where(eq(userTracks.id, row.userTrackId));
        }
        console.log(`${bpm} bpm${opts.dryRun ? " (dry)" : ""}`);
        ok++;
      }
    } catch (e) {
      console.log(`fail: ${e instanceof Error ? e.message : e}`);
      failed++;
    } finally {
      unlink(localPath).catch(() => {});
    }
  }

  console.log(`[backfill-bpm] done — ok=${ok} skip=${skipped} fail=${failed}`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
