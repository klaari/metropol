import { tracks, userTracks } from "@aani/db";
import type { DiscogsMetadata } from "@aani/db";
import type { LibraryTrack } from "@aani/types";
import { eq, desc, sql } from "drizzle-orm";
import { create } from "zustand";
import { getDb } from "../lib/db";
import { deleteObject } from "../lib/r2";

export type SortOption = "date" | "title" | "bpm";

interface LibraryState {
  tracks: LibraryTrack[];
  isLoading: boolean;
  error: string | null;
  sort: SortOption;

  setSort: (sort: SortOption) => void;
  fetchTracks: (userId: string) => Promise<void>;
  addTrack: (track: LibraryTrack) => void;
  updateTrack: (
    trackId: string,
    data: { title: string; artist: string | null; originalBpm: number | null },
  ) => Promise<void>;
  deleteTrack: (trackId: string) => Promise<void>;
}

function sortTracks(list: LibraryTrack[], sort: SortOption): LibraryTrack[] {
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
          new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime(),
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
      const inCollection = sql<boolean>`EXISTS (
        SELECT 1 FROM discogs_user_releases dur
        WHERE dur.user_id = ${userId}
          AND dur.release_id = ${tracks.discogsReleaseId}
          AND dur.type = 'collection'
      )`;
      const inWantlist = sql<boolean>`EXISTS (
        SELECT 1 FROM discogs_user_releases dur
        WHERE dur.user_id = ${userId}
          AND dur.release_id = ${tracks.discogsReleaseId}
          AND dur.type = 'wantlist'
      )`;
      const rows = await getDb()
        .select({
          id: tracks.id,
          source: tracks.source,
          sourceId: tracks.sourceId,
          contentHash: tracks.contentHash,
          title: tracks.title,
          artist: tracks.artist,
          duration: tracks.duration,
          fileKey: tracks.fileKey,
          fileSize: tracks.fileSize,
          format: tracks.format,
          sourceUrl: tracks.sourceUrl,
          downloadedAt: tracks.downloadedAt,
          discogsReleaseId: tracks.discogsReleaseId,
          discogsMetadata: tracks.discogsMetadata,
          inDiscogsCollection: inCollection,
          inDiscogsWantlist: inWantlist,
          userTrackId: userTracks.id,
          addedAt: userTracks.addedAt,
          originalBpm: userTracks.originalBpm,
          localUri: userTracks.localUri,
        })
        .from(userTracks)
        .innerJoin(tracks, eq(userTracks.trackId, tracks.id))
        .where(eq(userTracks.userId, userId))
        .orderBy(desc(userTracks.addedAt));
      const mapped: LibraryTrack[] = rows.map((r) => {
        const meta = r.discogsMetadata as DiscogsMetadata | null;
        const { discogsMetadata, ...rest } = r;
        return {
          ...(rest as unknown as LibraryTrack),
          discogsCoverUrl: meta?.coverUrl ?? null,
          discogsThumbUrl: meta?.thumbUrl ?? null,
        };
      });
      set({ tracks: mapped, isLoading: false });
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
      await getDb()
        .update(tracks)
        .set({
          title: data.title,
          artist: data.artist,
        })
        .where(eq(tracks.id, trackId));

      if (data.originalBpm !== undefined) {
        const ut = get().tracks.find((t) => t.id === trackId);
        if (ut) {
          await getDb()
            .update(userTracks)
            .set({ originalBpm: data.originalBpm })
            .where(eq(userTracks.id, ut.userTrackId));
        }
      }

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
      await getDb().delete(tracks).where(eq(tracks.id, trackId));
      set({ tracks: get().tracks.filter((t) => t.id !== trackId) });
    } catch (err) {
      set({
        error:
          err instanceof Error ? err.message : "Failed to delete track",
      });
    }
  },
}));
