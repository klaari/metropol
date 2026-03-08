import { tracks } from "@metropol/db";
import type { Track } from "@metropol/types";
import { eq, and, asc, desc } from "drizzle-orm";
import { create } from "zustand";
import { db } from "../lib/db";
import { deleteObject } from "../lib/r2";

export type SortOption = "date" | "title" | "bpm";

interface LibraryState {
  tracks: Track[];
  isLoading: boolean;
  error: string | null;
  sort: SortOption;

  setSort: (sort: SortOption) => void;
  fetchTracks: (userId: string) => Promise<void>;
  addTrack: (track: Track) => void;
  updateTrack: (
    trackId: string,
    data: { title: string; artist: string | null; originalBpm: number | null },
  ) => Promise<void>;
  deleteTrack: (trackId: string) => Promise<void>;
}

function sortTracks(list: Track[], sort: SortOption): Track[] {
  const sorted = [...list];
  switch (sort) {
    case "title":
      return sorted.sort((a, b) => a.title.localeCompare(b.title));
    case "bpm":
      return sorted.sort(
        (a, b) => (a.originalBpm ?? Infinity) - (b.originalBpm ?? Infinity),
      );
    case "date":
    default:
      return sorted.sort(
        (a, b) =>
          new Date(b.importedAt).getTime() - new Date(a.importedAt).getTime(),
      );
  }
}

export const useLibraryStore = create<LibraryState>((set, get) => ({
  tracks: [],
  isLoading: false,
  error: null,
  sort: "date",

  setSort: (sort) => {
    set({ sort, tracks: sortTracks(get().tracks, sort) });
  },

  fetchTracks: async (userId) => {
    set({ isLoading: true, error: null });
    try {
      const rows = await db
        .select()
        .from(tracks)
        .where(eq(tracks.userId, userId))
        .orderBy(desc(tracks.importedAt));
      set({ tracks: rows as Track[], isLoading: false });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : "Failed to load tracks",
        isLoading: false,
      });
    }
  },

  addTrack: (track) => {
    const state = get();
    set({ tracks: sortTracks([track, ...state.tracks], state.sort) });
  },

  updateTrack: async (trackId, data) => {
    try {
      await db
        .update(tracks)
        .set({
          title: data.title,
          artist: data.artist,
          originalBpm: data.originalBpm,
        })
        .where(eq(tracks.id, trackId));

      set({
        tracks: sortTracks(
          get().tracks.map((t) => (t.id === trackId ? { ...t, ...data } : t)),
          get().sort,
        ),
      });
    } catch (err) {
      set({
        error:
          err instanceof Error ? err.message : "Failed to update track",
      });
    }
  },

  deleteTrack: async (trackId) => {
    const track = get().tracks.find((t) => t.id === trackId);
    if (!track) return;

    try {
      await deleteObject(track.fileKey);
      await db.delete(tracks).where(eq(tracks.id, trackId));
      set({ tracks: get().tracks.filter((t) => t.id !== trackId) });
    } catch (err) {
      set({
        error:
          err instanceof Error ? err.message : "Failed to delete track",
      });
    }
  },
}));
