#!/usr/bin/env bun
//
// One-shot migration: copy R2 objects from the old metropol-player bucket
// (with the doubled-prefix bug) into the new aani-player bucket using
// content-addressable keys, and backfill `tracks.content_hash` + rewrite
// `tracks.file_key` to match.
//
// MUST run AFTER apps/db/drizzle/0006_dedup_columns_phase1.sql is applied.
// Run apps/db/drizzle/0007_dedup_columns_phase2.sql AFTER this completes
// successfully (the unique constraint on content_hash is enforced there).
//
// Idempotent: rows that already have a content_hash are skipped.
//
// Usage:
//   bun apps/api/scripts/migrate-content-hash.ts            # dry-run (default)
//   bun apps/api/scripts/migrate-content-hash.ts --apply    # actually write
//
// Required env (read from .env at repo root):
//   R2_ACCOUNT_ENDPOINT  https://<account>.r2.cloudflarestorage.com  (bare account endpoint,
//                        NOT the runtime R2_ENDPOINT which still has the bucket suffix)
//   R2_ACCESS_KEY, R2_SECRET_KEY (reused from runtime)
//   R2_OLD_BUCKET        metropol-player
//   R2_NEW_BUCKET        aani-player
//   R2_OLD_KEY_PREFIX    metropol-player/        (the doubled prefix; trailing slash)
//   DATABASE_URL

import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import {
  S3Client,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  ListObjectsV2Command,
  type ListObjectsV2CommandOutput,
} from "@aws-sdk/client-s3";
import { createDb, tracks } from "@aani/db";

const DRY_RUN = !process.argv.includes("--apply");

function required(name: string, ...fallbacks: string[]): string {
  for (const n of [name, ...fallbacks]) {
    const v = process.env[n];
    if (v) return v;
  }
  throw new Error(`Missing env: ${name}${fallbacks.length ? ` (also tried: ${fallbacks.join(", ")})` : ""}`);
}

const cfg = {
  endpoint: required("R2_ACCOUNT_ENDPOINT"),
  accessKey: required("R2_ACCESS_KEY", "EXPO_PUBLIC_R2_ACCESS_KEY"),
  secretKey: required("R2_SECRET_KEY", "EXPO_PUBLIC_R2_SECRET_KEY"),
  oldBucket: required("R2_OLD_BUCKET"),
  newBucket: required("R2_NEW_BUCKET"),
  oldKeyPrefix: process.env.R2_OLD_KEY_PREFIX ?? "",
  databaseUrl: required("DATABASE_URL", "EXPO_PUBLIC_DATABASE_URL"),
};

if (cfg.endpoint.includes(`/${cfg.oldBucket}`) || cfg.endpoint.includes(`/${cfg.newBucket}`)) {
  throw new Error(
    `R2_ACCOUNT_ENDPOINT must NOT contain a bucket suffix — got "${cfg.endpoint}". ` +
      `Use the bare account endpoint, e.g. https://<id>.r2.cloudflarestorage.com`,
  );
}

const s3 = new S3Client({
  region: "auto",
  endpoint: cfg.endpoint,
  credentials: { accessKeyId: cfg.accessKey, secretAccessKey: cfg.secretKey },
});

const db = createDb(cfg.databaseUrl);

console.log(
  `Mode: ${DRY_RUN ? "DRY-RUN (no writes)" : "APPLY"}\n` +
    `  endpoint:    ${cfg.endpoint}\n` +
    `  old bucket:  ${cfg.oldBucket}  (key prefix: "${cfg.oldKeyPrefix}")\n` +
    `  new bucket:  ${cfg.newBucket}\n`,
);

async function getObject(bucket: string, key: string): Promise<Buffer> {
  const res = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  const bytes = await res.Body!.transformToByteArray();
  return Buffer.from(bytes);
}

async function objectExists(bucket: string, key: string): Promise<boolean> {
  try {
    await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    return true;
  } catch {
    return false;
  }
}

async function putObject(bucket: string, key: string, body: Buffer, contentType: string) {
  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
    }),
  );
}

// ---------- Step 1: migrate cookies (no hash, same key path) ----------

