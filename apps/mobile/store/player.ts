import { playbackState, tracks } from "@markku/db";
import type { Track } from "@markku/types";
import { eq, and } from "drizzle-orm";
import { create } from "zustand";
import { db } from "../lib/db";
import { getDownloadUrl } from "../lib/r2";
import { getTrackPlayer, setupPlayer } from "../lib/trackPlayer";

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

/** Upsert a partial playback state row — only the provided fields are updated. */
async function upsertPlaybackState(
  userId: string,
  trackId: string,
  fields: { playbackRate?: number; lastPosition?: number },
) {
  await db
    .insert(playbackState)
    .values({
      userId,
      trackId,
      playbackRate: fields.playbackRate ?? 1.0,
      lastPosition: fields.lastPosition ?? 0,
    })
    .onConflictDoUpdate({
      target: [playbackState.userId, playbackState.trackId],
      set: { ...fields, updatedAt: new Date() },
    });
}

let saveDebounce: ReturnType<typeof setTimeout> | null = null;

export const usePlayerStore = create<PlayerState>((set, get) => ({
  currentTrack: null,
  playbackRate: 1.0,
  currentPlaylistId: null,

  loadTrack: async (trackId, userId) => {
    // Ensure the player is set up before calling any RNTP methods
    const playerReady = await setupPlayer();
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

    if (playerReady && tp) {
      const url = await getDownloadUrl(track.fileKey);

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

    const { currentTrack } = get();
    if (!currentTrack) return;

    if (saveDebounce) clearTimeout(saveDebounce);
    saveDebounce = setTimeout(() => {
      upsertPlaybackState(userId, currentTrack.id, { playbackRate: rate });
    }, 500);
  },

  savePosition: async (userId) => {
    const tp = getTrackPlayer();
    const { currentTrack } = get();
    if (!currentTrack || !tp) return;

    const { position } = await tp.getProgress();
    await upsertPlaybackState(userId, currentTrack.id, {
      lastPosition: Math.floor(position),
    });
  },

  setPlaylistContext: (playlistId) => {
    set({ currentPlaylistId: playlistId });
  },

  reset: () => {
    set({ currentTrack: null, playbackRate: 1.0, currentPlaylistId: null });
  },
}));
