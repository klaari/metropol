import { tracks, userTracks } from "@metropol/db";
import type { Track } from "@metropol/types";
import { and, eq, isNotNull, isNull } from "drizzle-orm";
import { Directory, File, Paths } from "expo-file-system";
import { getDb } from "./db";
import { getDownloadUrl } from "./r2";

const TRACKS_SUBDIR = "tracks";

/** Tracks in-flight downloads so concurrent calls dedupe to one network fetch. */
const inFlight = new Map<string, Promise<string | null>>();

function tracksDir(): Directory {
  const dir = new Directory(Paths.document, TRACKS_SUBDIR);
  if (!dir.exists) dir.create({ idempotent: true });
  return dir;
}

function localFileFor(trackId: string, format: string | null): File {
  const ext = (format ?? "m4a").toLowerCase();
  return new File(tracksDir(), `${trackId}.${ext}`);
}

/** True if the DB-recorded localUri exists on disk. */
export function hasLocalCopy(localUri: string | null | undefined): boolean {
  if (!localUri) return false;
  try {
    return new File(localUri).exists;
  } catch {
    return false;
  }
}

/**
 * Download a track to local storage if not already present, persist localUri
 * onto user_tracks, and return the file:// URI. Returns null on failure
 * (network, disk full, etc.) — caller should fall back to streaming.
 */
export async function ensureLocalCopy(
  track: Track & { id: string; fileKey: string; format: string | null },
  userId: string,
): Promise<string | null> {
  if (!userId) return null;

  const existing = inFlight.get(track.id);
  if (existing) return existing;

  const promise = (async (): Promise<string | null> => {
    try {
      const target = localFileFor(track.id, track.format);
      if (target.exists && (target.size ?? 0) > 0) {
        await persistLocalUri(userId, track.id, target.uri);
        return target.uri;
      }

      const url = await getDownloadUrl(track.fileKey);
      const downloaded = await File.downloadFileAsync(url, target);
      const finalUri = downloaded.uri;
      await persistLocalUri(userId, track.id, finalUri);
      return finalUri;
    } catch (e: any) {
      console.warn(
        `[localAudio] download failed for ${track.id}:`,
        e?.message ?? e,
      );
      return null;
    } finally {
      inFlight.delete(track.id);
    }
  })();

  inFlight.set(track.id, promise);
  return promise;
}

async function persistLocalUri(userId: string, trackId: string, uri: string) {
  await getDb()
    .update(userTracks)
    .set({ localUri: uri })
    .where(
      and(eq(userTracks.userId, userId), eq(userTracks.trackId, trackId)),
    );
}

/**
 * Download every user-owned track that doesn't yet have a localUri.
 * Concurrency-limited so we don't hammer R2 or device disk on a full sweep.
 * Fire-and-forget; logs progress, swallows errors per-track.
 */
export async function backfillLocalCache(
  userId: string,
  concurrency = 2,
): Promise<void> {
  const rows = await getDb()
    .select({
      id: tracks.id,
      fileKey: tracks.fileKey,
      format: tracks.format,
      title: tracks.title,
    })
    .from(userTracks)
    .innerJoin(tracks, eq(userTracks.trackId, tracks.id))
    .where(
      and(eq(userTracks.userId, userId), isNull(userTracks.localUri)),
    );

  if (rows.length === 0) return;
  console.log(`[localAudio] backfill: ${rows.length} track(s) to download`);

  let cursor = 0;
  let done = 0;
  async function worker() {
    while (cursor < rows.length) {
      const r = rows[cursor++]!;
      await ensureLocalCopy(r as any, userId);
      done++;
    }
  }
  const workerCount = Math.min(concurrency, rows.length);
  await Promise.all(Array.from({ length: workerCount }, worker));
  console.log(`[localAudio] backfill complete: ${done}/${rows.length}`);
}

/** Total bytes used by all tracks under the audio cache directory. */
export function getCacheSizeBytes(): number {
  try {
    return tracksDir().size ?? 0;
  } catch {
    return 0;
  }
}

/** Delete every cached audio file and clear localUri on user_tracks. */
export async function clearLocalCache(userId: string): Promise<void> {
  try {
    const dir = tracksDir();
    if (dir.exists) dir.delete();
  } catch (e: any) {
    console.warn("[localAudio] dir delete failed:", e?.message ?? e);
  }

  await getDb()
    .update(userTracks)
    .set({ localUri: null })
    .where(
      and(eq(userTracks.userId, userId), isNotNull(userTracks.localUri)),
    );
}
