import { playbackState, queueItems, tracks, userPlayerState, userTracks } from "@metropol/db";
import type { Track } from "@metropol/types";
import { eq, and, asc } from "drizzle-orm";
import { create } from "zustand";
import { getDb } from "../lib/db";
import { getDownloadUrl } from "../lib/r2";
import { getTrackPlayer, setupPlayer } from "../lib/trackPlayer";

export interface QueueItem {
  trackId: string;
  track: Track;
}

interface PlayerState {
  queue: QueueItem[];
  currentIndex: number;

  currentTrack: Track | null;
  playbackRate: number;
  currentPlaylistId: string | null;
  debugInfo: string;
  playing: boolean;
  position: number;
  duration: number;
  initialized: boolean;
  queueSheetVisible: boolean;

  initQueue: (userId: string) => Promise<void>;
  playWithQueue: (trackIds: string[], startIndex: number, userId: string) => Promise<void>;
  addToQueue: (trackId: string, userId: string) => Promise<void>;
  playNext: (trackId: string, userId: string) => Promise<void>;
  removeAt: (index: number, userId: string) => Promise<void>;
  skipToIndex: (index: number, userId: string) => Promise<void>;
  reorder: (from: number, to: number, userId: string) => Promise<void>;
  onActiveTrackChanged: (newIndex: number) => void;
  onQueueEnded: () => void;

