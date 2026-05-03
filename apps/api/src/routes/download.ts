import { unlink } from "node:fs/promises";
import { Hono } from "hono";
import { eq, and, desc, notInArray } from "drizzle-orm";
import { createDb, downloadJobs, tracks, userTracks } from "@aani/db";
import { clerkAuth } from "../middleware/auth";
import { env } from "../lib/env";
import { enqueue } from "../jobs/queue";
import { getPresignedUrl, uploadToR2 } from "../lib/r2";
import { detectBpm } from "../lib/bpm";

const db = createDb(env.databaseUrl);

const YOUTUBE_URL_RE =
  /^https?:\/\/(www\.)?(youtube\.com|youtu\.be|music\.youtube\.com)\//;

const MAX_UPLOAD_BYTES = 200 * 1024 * 1024; // 200 MB

const AUDIO_MIME_TO_EXT: Record<string, string> = {
  "audio/mpeg": "mp3",
  "audio/mp4": "m4a",
  "audio/x-m4a": "m4a",
  "audio/aac": "aac",
  "audio/ogg": "ogg",
  "audio/flac": "flac",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
};

const ALLOWED_EXTENSIONS = new Set(Object.values(AUDIO_MIME_TO_EXT));

function extractYoutubeId(url: string): string | null {
  const patterns = [
    /[?&]v=([a-zA-Z0-9_-]{11})/,
    /youtu\.be\/([a-zA-Z0-9_-]{11})/,
  ];
  for (const re of patterns) {
    const match = url.match(re);
    if (match) return match[1];
  }
  return null;
}

type AuthEnv = {
  Variables: {
    userId: string;
  };
};

export const downloadRoute = new Hono<AuthEnv>();

downloadRoute.use("/downloads", clerkAuth);
downloadRoute.use("/downloads/*", clerkAuth);
downloadRoute.use("/tracks", clerkAuth);
downloadRoute.use("/tracks/*", clerkAuth);

downloadRoute.post("/downloads", async (c) => {
  const userId = c.get("userId");
  const body = await c.req.json<{ url?: string }>();

  if (!body.url || typeof body.url !== "string") {
    return c.json({ error: "url is required" }, 400);
  }

  if (!YOUTUBE_URL_RE.test(body.url)) {
    return c.json({ error: "Invalid YouTube URL" }, 400);
  }

  const youtubeId = extractYoutubeId(body.url);
  if (!youtubeId) {
    return c.json({ error: "Could not extract YouTube video ID from URL" }, 400);
  }

  // Check if track with this youtubeId already exists globally
  const [existingTrack] = await db
    .select()
    .from(tracks)
    .where(eq(tracks.youtubeId, youtubeId));

  if (existingTrack) {
    // Track already in global library — just link to this user if not already linked
    await db
      .insert(userTracks)
      .values({ userId, trackId: existingTrack.id })
      .onConflictDoNothing();

    // Return a synthetic completed job response
    const syntheticJob = {
      id: crypto.randomUUID(),
      userId,
      url: body.url,
      youtubeId,
      status: "completed" as const,
      title: existingTrack.title,
      artist: existingTrack.artist,
      duration: existingTrack.duration,
      trackId: existingTrack.id,
      error: null,
      createdAt: new Date(),
      completedAt: new Date(),
    };
    return c.json(syntheticJob, 201);
  }

  // Check for existing active job with the same URL
  const existing = await db
    .select()
    .from(downloadJobs)
    .where(
      and(
        eq(downloadJobs.userId, userId),
        eq(downloadJobs.url, body.url),
        notInArray(downloadJobs.status, ["completed", "failed"]),
      ),
    );

  if (existing.length > 0) {
    return c.json({ error: "A download for this URL is already in progress" }, 409);
  }

  const [job] = await db
    .insert(downloadJobs)
    .values({ userId, url: body.url, youtubeId })
    .returning();

  enqueue({ jobId: job.id, userId, url: body.url });

  return c.json(job, 201);
});

downloadRoute.delete("/downloads/:id", async (c) => {
  const userId = c.get("userId");
  const jobId = c.req.param("id");

  const [job] = await db
    .select()
    .from(downloadJobs)
    .where(and(eq(downloadJobs.id, jobId), eq(downloadJobs.userId, userId)));

  if (!job) {
    return c.json({ error: "Job not found" }, 404);
  }

  if (job.status === "downloading" || job.status === "uploading") {
    return c.json({ error: "Cannot delete a job that is in progress" }, 409);
  }

  await db
    .delete(downloadJobs)
    .where(eq(downloadJobs.id, jobId));

  return c.json({ ok: true });
});

