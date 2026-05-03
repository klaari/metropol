import { Hono } from "hono";
import { eq, and, asc, desc, sql } from "drizzle-orm";
import { createDb, playlists, playlistTracks, tracks, userTracks } from "@aani/db";
import { clerkAuth } from "../middleware/auth";
import { env } from "../lib/env";

const db = createDb(env.databaseUrl);

type AuthEnv = { Variables: { userId: string } };

export const playlistsRoute = new Hono<AuthEnv>();
playlistsRoute.use("/playlists*", clerkAuth);

// List playlists
playlistsRoute.get("/playlists", async (c) => {
  const userId = c.get("userId");
  const rows = await db
    .select({
      id: playlists.id,
      userId: playlists.userId,
      name: playlists.name,
      createdAt: playlists.createdAt,
      updatedAt: playlists.updatedAt,
      trackCount: sql<number>`cast(count(${playlistTracks.id}) as int)`,
    })
    .from(playlists)
    .leftJoin(playlistTracks, eq(playlists.id, playlistTracks.playlistId))
    .where(eq(playlists.userId, userId))
    .groupBy(playlists.id)
    .orderBy(playlists.createdAt);
  return c.json(rows);
});

// Create playlist
playlistsRoute.post("/playlists", async (c) => {
  const userId = c.get("userId");
  const { name } = await c.req.json<{ name: string }>();
  if (!name?.trim()) return c.json({ error: "name is required" }, 400);
  const [row] = await db.insert(playlists).values({ userId, name: name.trim() }).returning();
  return c.json({ ...row, trackCount: 0 }, 201);
});

// Rename playlist
playlistsRoute.patch("/playlists/:id", async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");
  const { name } = await c.req.json<{ name: string }>();
  if (!name?.trim()) return c.json({ error: "name is required" }, 400);
  const [row] = await db
    .update(playlists)
    .set({ name: name.trim(), updatedAt: new Date() })
    .where(and(eq(playlists.id, id), eq(playlists.userId, userId)))
    .returning();
  if (!row) return c.json({ error: "Not found" }, 404);
  return c.json(row);
});

// Delete playlist
playlistsRoute.delete("/playlists/:id", async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");
  await db.delete(playlists).where(and(eq(playlists.id, id), eq(playlists.userId, userId)));
  return c.json({ ok: true });
});

// Get playlist tracks
playlistsRoute.get("/playlists/:id/tracks", async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");

  // Verify ownership
  const [playlist] = await db.select().from(playlists).where(and(eq(playlists.id, id), eq(playlists.userId, userId)));
  if (!playlist) return c.json({ error: "Not found" }, 404);

  const rows = await db
    .select({
      playlistTrackId: playlistTracks.id,
      position: playlistTracks.position,
      id: tracks.id,
      youtubeId: tracks.youtubeId,
      title: tracks.title,
      artist: tracks.artist,
      duration: tracks.duration,
      fileKey: tracks.fileKey,
      fileSize: tracks.fileSize,
      format: tracks.format,
      sourceUrl: tracks.sourceUrl,
      downloadedAt: tracks.downloadedAt,
    })
    .from(playlistTracks)
    .innerJoin(tracks, eq(playlistTracks.trackId, tracks.id))
    .where(eq(playlistTracks.playlistId, id))
    .orderBy(asc(playlistTracks.position));

  return c.json(rows);
});

// Add tracks to playlist
playlistsRoute.post("/playlists/:id/tracks", async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");
  const { trackIds } = await c.req.json<{ trackIds: string[] }>();

  const [playlist] = await db.select().from(playlists).where(and(eq(playlists.id, id), eq(playlists.userId, userId)));
  if (!playlist) return c.json({ error: "Not found" }, 404);

  const existing = await db
    .select({ trackId: playlistTracks.trackId, position: playlistTracks.position })
    .from(playlistTracks)
    .where(eq(playlistTracks.playlistId, id))
    .orderBy(playlistTracks.position);

  const existingIds = new Set(existing.map((r) => r.trackId));
  const newIds = trackIds.filter((tid) => !existingIds.has(tid));
  if (newIds.length === 0) return c.json({ added: 0 });

  let nextPos = existing.length > 0 ? existing[existing.length - 1]!.position + 1 : 0;
  await db.insert(playlistTracks).values(newIds.map((trackId) => ({ playlistId: id, trackId, position: nextPos++ })));

  return c.json({ added: newIds.length });
});

// Remove track from playlist
playlistsRoute.delete("/playlists/:id/tracks/:playlistTrackId", async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");
  const playlistTrackId = c.req.param("playlistTrackId");

  const [playlist] = await db.select().from(playlists).where(and(eq(playlists.id, id), eq(playlists.userId, userId)));
  if (!playlist) return c.json({ error: "Not found" }, 404);

  await db.delete(playlistTracks).where(eq(playlistTracks.id, playlistTrackId));
  return c.json({ ok: true });
});

// Reorder track (swap positions)
playlistsRoute.patch("/playlists/:id/tracks/reorder", async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");
  const { fromPos, toPos } = await c.req.json<{ fromPos: number; toPos: number }>();

  const [playlist] = await db.select().from(playlists).where(and(eq(playlists.id, id), eq(playlists.userId, userId)));
  if (!playlist) return c.json({ error: "Not found" }, 404);

  const rows = await db
    .select()
    .from(playlistTracks)
    .where(eq(playlistTracks.playlistId, id))
    .orderBy(asc(playlistTracks.position));

  if (fromPos < 0 || fromPos >= rows.length || toPos < 0 || toPos >= rows.length) {
    return c.json({ error: "Invalid positions" }, 400);
  }

  const items = [...rows];
  const [moved] = items.splice(fromPos, 1);
  items.splice(toPos, 0, moved!);

  for (let i = 0; i < items.length; i++) {
    if (items[i]!.position !== i) {
      await db.update(playlistTracks).set({ position: i }).where(eq(playlistTracks.id, items[i]!.id));
    }
  }

  return c.json({ ok: true });
});