  setRate: (rate: number, userId: string) => Promise<void>;
  savePosition: (userId: string) => Promise<void>;
  setPlaylistContext: (playlistId: string | null) => void;
  setQueueSheetVisible: (visible: boolean) => void;
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

async function fetchTracks(trackIds: string[], userId: string): Promise<Track[]> {
  if (trackIds.length === 0) return [];
  const rows = await getDb()
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
    .where(eq(userTracks.userId, userId));

  const byId = new Map<string, Track>(rows.map((r) => [r.id, r as Track]));
  return trackIds.map((id) => byId.get(id)).filter((t): t is Track => t != null);
}

async function buildRntpTrack(track: Track) {
  const url = await getDownloadUrl(track.fileKey);
  return {
    id: track.id,
    url,
    title: track.title,
    artist: track.artist ?? undefined,
    duration: track.duration ?? undefined,
  };
}

async function persistQueue(
  userId: string,
  items: QueueItem[],
  currentIndex: number,
) {
  const db = getDb();
  await db.delete(queueItems).where(eq(queueItems.userId, userId));
  if (items.length > 0) {
    await db.insert(queueItems).values(
      items.map((it, i) => ({
        userId,
        trackId: it.trackId,
        position: i,
      })),
    );
  }
  await db
    .insert(userPlayerState)
    .values({
      userId,
      currentPosition: Math.max(0, currentIndex),
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: userPlayerState.userId,
      set: { currentPosition: Math.max(0, currentIndex), updatedAt: new Date() },
    });
}

let persistDebounce: ReturnType<typeof setTimeout> | null = null;
function schedulePersist(userId: string) {
  if (persistDebounce) clearTimeout(persistDebounce);
  persistDebounce = setTimeout(() => {
    const { queue, currentIndex } = usePlayerStore.getState();
    persistQueue(userId, queue, currentIndex).catch((e) => {
      console.warn("[player.persist]", e?.message ?? e);
    });
  }, 400);
}

export const usePlayerStore = create<PlayerState>((set, get) => ({
  queue: [],
  currentIndex: -1,
  currentTrack: null,
  playbackRate: 1.0,
  currentPlaylistId: null,
  debugInfo: "",
  playing: false,
  position: 0,
  duration: 0,
  initialized: false,
  queueSheetVisible: false,

  initQueue: async (userId) => {
    if (get().initialized) return;
    set({ initialized: true });

    try {
      await setupPlayer();
      startPolling();

      const dbItems = await getDb()
        .select({ trackId: queueItems.trackId, position: queueItems.position })
        .from(queueItems)
        .where(eq(queueItems.userId, userId))
        .orderBy(asc(queueItems.position));

      if (dbItems.length === 0) return;

      const fetched = await fetchTracks(
        dbItems.map((d) => d.trackId),
        userId,
      );
      const queue: QueueItem[] = fetched.map((t) => ({ trackId: t.id, track: t }));

      const [stateRow] = await getDb()
        .select()
        .from(userPlayerState)
        .where(eq(userPlayerState.userId, userId));
      let idx = Math.max(0, Math.min(queue.length - 1, stateRow?.currentPosition ?? 0));

      const tp = getTrackPlayer();
      if (tp && queue.length > 0) {
        const rntpTracks = await Promise.all(queue.map((q) => buildRntpTrack(q.track)));
        await tp.reset();
        await tp.add(rntpTracks);
        if (idx > 0) await tp.skip(idx);

        const [saved] = await getDb()
          .select()
          .from(playbackState)
          .where(
            and(
              eq(playbackState.userId, userId),
              eq(playbackState.trackId, queue[idx]!.trackId),
            ),
          );
        const rate = saved?.playbackRate ?? 1.0;
        const pos = saved?.lastPosition ?? 0;
        await tp.setRate(rate);
        if (pos > 0) await tp.seekTo(pos);

        set({ queue, currentIndex: idx, currentTrack: queue[idx]!.track, playbackRate: rate });
      }
    } catch (e: any) {
      console.warn("[player.initQueue]", e?.message ?? e);
    }
  },

  playWithQueue: async (trackIds, startIndex, userId) => {
    if (trackIds.length === 0) return;
    const fetched = await fetchTracks(trackIds, userId);
    if (fetched.length === 0) return;
    const queue: QueueItem[] = fetched.map((t) => ({ trackId: t.id, track: t }));
    const idx = Math.max(0, Math.min(queue.length - 1, startIndex));

    const tp = getTrackPlayer();
    if (!tp) {
      set({ queue, currentIndex: idx, currentTrack: queue[idx]!.track });
      schedulePersist(userId);
      return;
    }

    const rntpTracks = await Promise.all(queue.map((q) => buildRntpTrack(q.track)));
    await tp.reset();
    await tp.add(rntpTracks);
    if (idx > 0) await tp.skip(idx);

    // Restore the user's saved rate for this track but always start playback
    // from the beginning — saved positions are stale once another track has
    // been played in between. (Cold-start resume still works via initQueue.)
    const [saved] = await getDb()
      .select()
      .from(playbackState)
      .where(
        and(
          eq(playbackState.userId, userId),
          eq(playbackState.trackId, queue[idx]!.trackId),
        ),
      );
    const rate = saved?.playbackRate ?? 1.0;
    await tp.setRate(rate);
    await tp.play();

    set({
      queue,
      currentIndex: idx,
      currentTrack: queue[idx]!.track,
      playbackRate: rate,
    });
    schedulePersist(userId);
  },

  addToQueue: async (trackId, userId) => {
    const [track] = await fetchTracks([trackId], userId);
    if (!track) return;
    const tp = getTrackPlayer();
    const newItem: QueueItem = { trackId: track.id, track };

    const { queue } = get();
    const newQueue = [...queue, newItem];

    if (tp) await tp.add(await buildRntpTrack(track));

    set({ queue: newQueue });
    schedulePersist(userId);
  },

  playNext: async (trackId, userId) => {
    const [track] = await fetchTracks([trackId], userId);
    if (!track) return;
    const tp = getTrackPlayer();
    const newItem: QueueItem = { trackId: track.id, track };

    const { queue, currentIndex } = get();
    const insertAt = currentIndex < 0 ? 0 : currentIndex + 1;
    const newQueue = [...queue.slice(0, insertAt), newItem, ...queue.slice(insertAt)];

    if (tp) await tp.add(await buildRntpTrack(track), insertAt);

    set({ queue: newQueue });
    schedulePersist(userId);
  },

  removeAt: async (index, userId) => {
    const { queue, currentIndex } = get();
    if (index < 0 || index >= queue.length) return;
    const tp = getTrackPlayer();

    const newQueue = queue.slice(0, index).concat(queue.slice(index + 1));
    let newIndex = currentIndex;
    if (index < currentIndex) newIndex = currentIndex - 1;
    else if (index === currentIndex) {
      newIndex = Math.min(currentIndex, newQueue.length - 1);
    }

    if (tp) {
      try {
        await tp.remove(index);
      } catch (e: any) {
        console.warn("[player.removeAt]", e?.message ?? e);
      }
    }

    set({
      queue: newQueue,
      currentIndex: newIndex,
      currentTrack: newIndex >= 0 ? newQueue[newIndex]!.track : null,
    });
    schedulePersist(userId);
  },

  skipToIndex: async (index, userId) => {
    const { queue } = get();
    if (index < 0 || index >= queue.length) return;
    const tp = getTrackPlayer();

    if (tp) {
      try {
        await tp.skip(index);
        await tp.play();
      } catch (e: any) {
        console.warn("[player.skipToIndex]", e?.message ?? e);
      }
    }

    set({ currentIndex: index, currentTrack: queue[index]!.track });
    schedulePersist(userId);
  },

  reorder: async (from, to, userId) => {
    const { queue, currentIndex } = get();
    if (from < 0 || from >= queue.length || to < 0 || to >= queue.length) return;
    if (from === to) return;
    const tp = getTrackPlayer();

    const next = [...queue];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved!);

    let newIndex = currentIndex;
    if (from === currentIndex) newIndex = to;
    else if (from < currentIndex && to >= currentIndex) newIndex = currentIndex - 1;
    else if (from > currentIndex && to <= currentIndex) newIndex = currentIndex + 1;

    if (tp) {
      try {
        await tp.move(from, to);
      } catch (e: any) {
        console.warn("[player.reorder]", e?.message ?? e);
      }
    }

    set({
      queue: next,
      currentIndex: newIndex,
      currentTrack: newIndex >= 0 ? next[newIndex]!.track : null,
    });
    schedulePersist(userId);
  },

  onActiveTrackChanged: (newIndex) => {
    const { queue, currentIndex } = get();
    if (newIndex < 0 || newIndex >= queue.length) return;
    if (newIndex === currentIndex) return;
    set({
      currentIndex: newIndex,
      currentTrack: queue[newIndex]!.track,
    });
  },

  onQueueEnded: () => {
    set({ playing: false });
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

  setQueueSheetVisible: (visible) => {
    set({ queueSheetVisible: visible });
  },

  reset: () => {
    set({
      queue: [],
      currentIndex: -1,
      currentTrack: null,
      playbackRate: 1.0,
      currentPlaylistId: null,
      initialized: false,
    });
  },
}));
