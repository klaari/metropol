import { Hono } from "hono";
import { and, eq } from "drizzle-orm";
import {
  createDb,
  tracks,
  userTracks,
  discogsUserItems,
  type DiscogsMetadata,
} from "@aani/db";
import { clerkAuth } from "../middleware/auth";
import { env } from "../lib/env";
import {
  DiscogsError,
  addToCollection,
  getRelease,
  getWantEntry,
  isInCollection,
  putWant,
  releaseToMetadata,
  removeFromCollection,
  removeFromWantlist,
  searchReleases,
} from "../lib/discogs";

const db = createDb(env.databaseUrl);

type AuthEnv = { Variables: { userId: string } };

export const discogsRoute = new Hono<AuthEnv>();
discogsRoute.use("/discogs/*", clerkAuth);

function handleError(err: unknown) {
  if (err instanceof DiscogsError) {
    return { status: err.status, body: { error: err.message } };
  }
  const message = err instanceof Error ? err.message : "Discogs request failed";
  return { status: 500, body: { error: message } };
}

async function userOwnsTrack(userId: string, trackId: string) {
  const [row] = await db
    .select({ id: userTracks.id })
    .from(userTracks)
    .where(and(eq(userTracks.userId, userId), eq(userTracks.trackId, trackId)));
  return !!row;
}

async function syncMembership(
  userId: string,
  releaseId: string,
  type: "collection" | "wantlist",
  isMember: boolean,
) {
  if (isMember) {
    await db
      .insert(discogsUserItems)
      .values({ userId, releaseId, type })
      .onConflictDoUpdate({
        target: [
          discogsUserItems.userId,
          discogsUserItems.releaseId,
          discogsUserItems.type,
        ],
        set: { syncedAt: new Date() },
      });
  } else {
    await db
      .delete(discogsUserItems)
      .where(
        and(
          eq(discogsUserItems.userId, userId),
          eq(discogsUserItems.releaseId, releaseId),
          eq(discogsUserItems.type, type),
        ),
      );
  }
}

discogsRoute.get("/discogs/search", async (c) => {
  const q = c.req.query("q")?.trim();
  if (!q) return c.json({ error: "q is required" }, 400);
  const perPage = Math.min(Number(c.req.query("per_page") ?? "10") || 10, 25);
  try {
    const results = await searchReleases(q, perPage);
    return c.json({ results });
  } catch (err) {
    const { status, body } = handleError(err);
    return c.json(body, status as 400 | 401 | 404 | 500 | 503);
  }
});

discogsRoute.post("/discogs/enrich", async (c) => {
  const userId = c.get("userId");
  const body = await c.req.json<{ trackId: string; releaseId: string }>();
  const { trackId, releaseId } = body;
  if (!trackId || !releaseId) {
    return c.json({ error: "trackId and releaseId are required" }, 400);
  }
  if (!(await userOwnsTrack(userId, trackId))) {
    return c.json({ error: "Track not found" }, 404);
  }

  try {
    const release = await getRelease(releaseId);
    if (!release) return c.json({ error: "Release not found" }, 404);

    const metadata: DiscogsMetadata = releaseToMetadata(release);

    await db
      .update(tracks)
      .set({
        discogsReleaseId: metadata.releaseId,
        discogsMetadata: metadata,
      })
      .where(eq(tracks.id, trackId));

    const [inCollection, wantEntry] = await Promise.all([
      isInCollection(releaseId),
      getWantEntry(releaseId),
    ]);

    await syncMembership(userId, releaseId, "collection", inCollection);
    await syncMembership(userId, releaseId, "wantlist", wantEntry.inList);

    return c.json({
      metadata,
      inCollection,
      inWantlist: wantEntry.inList,
      wantlistNote: wantEntry.note,
    });
  } catch (err) {
    const { status, body } = handleError(err);
    return c.json(body, status as 400 | 401 | 404 | 500 | 503);
  }
});

