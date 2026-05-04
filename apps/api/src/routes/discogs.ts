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
  addToWantlist,
  getRelease,
  isInCollection,
  isInWantlist,
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

async function upsertUserItem(
  userId: string,
  releaseId: string,
  type: "collection" | "wantlist",
  note: string | null,
) {
  await db
    .insert(discogsUserItems)
    .values({ userId, releaseId, type, note })
    .onConflictDoUpdate({
      target: [
        discogsUserItems.userId,
        discogsUserItems.releaseId,
        discogsUserItems.type,
      ],
      set: { note, syncedAt: new Date() },
    });
}

async function deleteUserItem(
  userId: string,
  releaseId: string,
  type: "collection" | "wantlist",
) {
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

async function getUserItem(
  userId: string,
  releaseId: string,
  type: "collection" | "wantlist",
) {
  const [row] = await db
    .select()
    .from(discogsUserItems)
    .where(
      and(
        eq(discogsUserItems.userId, userId),
        eq(discogsUserItems.releaseId, releaseId),
        eq(discogsUserItems.type, type),
      ),
    );
  return row ?? null;
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

    const [inCollection, inWantlist] = await Promise.all([
      isInCollection(releaseId),
      isInWantlist(releaseId),
    ]);

    if (inCollection) {
      const existing = await getUserItem(userId, releaseId, "collection");
      await upsertUserItem(userId, releaseId, "collection", existing?.note ?? null);
    } else {
      await deleteUserItem(userId, releaseId, "collection");
    }
    if (inWantlist) {
      const existing = await getUserItem(userId, releaseId, "wantlist");
      await upsertUserItem(userId, releaseId, "wantlist", existing?.note ?? null);
    } else {
      await deleteUserItem(userId, releaseId, "wantlist");
    }

    const localCollection = await getUserItem(userId, releaseId, "collection");
    const localWantlist = await getUserItem(userId, releaseId, "wantlist");

    return c.json({
      metadata,
      inCollection,
      inWantlist,
      collectionNote: localCollection?.note ?? null,
      wantlistNote: localWantlist?.note ?? null,
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
    return c.json({ metadata: null, inCollection: false, inWantlist: false });
  }
  const releaseId = row.discogsReleaseId;
  const [collection, wantlist] = await Promise.all([
    getUserItem(userId, releaseId, "collection"),
    getUserItem(userId, releaseId, "wantlist"),
  ]);
  return c.json({
    metadata: row.discogsMetadata,
    inCollection: !!collection,
    inWantlist: !!wantlist,
    collectionNote: collection?.note ?? null,
    wantlistNote: wantlist?.note ?? null,
  });
});

discogsRoute.post("/discogs/collection", async (c) => {
  const userId = c.get("userId");
  const { releaseId, note } = await c.req.json<{
    releaseId: string;
    note?: string;
  }>();
  if (!releaseId) return c.json({ error: "releaseId is required" }, 400);
  try {
    const already = await isInCollection(releaseId);
    if (!already) await addToCollection(releaseId);
    await upsertUserItem(userId, releaseId, "collection", note ?? null);
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
    await deleteUserItem(userId, releaseId, "collection");
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
    note?: string;
  }>();
  if (!releaseId) return c.json({ error: "releaseId is required" }, 400);
  try {
    await addToWantlist(releaseId, note);
    await upsertUserItem(userId, releaseId, "wantlist", note ?? null);
    return c.json({ ok: true });
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
    await deleteUserItem(userId, releaseId, "wantlist");
    return c.json({ ok: true });
  } catch (err) {
    const { status, body } = handleError(err);
    return c.json(body, status as 400 | 401 | 404 | 500 | 503);
  }
});

discogsRoute.patch("/discogs/note", async (c) => {
  const userId = c.get("userId");
  const { releaseId, type, note } = await c.req.json<{
    releaseId: string;
    type: "collection" | "wantlist";
    note: string | null;
  }>();
  if (!releaseId || !type) {
    return c.json({ error: "releaseId and type are required" }, 400);
  }
  if (type !== "collection" && type !== "wantlist") {
    return c.json({ error: "type must be collection or wantlist" }, 400);
  }
  const existing = await getUserItem(userId, releaseId, type);
  if (!existing) {
    return c.json({ error: "Not in your local cache; add it first" }, 404);
  }
  await upsertUserItem(userId, releaseId, type, note?.trim() || null);
  return c.json({ ok: true });
});
