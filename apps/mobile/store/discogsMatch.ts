import { tracks } from "@aani/db";
import { eq } from "drizzle-orm";
import { create } from "zustand";
import { apiFetch } from "../lib/api";
import { getDb } from "../lib/db";
import { useLibraryStore } from "./library";

interface MatchHit {
  releaseId: string;
  type: "collection" | "wantlist";
  artist: string | null;
  title: string | null;
  label: string | null;
  catalogNumber: string | null;
  year: number | null;
  format: string | null;
  thumbUrl: string | null;
  coverUrl: string | null;
  score: number;
}

interface AutoMatchResponse {
  matched: boolean;
  releaseId?: string;
  type?: "collection" | "wantlist";
  metadata?: {
    releaseId: string;
    artist?: string | null;
    title?: string | null;
    coverUrl?: string | null;
    thumbUrl?: string | null;
  };
  candidates: MatchHit[];
}

export type DiscogsMatchPrompt =
  | {
      kind: "matched";
      trackId: string;
      trackTitle: string;
      releaseId: string;
      type: "collection" | "wantlist";
      label: string;
    }
  | {
      kind: "candidates";
      trackId: string;
      trackTitle: string;
      candidates: MatchHit[];
    };

interface DiscogsMatchState {
  prompt: DiscogsMatchPrompt | null;
  triggerAutoMatch: (
    args: { trackId: string; trackTitle: string },
    token: string,
  ) => Promise<void>;
  dismissPrompt: () => void;
  undoMatch: (trackId: string) => Promise<void>;
}

function describeMatch(r: NonNullable<AutoMatchResponse["metadata"]>): string {
  const parts = [r.artist, r.title].filter((s): s is string => !!s && s.trim().length > 0);
  return parts.join(" — ") || r.releaseId;
}

export const useDiscogsMatchStore = create<DiscogsMatchState>((set, get) => ({
  prompt: null,

  triggerAutoMatch: async ({ trackId, trackTitle }, token) => {
    const { data, error } = await apiFetch<AutoMatchResponse>(
      "/discogs/auto-match",
      token,
      {
        method: "POST",
        body: JSON.stringify({ trackId }),
      },
    );
    if (error || !data) return;
    if (data.matched && data.releaseId && data.type && data.metadata) {
      set({
        prompt: {
          kind: "matched",
          trackId,
          trackTitle,
          releaseId: data.releaseId,
          type: data.type,
          label: describeMatch(data.metadata),
        },
      });
      return;
    }
    if (data.candidates.length > 0) {
      set({
        prompt: {
          kind: "candidates",
          trackId,
          trackTitle,
          candidates: data.candidates,
        },
      });
    }
  },

  dismissPrompt: () => set({ prompt: null }),

  undoMatch: async (trackId) => {
    try {
      await getDb()
        .update(tracks)
        .set({ discogsReleaseId: null, discogsMetadata: null })
        .where(eq(tracks.id, trackId));
      useLibraryStore.setState((s) => ({
        tracks: s.tracks.map((t) =>
          t.id === trackId
            ? {
                ...t,
                discogsReleaseId: null,
                discogsCoverUrl: null,
                discogsThumbUrl: null,
                inDiscogsCollection: false,
                inDiscogsWantlist: false,
              }
            : t,
        ),
      }));
    } finally {
      const current = get().prompt;
      if (current?.trackId === trackId) set({ prompt: null });
    }
  },
}));
