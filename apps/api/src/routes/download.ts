import { Hono } from "hono";
import { eq, and, desc, notInArray } from "drizzle-orm";
import { createDb, downloadJobs } from "@metropol/db";
import { clerkAuth } from "../middleware/auth";
import { env } from "../lib/env";
import { enqueue } from "../jobs/queue";

const db = createDb(env.databaseUrl);

const YOUTUBE_URL_RE =
  /^https?:\/\/(www\.)?(youtube\.com|youtu\.be|music\.youtube\.com)\//;

type AuthEnv = {
  Variables: {
    userId: string;
  };
};

export const downloadRoute = new Hono<AuthEnv>();

downloadRoute.use("/downloads", clerkAuth);
downloadRoute.use("/downloads/*", clerkAuth);

downloadRoute.post("/downloads", async (c) => {
  const userId = c.get("userId");
  const body = await c.req.json<{ url?: string }>();

  if (!body.url || typeof body.url !== "string") {
    return c.json({ error: "url is required" }, 400);
  }

  if (!YOUTUBE_URL_RE.test(body.url)) {
    return c.json({ error: "Invalid YouTube URL" }, 400);
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
    .values({ userId, url: body.url })
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
