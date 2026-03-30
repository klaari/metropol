import { rm } from "node:fs/promises";
import { eq } from "drizzle-orm";
import { createDb } from "@metropol/db";
import { downloadJobs, tracks, userTracks } from "@metropol/db";
import type { WsJobStatusMessage, DownloadJobStatus } from "@metropol/types";
import { env } from "../lib/env";
import { uploadToR2, deleteFromR2 } from "../lib/r2";
import { getMetadata, downloadAudio, type YtDlpOptions } from "./ytdlp";
import { loadUserCookies } from "../routes/cookies";
import { setProcessor, enqueue, type QueueJob } from "./queue";
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

    // Step 2: Load user's cookies from R2
    const cookiesPath = await loadUserCookies(userId);
    const ytOpts: YtDlpOptions = { cookiesPath };

    // Step 3: Get youtubeId from the job record
    const [jobRecord] = await db
      .select()
      .from(downloadJobs)
      .where(eq(downloadJobs.id, jobId));
    const youtubeId = jobRecord?.youtubeId ?? null;

    // Step 4: Get metadata
    const meta = await getMetadata(url, ytOpts);
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

    // Step 5: Download audio
    const result = await downloadAudio(url, ytOpts);
    cleanupDir = result.cleanupDir;

    // Step 6: Upload to R2 (global path — no userId prefix)
    await updateJobStatus(jobId, { status: "uploading" });
    broadcast(userId, buildStatusMessage(jobId, "uploading", {
      title: meta.title,
      artist: meta.artist,
      duration: meta.duration,
    }));

    const trackId = crypto.randomUUID();
    fileKey = `tracks/${trackId}.m4a`;
    const fileData = await Bun.file(result.filePath).arrayBuffer();
    await uploadToR2(fileKey, new Uint8Array(fileData), "audio/mp4");

    // Step 7: Insert into global tracks table (no userId)
    if (!youtubeId) {
      throw new Error("youtubeId missing from job — cannot insert global track");
    }
    await db.insert(tracks).values({
      id: trackId,
      youtubeId,
      title: meta.title,
      artist: meta.artist,
      duration: meta.duration,
      fileKey,
      fileSize: fileData.byteLength,
      format: "m4a",
      sourceUrl: url,
    });

    // Step 8: Link track to user in user_tracks
    await db
      .insert(userTracks)
      .values({ userId, trackId })
      .onConflictDoNothing();

    // Step 9: Mark job completed
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
  // Jobs stuck in downloading/uploading crashed mid-processing — mark failed
  const stale = await db
    .select()
    .from(downloadJobs)
    .where(eq(downloadJobs.status, "downloading"));
  const staleUploading = await db
    .select()
    .from(downloadJobs)
    .where(eq(downloadJobs.status, "uploading"));

  for (const job of [...stale, ...staleUploading]) {
    console.log(`[processor] Marking crashed job ${job.id} as failed`);
    await updateJobStatus(job.id, {
      status: "failed",
      error: "Server restarted while job was in progress",
      completedAt: new Date(),
    });
    broadcast(
      job.userId,
      buildStatusMessage(job.id, "failed", {
        title: job.title,
        artist: job.artist,
        duration: job.duration,
        error: "Server restarted while job was in progress",
      }),
    );
  }

  // Re-enqueue jobs that were queued but never started
  const queued = await db
    .select()
    .from(downloadJobs)
    .where(eq(downloadJobs.status, "queued"));

  for (const job of queued) {
    console.log(`[processor] Re-enqueuing queued job ${job.id}`);
    enqueue({ jobId: job.id, userId: job.userId, url: job.url });
  }
}
