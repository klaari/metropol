import { playbackState, tracks } from "@marko/db";
import type { Track } from "@marko/types";
import { eq, and } from "drizzle-orm";
import { create } from "zustand";
import { db } from "../lib/db";
import { getDownloadUrl } from "../lib/r2";
import { getTrackPlayer } from "../lib/trackPlayer";

interface PlayerState {
  currentTrack: Track | null;
  playbackRate: number;
  currentPlaylistId: string | null;

  loadTrack: (trackId: string, userId: string) => Promise<void>;
  setRate: (rate: number, userId: string) => Promise<void>;
  savePosition: (userId: string) => Promise<void>;
  setPlaylistContext: (playlistId: string | null) => void;
  reset: () => void;
}

let saveDebounce: ReturnType<typeof setTimeout> | null = null;

export const usePlayerStore = create<PlayerState>((set, get) => ({
  currentTrack: null,
  playbackRate: 1.0,
  currentPlaylistId: null,

  loadTrack: async (trackId, userId) => {
    const tp = getTrackPlayer();

    // Fetch track from DB
    const [track] = await db
      .select()
      .from(tracks)
      .where(and(eq(tracks.id, trackId), eq(tracks.userId, userId)));

    if (!track) return;

    // Fetch saved playback state
    const [saved] = await db
      .select()
      .from(playbackState)
      .where(
        and(
          eq(playbackState.trackId, trackId),
          eq(playbackState.userId, userId),
        ),
      );

    const rate = saved?.playbackRate ?? 1.0;
    const position = saved?.lastPosition ?? 0;

    // Get presigned download URL
    const url = await getDownloadUrl(track.fileKey);

    // Load into track player (if available)
    if (tp) {
      await tp.reset();
      await tp.add({
        url,
        title: track.title,
        artist: track.artist ?? undefined,
        duration: track.duration ?? undefined,
      });

      await tp.setRate(rate);

      if (position > 0) {
        await tp.seekTo(position);
      }
    }

    set({ currentTrack: track as Track, playbackRate: rate });

    // Update lastPlayedAt
    await db
      .update(tracks)
      .set({ lastPlayedAt: new Date() })
      .where(eq(tracks.id, trackId));
  },

  setRate: async (rate, userId) => {
    const tp = getTrackPlayer();
    if (tp) await tp.setRate(rate);
    set({ playbackRate: rate });

    // Debounced save to DB
    const { currentTrack } = get();
    if (!currentTrack) return;

    if (saveDebounce) clearTimeout(saveDebounce);
    saveDebounce = setTimeout(async () => {
      await db
        .insert(playbackState)
        .values({
          userId,
          trackId: currentTrack.id,
          playbackRate: rate,
        })
        .onConflictDoUpdate({
          target: [playbackState.userId, playbackState.trackId],
          set: { playbackRate: rate, updatedAt: new Date() },
        });
    }, 500);
  },

  savePosition: async (userId) => {
    const tp = getTrackPlayer();
    const { currentTrack } = get();
    if (!currentTrack || !tp) return;

    const { position } = await tp.getProgress();

    await db
      .insert(playbackState)
      .values({
        userId,
        trackId: currentTrack.id,
        lastPosition: Math.floor(position),
      })
      .onConflictDoUpdate({
        target: [playbackState.userId, playbackState.trackId],
        set: { lastPosition: Math.floor(position), updatedAt: new Date() },
      });
  },

  setPlaylistContext: (playlistId) => {
    set({ currentPlaylistId: playlistId });
  },

  reset: () => {
    set({ currentTrack: null, playbackRate: 1.0, currentPlaylistId: null });
  },
}));
