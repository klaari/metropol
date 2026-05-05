import { Hono } from "hono";
import { and, eq, sql } from "drizzle-orm";
import {
  createDb,
  discogsUserReleases,
  tracks,
  userTracks,
  type DiscogsMetadata,
  type DiscogsUserReleaseType,
} from "@aani/db";
import type { WsDiscogsSyncMessage } from "@aani/types";
import { clerkAuth } from "../middleware/auth";
import { env } from "../lib/env";
import {
  DiscogsError,
  addToCollection,
  deleteUserRelease,
  getCollectionInstances,
  getRelease,
  getWantEntry,
  isInCollection,
  metadataToRow,
  putWant,
  releaseToMetadata,
  removeFromCollection,
  removeFromWantlist,
  searchLocalReleases,
  searchReleases,
  syncDiscogsForUser,
  upsertReleaseRows,
  type LocalSearchScope,
} from "../lib/discogs";
import { broadcast } from "../ws/connections";

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

/**
 * Push-on-write: keep the local mirror in sync with Discogs after the API
 * itself mutates membership. Pass `metadata` for the add path (callers fetch
 * the release if they don't already have it).
 */
async function syncMembership(
  userId: string,
  releaseId: string,
  type: DiscogsUserReleaseType,
  isMember: boolean,
  metadata: DiscogsMetadata | null,
  extras?: { note?: string | null },
) {
  if (!isMember || !metadata) {
    await deleteUserRelease(db, userId, releaseId, type);
    return;
  }
  if (type === "collection") {
    const [first] = await getCollectionInstances(releaseId);
    await upsertReleaseRows(db, [
      metadataToRow(userId, "collection", metadata, {
        folderId: first?.folder_id ?? null,
        instanceId: first?.instance_id ?? null,
      }),
    ]);
  } else {
    await upsertReleaseRows(db, [
      metadataToRow(userId, "wantlist", metadata, { notes: extras?.note ?? null }),
    ]);
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
    const metadata = await fetchReleaseMetadata(releaseId);

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

    await syncMembership(userId, releaseId, "collection", inCollection, metadata);
    await syncMembership(userId, releaseId, "wantlist", wantEntry.inList, metadata, {
      note: wantEntry.note,
    });

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
  const metadata = row.discogsMetadata;
  try {
    const [inCollection, wantEntry] = await Promise.all([
      isInCollection(releaseId),
      getWantEntry(releaseId),
    ]);
    if (metadata) {
      await syncMembership(userId, releaseId, "collection", inCollection, metadata);
      await syncMembership(userId, releaseId, "wantlist", wantEntry.inList, metadata, {
        note: wantEntry.note,
      });
    }
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

async function fetchReleaseMetadata(releaseId: string): Promise<DiscogsMetadata> {
  const release = await getRelease(releaseId);
  if (!release) throw new DiscogsError("Release not found", 404);
  return releaseToMetadata(release);
}

discogsRoute.post("/discogs/collection", async (c) => {
  const userId = c.get("userId");
  const { releaseId } = await c.req.json<{ releaseId: string }>();
  if (!releaseId) return c.json({ error: "releaseId is required" }, 400);
  try {
    const already = await isInCollection(releaseId);
    if (!already) await addToCollection(releaseId);
    const metadata = await fetchReleaseMetadata(releaseId);
    await syncMembership(userId, releaseId, "collection", true, metadata);
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
    await syncMembership(userId, releaseId, "collection", false, null);
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
    const wantEntry = await getWantEntry(releaseId);
    const metadata = await fetchReleaseMetadata(releaseId);
    await syncMembership(userId, releaseId, "wantlist", true, metadata, {
      note: wantEntry.note,
    });
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
    await syncMembership(userId, releaseId, "wantlist", false, null);
    return c.json({ ok: true });
  } catch (err) {
    const { status, body } = handleError(err);
    return c.json(body, status as 400 | 401 | 404 | 500 | 503);
  }
});

const activeSyncs = new Map<string, Promise<void>>();

function emitSync(userId: string, msg: Omit<WsDiscogsSyncMessage, "type">) {
  broadcast(userId, { type: "discogs:sync", ...msg });
}

discogsRoute.post("/discogs/sync", async (c) => {
  const userId = c.get("userId");
  const incremental = c.req.query("mode") === "incremental";

  const existing = activeSyncs.get(userId);
  if (existing) {
    return c.json({ status: "already-running" }, 409);
  }

  const start = Date.now();
  emitSync(userId, {
    phase: "starting",
    collection: 0,
    wantlist: 0,
    total: null,
    durationMs: null,
    error: null,
  });

  const run = (async () => {
    try {
      const result = await syncDiscogsForUser(db, userId, {
        incremental,
        onProgress: (p) => {
          emitSync(userId, {
            phase: p.phase,
            collection: p.collection,
            wantlist: p.wantlist,
            total: null,
            durationMs: null,
            error: null,
          });
        },
      });
      emitSync(userId, {
        phase: "done",
        collection: result.collection,
        wantlist: result.wantlist,
        total: result.collection + result.wantlist,
        durationMs: result.durationMs,
        error: null,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "sync failed";
      console.error("[discogs] sync failed for", userId, err);
      emitSync(userId, {
        phase: "error",
        collection: 0,
        wantlist: 0,
        total: null,
        durationMs: Date.now() - start,
        error: message,
      });
    } finally {
      activeSyncs.delete(userId);
    }
  })();

  activeSyncs.set(userId, run);
  return c.json({ status: "started", incremental });
});

discogsRoute.get("/discogs/local-search", async (c) => {
  const userId = c.get("userId");
  const q = c.req.query("q")?.trim();
  if (!q) return c.json({ error: "q is required" }, 400);
  const scopeParam = c.req.query("scope") as LocalSearchScope | undefined;
  const scope: LocalSearchScope =
    scopeParam === "collection" || scopeParam === "wantlist" ? scopeParam : "any";
  const limit = Math.min(Number(c.req.query("limit") ?? "10") || 10, 50);
  const results = await searchLocalReleases(db, userId, q, { scope, limit });
  return c.json({ results });
});

discogsRoute.get("/discogs/local/counts", async (c) => {
  const userId = c.get("userId");
  const rows = await db
    .select({
      type: discogsUserReleases.type,
      count: sql<number>`count(*)::int`,
    })
    .from(discogsUserReleases)
    .where(eq(discogsUserReleases.userId, userId))
    .groupBy(discogsUserReleases.type);
  const counts = { collection: 0, wantlist: 0 };
  for (const row of rows) {
    if (row.type === "collection") counts.collection = row.count;
    if (row.type === "wantlist") counts.wantlist = row.count;
  }
  return c.json(counts);
});

discogsRoute.post("/discogs/auto-match", async (c) => {
  const userId = c.get("userId");
  const body = await c.req.json<{
    trackId: string;
    scope?: LocalSearchScope;
    limit?: number;
  }>();
  const { trackId } = body;
  if (!trackId) return c.json({ error: "trackId is required" }, 400);
  if (!(await userOwnsTrack(userId, trackId))) {
    return c.json({ error: "Track not found" }, 404);
  }

  const [track] = await db
    .select({
      title: tracks.title,
      artist: tracks.artist,
    })
    .from(tracks)
    .where(eq(tracks.id, trackId));
  if (!track) return c.json({ error: "Track not found" }, 404);

  const query = [track.artist, track.title]
    .filter((v): v is string => !!v && v.trim().length > 0)
    .join(" ")
    .trim();
  if (!query) return c.json({ matched: false, candidates: [] });

  const scope = body.scope ?? "any";
  const limit = Math.min(Math.max(body.limit ?? 5, 1), 25);
  const candidates = await searchLocalReleases(db, userId, query, { scope, limit });

  if (candidates.length === 0) {
    return c.json({ matched: false, candidates: [] });
  }

  // "Exactly one hit" auto-match: a single candidate, OR a clearly dominant
  // top hit (score gap of at least 0.2 between #1 and #2). We don't auto-apply
  // weak matches.
  const [top, second] = candidates;
  const dominant =
    candidates.length === 1 ||
    (top !== undefined && second !== undefined && top.score - second.score >= 0.2);

  if (!dominant || !top) {
    return c.json({ matched: false, candidates });
  }

  try {
    const release = await getRelease(top.releaseId);
    if (!release) return c.json({ matched: false, candidates });
    const metadata = releaseToMetadata(release);
    await db
      .update(tracks)
      .set({
        discogsReleaseId: metadata.releaseId,
        discogsMetadata: metadata,
      })
      .where(eq(tracks.id, trackId));
    return c.json({
      matched: true,
      releaseId: top.releaseId,
      type: top.type,
      metadata,
      candidates,
    });
  } catch (err) {
    const { status, body } = handleError(err);
    return c.json(body, status as 400 | 401 | 404 | 500 | 503);
  }
});