async function migrateCookies() {
  console.log("\n=== cookies/ ===");
  const prefix = `${cfg.oldKeyPrefix}cookies/`;
  let token: string | undefined;
  let count = 0;
  do {
    const list: ListObjectsV2CommandOutput = await s3.send(
      new ListObjectsV2Command({
        Bucket: cfg.oldBucket,
        Prefix: prefix,
        ContinuationToken: token,
      }),
    );
    for (const obj of list.Contents ?? []) {
      if (!obj.Key) continue;
      const newKey = obj.Key.slice(cfg.oldKeyPrefix.length);
      console.log(`  cookie: ${obj.Key} → ${newKey}`);
      if (!DRY_RUN) {
        const body = await getObject(cfg.oldBucket, obj.Key);
        await putObject(cfg.newBucket, newKey, body, "text/plain");
      }
      count++;
    }
    token = list.NextContinuationToken;
  } while (token);
  console.log(`  ${count} cookie object(s) ${DRY_RUN ? "would be" : "were"} copied.`);
}

// ---------- Step 2: migrate tracks (hash + content-addressable key + DB update) ----------

async function migrateTracks() {
  console.log("\n=== tracks ===");
  const rows = await db.select().from(tracks);
  console.log(`  ${rows.length} tracks rows total.`);

  const seenHashes = new Map<string, string>();  // hash → first trackId we saw

  let migrated = 0;
  let skipped = 0;
  let dupes = 0;
  let errors = 0;

  for (const row of rows) {
    if (row.contentHash) {
      skipped++;
      continue;
    }

    try {
      const ext = row.format ?? "m4a";
      // row.fileKey on existing rows is "tracks/{trackId}.{ext}" (the OLD value
      // — written by the old code path before the rewrite). The OLD R2 object
      // sits at "{oldKeyPrefix}{fileKey}" because of the path-doubling bug.
      const oldKey = `${cfg.oldKeyPrefix}${row.fileKey}`;
      const body = await getObject(cfg.oldBucket, oldKey);
      const contentHash = createHash("sha256").update(body).digest("hex");
      const newKey = `tracks/${contentHash}.${ext}`;

      const existingId = seenHashes.get(contentHash);
      if (existingId) {
        console.log(
          `  DUPE: track ${row.id} has same hash as ${existingId} (${contentHash}). ` +
            `Manual merge required — see log.`,
        );
        dupes++;
        continue;
      }
      seenHashes.set(contentHash, row.id);

      console.log(`  ${row.id}  ${oldKey}  →  ${newKey}`);
      if (!DRY_RUN) {
        const exists = await objectExists(cfg.newBucket, newKey);
        if (!exists) {
          await putObject(
            cfg.newBucket,
            newKey,
            body,
            ext === "m4a" ? "audio/mp4" : `audio/${ext}`,
          );
        }
        await db
          .update(tracks)
          .set({ contentHash, fileKey: newKey })
          .where(eq(tracks.id, row.id));
      }
      migrated++;
    } catch (e: any) {
      console.error(`  ERROR on track ${row.id}:`, e?.message ?? e);
      errors++;
    }
  }

  console.log(
    `\n  Summary: migrated=${migrated} skipped=${skipped} dupes=${dupes} errors=${errors}`,
  );
  if (dupes > 0) {
    console.log(
      `  ⚠ ${dupes} duplicate-hash row(s) need manual merging before phase-2 SQL can run.\n` +
        `    For each, decide which row is canonical and redirect references in:\n` +
        `      user_tracks, playlist_tracks, playback_state, queue_items, download_jobs\n` +
        `    Then DELETE the dupe row.`,
    );
  }
  if (errors > 0) {
    console.log(`  ⚠ ${errors} error(s) — re-run the script (it's idempotent).`);
  }
}

// ---------- Step 3: orphan report (user_*/ — failed mobile imports) ----------

async function reportOrphans() {
  console.log("\n=== orphans (user_*/) ===");
  let token: string | undefined;
  let count = 0;
  do {
    const list: ListObjectsV2CommandOutput = await s3.send(
      new ListObjectsV2Command({
        Bucket: cfg.oldBucket,
        Prefix: `${cfg.oldKeyPrefix}user_`,
        ContinuationToken: token,
      }),
    );
    for (const obj of list.Contents ?? []) {
      if (!obj.Key) continue;
      console.log(`  orphan (NOT migrated): ${obj.Key}  (${obj.Size} bytes)`);
      count++;
    }
    token = list.NextContinuationToken;
  } while (token);
  console.log(
    `  ${count} orphan object(s). These were failed mobile direct-imports (no DB row). ` +
      `They will be discarded when the old bucket is deleted.`,
  );
}

async function main() {
  await migrateCookies();
  await migrateTracks();
  await reportOrphans();

  console.log(
    `\nDone (${DRY_RUN ? "dry-run" : "applied"}). ` +
      `${DRY_RUN ? "Re-run with --apply to perform the migration." : "Next: npm run db:apply (will apply 0007_dedup_columns_phase2.sql), then update R2_BUCKET / R2_ENDPOINT in .env / Railway / EAS."}`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
