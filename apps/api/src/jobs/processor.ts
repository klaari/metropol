import { rm } from "node:fs/promises";
import { eq } from "drizzle-orm";
import { createDb } from "@metropol/db";
import { downloadJobs, tracks } from "@metropol/db";
import type { WsJobStatusMessage, DownloadJobStatus } from "@metropol/types";
import { env } from "../lib/env";
import { uploadToR2, deleteFromR2 } from "../lib/r2";
import { getMetadata, downloadAudio } from "./ytdlp";
import { setProcessor, type QueueJob } from "./queue";
import { broadcast } from "../ws/connections";

const db = createDb(env.databaseUrl);

function buildStatusMessage(
  jobId: string,
  status: DownloadJobStatus,
  extra: Partial<WsJobStatusMessage> = {},
): WsJobStatusMessage {
  return {
    type: "job:status",
    jobId,
    status,
    title: null,
    artist: null,
    duration: null,
    trackId: null,
    error: null,
    progress: null,
    ...extra,
  };
}

async function updateJobStatus(
  jobId: string,
  data: Record<string, unknown>,
) {
  await db
    .update(downloadJobs)
    .set(data)
    .where(eq(downloadJobs.id, jobId));
}

async function processJob(job: QueueJob) {
  const { jobId, userId, url } = job;
  let fileKey: string | null = null;
  let cleanupDir: string | null = null;

  try {
    // Step 1: Set downloading
    await updateJobStatus(jobId, { status: "downloading" });
    broadcast(userId, buildStatusMessage(jobId, "downloading"));

    // Step 2: Get metadata
    const meta = await getMetadata(url);
    await updateJobStatus(jobId, {
      title: meta.title,
      artist: meta.artist,
      duration: meta.duration,
    });
    broadcast(
      userId,
      buildStatusMessage(jobId, "downloading", {
        title: meta.title,
        artist: meta.artist,
        duration: meta.duration,
      }),
    );

    // Step 3: Download audio
    const result = await downloadAudio(url);
    cleanupDir = result.cleanupDir;

    // Step 4: Upload to R2
    await updateJobStatus(jobId, { status: "uploading" });
    broadcast(userId, buildStatusMessage(jobId, "uploading", {
      title: meta.title,
      artist: meta.artist,
      duration: meta.duration,
    }));

    const trackId = crypto.randomUUID();
    fileKey = `${userId}/${trackId}.m4a`;
    const fileData = await Bun.file(result.filePath).arrayBuffer();
    await uploadToR2(fileKey, new Uint8Array(fileData), "audio/mp4");

    // Step 5: Insert track into DB
    await db.insert(tracks).values({
      id: trackId,
      userId,
      title: meta.title,
      artist: meta.artist,
      duration: meta.duration,
      fileKey,
      fileSize: fileData.byteLength,
      format: "m4a",
      sourceUrl: url,
    });

    // Step 6: Mark job completed
    await updateJobStatus(jobId, {
      status: "completed",
      trackId,
      completedAt: new Date(),
    });
    broadcast(
      userId,
      buildStatusMessage(jobId, "completed", {
        title: meta.title,
        artist: meta.artist,
        duration: meta.duration,
        trackId,
      }),
    );
  } catch (err) {
    const errorMsg =
      err instanceof Error ? err.message : "Unknown error";
    console.error(`[processor] Job ${jobId} failed:`, errorMsg);

    // Clean up orphaned R2 object
    if (fileKey) {
      try {
        await deleteFromR2(fileKey);
      } catch {
        console.error(`[processor] Failed to clean up R2 object: ${fileKey}`);
      }
    }

    await updateJobStatus(jobId, {
      status: "failed",
      error: errorMsg,
      completedAt: new Date(),
    });
    broadcast(userId, buildStatusMessage(jobId, "failed", { error: errorMsg }));
  } finally {
    if (cleanupDir) {
      await rm(cleanupDir, { recursive: true, force: true }).catch(() => {});
    }
  }
}

export function initProcessor() {
  setProcessor(processJob);
}

export async function recoverStaleJobs() {
  const stale = await db
    .select()
    .from(downloadJobs)
    .where(eq(downloadJobs.status, "downloading"));
  const staleUploading = await db
    .select()
    .from(downloadJobs)
    .where(eq(downloadJobs.status, "uploading"));

  for (const job of [...stale, ...staleUploading]) {
    console.log(`[processor] Resetting stale job ${job.id} to queued`);
    await updateJobStatus(job.id, { status: "queued" });
  }
}
