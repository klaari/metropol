import { create } from "zustand";
import type { WsDiscogsSyncMessage } from "@aani/types";
import { apiFetch } from "../lib/api";

export type DiscogsSyncStatus =
  | { state: "idle" }
  | {
      state: "running";
      phase: "starting" | "collection" | "wantlist";
      collection: number;
      wantlist: number;
    }
  | {
      state: "done";
      collection: number;
      wantlist: number;
      total: number;
      durationMs: number;
      finishedAt: number;
    }
  | { state: "error"; error: string; finishedAt: number };

interface DiscogsCounts {
  collection: number;
  wantlist: number;
}

const AUTO_SYNC_MIN_INTERVAL_MS = 5 * 60 * 1000;

interface DiscogsSyncState {
  status: DiscogsSyncStatus;
  counts: DiscogsCounts | null;
  countsLoading: boolean;
  lastSyncStartedAt: number | null;
  fetchCounts: (token: string) => Promise<void>;
  startSync: (
    token: string,
    opts?: { incremental?: boolean },
  ) => Promise<{ error: string | null }>;
  maybeIncrementalSync: (token: string) => Promise<void>;
  handleWsMessage: (msg: WsDiscogsSyncMessage) => void;
}

export const useDiscogsSyncStore = create<DiscogsSyncState>((set, get) => ({
  status: { state: "idle" },
  counts: null,
  countsLoading: false,
  lastSyncStartedAt: null,

  fetchCounts: async (token) => {
    set({ countsLoading: true });
    const { data } = await apiFetch<DiscogsCounts>(
      "/discogs/local/counts",
      token,
    );
    set({
      counts: data ?? { collection: 0, wantlist: 0 },
      countsLoading: false,
    });
  },

  startSync: async (token, opts = {}) => {
    const path = opts.incremental
      ? "/discogs/sync?mode=incremental"
      : "/discogs/sync";
    const { error } = await apiFetch<{ status: string }>(path, token, {
      method: "POST",
    });
    if (error) return { error };
    set({
      status: {
        state: "running",
        phase: "starting",
        collection: 0,
        wantlist: 0,
      },
      lastSyncStartedAt: Date.now(),
    });
    return { error: null };
  },

  maybeIncrementalSync: async (token) => {
    const { status, lastSyncStartedAt } = get();
    if (status.state === "running") return;
    if (
      lastSyncStartedAt != null &&
      Date.now() - lastSyncStartedAt < AUTO_SYNC_MIN_INTERVAL_MS
    ) {
      return;
    }
    await get().startSync(token, { incremental: true });
  },

  handleWsMessage: (msg) => {
    if (msg.phase === "done") {
      set({
        status: {
          state: "done",
          collection: msg.collection,
          wantlist: msg.wantlist,
          total: msg.total ?? msg.collection + msg.wantlist,
          durationMs: msg.durationMs ?? 0,
          finishedAt: Date.now(),
        },
        counts: { collection: msg.collection, wantlist: msg.wantlist },
      });
      return;
    }
    if (msg.phase === "error") {
      set({
        status: {
          state: "error",
          error: msg.error ?? "Sync failed",
          finishedAt: Date.now(),
        },
      });
      return;
    }
    set({
      status: {
        state: "running",
        phase: msg.phase,
        collection: msg.collection,
        wantlist: msg.wantlist,
      },
    });
  },
}));