downloadRoute.get("/downloads", async (c) => {
  const userId = c.get("userId");

  const jobs = await db
    .select()
    .from(downloadJobs)
    .where(eq(downloadJobs.userId, userId))
    .orderBy(desc(downloadJobs.createdAt));

  return c.json(jobs);
});

downloadRoute.get("/tracks", async (c) => {
  const userId = c.get("userId");

  const rows = await db
    .select()
    .from(userTracks)
    .innerJoin(tracks, eq(userTracks.trackId, tracks.id))
    .where(eq(userTracks.userId, userId))
    .orderBy(desc(userTracks.addedAt));

  // Flatten join result into LibraryTrack shape
  const libraryTracks = rows.map(({ user_tracks, tracks: t }) => ({
    ...t,
    userTrackId: user_tracks.id,
    addedAt: user_tracks.addedAt,
    originalBpm: user_tracks.originalBpm,
  }));

  return c.json(libraryTracks);
});

downloadRoute.post("/tracks/upload", async (c) => {
  const userId = c.get("userId");
  const formData = await c.req.formData();

  const file = formData.get("file");
  if (!file || !(file instanceof File)) {
    return c.json({ error: "file is required" }, 400);
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    return c.json({ error: "File too large (max 200 MB)" }, 400);
  }

  const extFromName = file.name.match(/\.(\w+)$/)?.[1]?.toLowerCase();
  const format = AUDIO_MIME_TO_EXT[file.type]
    ?? (extFromName && ALLOWED_EXTENSIONS.has(extFromName) ? extFromName : null);
  if (!format) {
    return c.json({ error: "Unsupported audio format" }, 400);
  }

  const title = (formData.get("title") as string | null)?.trim()
    || file.name.replace(/\.\w+$/, "");
  const artist = (formData.get("artist") as string | null)?.trim() || null;

  const trackId = crypto.randomUUID();
  const fileKey = `tracks/${trackId}.${format}`;
  const buffer = new Uint8Array(await file.arrayBuffer());

  const tmpPath = `/tmp/aani-upload-${trackId}.${format}`;
  let duration: number | null = null;
  let originalBpm: number | null = null;
  try {
    await Bun.write(tmpPath, buffer);
    const proc = Bun.spawn(
      ["ffprobe", "-v", "quiet", "-print_format", "json", "-show_format", tmpPath],
      { stdout: "pipe", stderr: "pipe" },
    );
    const output = await new Response(proc.stdout).text();
    await proc.exited;
    const parsed = JSON.parse(output);
    if (parsed.format?.duration) {
      duration = Math.round(Number(parsed.format.duration));
    }
    originalBpm = await detectBpm(tmpPath);
  } catch {
    // duration / bpm stay null
  } finally {
    unlink(tmpPath).catch(() => {});
  }

  await uploadToR2(fileKey, buffer, file.type || "application/octet-stream");

  const [track] = await db
    .insert(tracks)
    .values({
      id: trackId,
      youtubeId: `upload:${trackId}`,
      title,
      artist,
      duration,
      fileKey,
      fileSize: buffer.byteLength,
      format,
      sourceUrl: null,
    })
    .returning();

  const [userTrack] = await db
    .insert(userTracks)
    .values({ userId, trackId: track.id, originalBpm })
    .returning();

  return c.json(
    {
      ...track,
      userTrackId: userTrack.id,
      addedAt: userTrack.addedAt,
      originalBpm: userTrack.originalBpm,
    },
    201,
  );
});

downloadRoute.get("/tracks/:id/stream", async (c) => {
  const userId = c.get("userId");
  const trackId = c.req.param("id");

  // Verify the user owns this track
  const [row] = await db
    .select({
      fileKey: tracks.fileKey,
      title: tracks.title,
      artist: tracks.artist,
      format: tracks.format,
    })
    .from(userTracks)
    .innerJoin(tracks, eq(userTracks.trackId, tracks.id))
    .where(and(eq(userTracks.userId, userId), eq(tracks.id, trackId)));

  if (!row) {
    return c.json({ error: "Track not found" }, 404);
  }

  const ext = row.format ?? "m4a";
  const filename = row.artist
    ? `${row.artist} - ${row.title}.${ext}`
    : `${row.title}.${ext}`;

  const url = await getPresignedUrl(row.fileKey, 3600, filename);
  return c.json({ url });
});

downloadRoute.get("/tracks/discover", async (_c) => {
  // Stub: future Discover feature — returns recent global tracks not in user's library
  return _c.json([]);
});