discogsRoute.delete("/discogs/track/:trackId/enrichment", async (c) => {
  const userId = c.get("userId");
  const trackId = c.req.param("trackId");
  if (!(await userOwnsTrack(userId, trackId))) {
    return c.json({ error: "Track not found" }, 404);
  }
  await db
    .update(tracks)
    .set({ discogsReleaseId: null, discogsMetadata: null })
    .where(eq(tracks.id, trackId));
  return c.json({ ok: true });
});

discogsRoute.get("/discogs/track/:trackId", async (c) => {
  const userId = c.get("userId");
  const trackId = c.req.param("trackId");
  if (!(await userOwnsTrack(userId, trackId))) {
    return c.json({ error: "Track not found" }, 404);
  }
  const [row] = await db
    .select({
      discogsReleaseId: tracks.discogsReleaseId,
      discogsMetadata: tracks.discogsMetadata,
    })
    .from(tracks)
    .where(eq(tracks.id, trackId));
  if (!row) return c.json({ error: "Track not found" }, 404);
  if (!row.discogsReleaseId) {
    return c.json({
      metadata: null,
      inCollection: false,
      inWantlist: false,
      wantlistNote: null,
    });
  }
  const releaseId = row.discogsReleaseId;
  try {
    const [inCollection, wantEntry] = await Promise.all([
      isInCollection(releaseId),
      getWantEntry(releaseId),
    ]);
    await syncMembership(userId, releaseId, "collection", inCollection);
    await syncMembership(userId, releaseId, "wantlist", wantEntry.inList);
    return c.json({
      metadata: row.discogsMetadata,
      inCollection,
      inWantlist: wantEntry.inList,
      wantlistNote: wantEntry.note,
    });
  } catch (err) {
    const { status, body } = handleError(err);
    return c.json(body, status as 400 | 401 | 404 | 500 | 503);
  }
});

discogsRoute.post("/discogs/collection", async (c) => {
  const userId = c.get("userId");
  const { releaseId } = await c.req.json<{ releaseId: string }>();
  if (!releaseId) return c.json({ error: "releaseId is required" }, 400);
  try {
    const already = await isInCollection(releaseId);
    if (!already) await addToCollection(releaseId);
    await syncMembership(userId, releaseId, "collection", true);
    return c.json({ ok: true, alreadyExists: already });
  } catch (err) {
    const { status, body } = handleError(err);
    return c.json(body, status as 400 | 401 | 404 | 500 | 503);
  }
});

discogsRoute.delete("/discogs/collection/:releaseId", async (c) => {
  const userId = c.get("userId");
  const releaseId = c.req.param("releaseId");
  try {
    const removed = await removeFromCollection(releaseId);
    await syncMembership(userId, releaseId, "collection", false);
    return c.json({ ok: true, removedInstances: removed });
  } catch (err) {
    const { status, body } = handleError(err);
    return c.json(body, status as 400 | 401 | 404 | 500 | 503);
  }
});

discogsRoute.post("/discogs/wantlist", async (c) => {
  const userId = c.get("userId");
  const { releaseId, note } = await c.req.json<{
    releaseId: string;
    note?: string | null;
  }>();
  if (!releaseId) return c.json({ error: "releaseId is required" }, 400);
  try {
    await putWant(releaseId, note);
    await syncMembership(userId, releaseId, "wantlist", true);
    const wantEntry = await getWantEntry(releaseId);
    return c.json({ ok: true, wantlistNote: wantEntry.note });
  } catch (err) {
    const { status, body } = handleError(err);
    return c.json(body, status as 400 | 401 | 404 | 500 | 503);
  }
});

discogsRoute.delete("/discogs/wantlist/:releaseId", async (c) => {
  const userId = c.get("userId");
  const releaseId = c.req.param("releaseId");
  try {
    await removeFromWantlist(releaseId);
    await syncMembership(userId, releaseId, "wantlist", false);
    return c.json({ ok: true });
  } catch (err) {
    const { status, body } = handleError(err);
    return c.json(body, status as 400 | 401 | 404 | 500 | 503);
  }
});
