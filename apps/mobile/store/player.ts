import { playbackState, tracks, userTracks } from "@metropol/db";
import type { Track } from "@metropol/types";
import { eq, and } from "drizzle-orm";
import { create } from "zustand";
import { getDb } from "../lib/db";
import { getDownloadUrl } from "../lib/r2";
import { getTrackPlayer, setupPlayer } from "../lib/trackPlayer";

interface PlayerState {
  currentTrack: Track | null;
  playbackRate: number;
  currentPlaylistId: string | null;
  debugInfo: string;
  playing: boolean;
  position: number;
  duration: number;

  loadTrack: (trackId: string, userId: string) => Promise<void>;
  setRate: (rate: number, userId: string) => Promise<void>;
  savePosition: (userId: string) => Promise<void>;
  setPlaylistContext: (playlistId: string | null) => void;
  reset: () => void;
}

let pollInterval: ReturnType<typeof setInterval> | null = null;

function startPolling() {
  if (pollInterval) return;
  pollInterval = setInterval(async () => {
    const tp = getTrackPlayer();
    if (!tp) return;
    try {
      const progress = await tp.getProgress();
      const state = await tp.getPlaybackState();
      usePlayerStore.setState({
        position: progress.position,
        duration: progress.duration,
        playing: state.state === "playing",
      });
    } catch {
      // Player not ready yet — try again next tick
    }
  }, 200);
}

/** Upsert a partial playback state row — only the provided fields are updated. */
async function upsertPlaybackState(
  userId: string,
  trackId: string,
  fields: { playbackRate?: number; lastPosition?: number },
) {
  await getDb()
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
  debugInfo: "",
  playing: false,
  position: 0,
  duration: 0,

  loadTrack: async (trackId, userId) => {
    if (get().currentTrack?.id === trackId) {
      console.log("[player.loadTrack]", `already loaded ${trackId} — keeping playback`);
      return;
    }

    const log: string[] = [];
    const dbg = (msg: string) => {
      console.log("[player.loadTrack]", msg);
      log.push(msg);
      set({ debugInfo: log.join("\n") });
    };

    try {
      dbg("setupPlayer...");
      const playerReady = await setupPlayer();
      const tp = getTrackPlayer();
      dbg(`ready=${playerReady} tp=${!!tp}`);
      if (playerReady) startPolling();

      // Fetch track from DB (join through userTracks for userId scoping)
      const [track] = await getDb()
        .select({
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
          originalBpm: userTracks.originalBpm,
        })
        .from(userTracks)
        .innerJoin(tracks, eq(userTracks.trackId, tracks.id))
        .where(and(eq(tracks.id, trackId), eq(userTracks.userId, userId)));

      if (!track) { dbg("track NOT FOUND in DB"); return; }
      dbg(`track="${track.title}" key=${track.fileKey}`);

      // Fetch saved playback state
      const [saved] = await getDb()
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
        dbg(`FULL_URL=${url}`);

        try {
          const resp = await fetch(url, { headers: { Range: "bytes=0-0" } });
          const body = await resp.text();
          dbg(`GET ${resp.status} ct=${resp.headers.get("content-type")} len=${resp.headers.get("content-length")} body=${body.substring(0, 200)}`);
        } catch (e: any) {
          dbg(`GET failed: ${e?.message}`);
        }

        await tp.reset();
        await tp.add({
          url,
          title: track.title,
          artist: track.artist ?? undefined,
          duration: track.duration ?? undefined,
        });

        const queue = await tp.getQueue();
        const state = await tp.getPlaybackState();
        dbg(`queue=${queue.length} state=${JSON.stringify(state)}`);

        await tp.setRate(rate);

        if (position > 0) {
          await tp.seekTo(position);
        }
        dbg("load complete");
      } else {
        dbg(`SKIP: ready=${playerReady} tp=${!!tp}`);
      }

      set({ currentTrack: track as Track, playbackRate: rate });
    } catch (e: any) {
      dbg(`ERROR: ${e?.message ?? e}`);
    }

    // Update lastPlayedAt (if column exists — skip for now as schema has no lastPlayedAt)
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
