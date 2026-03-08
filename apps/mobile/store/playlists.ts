import { playlists, playlistTracks, tracks } from "@metropol/db";
import type { Playlist, Track } from "@metropol/types";
import { eq, and, asc, sql } from "drizzle-orm";
import { create } from "zustand";
import { getDb } from "../lib/db";

interface PlaylistWithCount extends Playlist {
  trackCount: number;
}

interface PlaylistsState {
  playlists: PlaylistWithCount[];
  isLoading: boolean;
  error: string | null;

  fetchPlaylists: (userId: string) => Promise<void>;
  createPlaylist: (userId: string, name: string) => Promise<void>;
  renamePlaylist: (playlistId: string, name: string) => Promise<void>;
  deletePlaylist: (playlistId: string) => Promise<void>;
  getPlaylistTracks: (playlistId: string) => Promise<(Track & { playlistTrackId: string; position: number })[]>;
  addTracksToPlaylist: (playlistId: string, trackIds: string[]) => Promise<number>;
  removeTrackFromPlaylist: (playlistTrackId: string, playlistId: string) => Promise<void>;
  reorderTrack: (playlistId: string, fromPos: number, toPos: number) => Promise<void>;
}

export const usePlaylistsStore = create<PlaylistsState>((set, get) => ({
  playlists: [],
  isLoading: false,
  error: null,

  fetchPlaylists: async (userId) => {
    set({ isLoading: true, error: null });
    try {
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

      set({ playlists: rows as PlaylistWithCount[], isLoading: false });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : "Failed to load playlists",
        isLoading: false,
      });
    }
  },

  createPlaylist: async (userId, name) => {
    try {
      const [inserted] = await db
        .insert(playlists)
        .values({ userId, name })
        .returning();

      set({
        playlists: [
          ...get().playlists,
          { ...inserted, trackCount: 0 } as PlaylistWithCount,
        ],
      });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : "Failed to create playlist",
      });
    }
  },

  renamePlaylist: async (playlistId, name) => {
    try {
      await db
        .update(playlists)
        .set({ name, updatedAt: new Date() })
        .where(eq(playlists.id, playlistId));

      set({
        playlists: get().playlists.map((p) =>
          p.id === playlistId ? { ...p, name } : p,
        ),
      });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : "Failed to rename playlist",
      });
    }
  },

  deletePlaylist: async (playlistId) => {
    try {
      await getDb().delete(playlists).where(eq(playlists.id, playlistId));
      set({ playlists: get().playlists.filter((p) => p.id !== playlistId) });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : "Failed to delete playlist",
      });
    }
  },

  getPlaylistTracks: async (playlistId) => {
    const rows = await db
      .select({
        playlistTrackId: playlistTracks.id,
        position: playlistTracks.position,
        id: tracks.id,
        userId: tracks.userId,
        title: tracks.title,
        artist: tracks.artist,
        duration: tracks.duration,
        originalBpm: tracks.originalBpm,
        fileKey: tracks.fileKey,
        fileSize: tracks.fileSize,
        format: tracks.format,
        importedAt: tracks.importedAt,
        lastPlayedAt: tracks.lastPlayedAt,
      })
      .from(playlistTracks)
      .innerJoin(tracks, eq(playlistTracks.trackId, tracks.id))
      .where(eq(playlistTracks.playlistId, playlistId))
      .orderBy(asc(playlistTracks.position));

    return rows as (Track & { playlistTrackId: string; position: number })[];
  },

  addTracksToPlaylist: async (playlistId, trackIds) => {
    // Get existing entries for this playlist
    const existing = await db
      .select({ trackId: playlistTracks.trackId, position: playlistTracks.position })
      .from(playlistTracks)
      .where(eq(playlistTracks.playlistId, playlistId))
      .orderBy(playlistTracks.position);

    // Filter out tracks already in the playlist
    const existingTrackIds = new Set(existing.map((r) => r.trackId));
    const newTrackIds = trackIds.filter((id) => !existingTrackIds.has(id));

    if (newTrackIds.length === 0) return 0;

    let nextPos = existing.length > 0 ? existing[existing.length - 1]!.position + 1 : 0;

    const values = newTrackIds.map((trackId) => ({
      playlistId,
      trackId,
      position: nextPos++,
    }));

    await getDb().insert(playlistTracks).values(values);

    // Update local count
    set({
      playlists: get().playlists.map((p) =>
        p.id === playlistId
          ? { ...p, trackCount: p.trackCount + newTrackIds.length }
          : p,
      ),
    });

    return newTrackIds.length;
  },

  removeTrackFromPlaylist: async (playlistTrackId, playlistId) => {
    await db
      .delete(playlistTracks)
      .where(eq(playlistTracks.id, playlistTrackId));

    // Update local count
    set({
      playlists: get().playlists.map((p) =>
        p.id === playlistId
          ? { ...p, trackCount: Math.max(0, p.trackCount - 1) }
          : p,
      ),
    });
  },

  reorderTrack: async (playlistId, fromPos, toPos) => {
    // Fetch all playlist tracks in order
    const rows = await db
      .select()
      .from(playlistTracks)
      .where(eq(playlistTracks.playlistId, playlistId))
      .orderBy(asc(playlistTracks.position));

    if (fromPos < 0 || fromPos >= rows.length || toPos < 0 || toPos >= rows.length) return;

    // Move item
    const items = [...rows];
    const [moved] = items.splice(fromPos, 1);
    items.splice(toPos, 0, moved!);

    // Update positions
    for (let i = 0; i < items.length; i++) {
      if (items[i]!.position !== i) {
        await db
          .update(playlistTracks)
          .set({ position: i })
          .where(eq(playlistTracks.id, items[i]!.id));
      }
    }
  },
}));
