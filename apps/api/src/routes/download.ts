import { Hono } from "hono";
import { eq, and, desc, notInArray } from "drizzle-orm";
import { createDb, downloadJobs, tracks, userTracks } from "@metropol/db";
import { clerkAuth } from "../middleware/auth";
import { env } from "../lib/env";
import { enqueue } from "../jobs/queue";

const db = createDb(env.databaseUrl);

const YOUTUBE_URL_RE =
  /^https?:\/\/(www\.)?(youtube\.com|youtu\.be|music\.youtube\.com)\//;

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

downloadRoute.get("/tracks/discover", async (_c) => {
  // Stub: future Discover feature — returns recent global tracks not in user's library
  return _c.json([]);
});
