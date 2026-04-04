"use client";

import { useEffect, useRef, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import type { LibraryTrack } from "@metropol/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";

type SortOption = "date" | "title" | "bpm";

const SORT_LABELS: Record<SortOption, string> = {
  date: "Date Added",
  title: "Title A–Z",
  bpm: "BPM",
};

function formatDuration(seconds: number | null): string {
  if (seconds == null) return "--:--";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function sortTracks(tracks: LibraryTrack[], sort: SortOption): LibraryTrack[] {
  const sorted = [...tracks];
  switch (sort) {
    case "title":
      return sorted.sort((a, b) => a.title.localeCompare(b.title));
    case "bpm":
      return sorted.sort((a, b) => (a.originalBpm ?? Infinity) - (b.originalBpm ?? Infinity));
    case "date":
    default:
      return sorted.sort((a, b) => new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime());
  }
}

function groupByDate(tracks: LibraryTrack[]): { title: string; items: LibraryTrack[] }[] {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekAgo = new Date(today.getTime() - 7 * 86400000);

  const groups: Record<string, LibraryTrack[]> = {};
  const order: string[] = [];

  for (const track of tracks) {
    const added = new Date(track.addedAt);
    let label: string;
    if (added >= today) label = "Today";
    else if (added >= weekAgo) label = "This Week";
    else label = "Earlier";

    if (!groups[label]) {
      groups[label] = [];
      order.push(label);
    }
    groups[label]!.push(track);
  }

  return order.map((title) => ({ title, items: groups[title]! }));
}

function TrackRow({
  track,
  getToken,
}: {
  track: LibraryTrack;
  getToken: () => Promise<string | null>;
}) {
  const [streamUrl, setStreamUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  const handlePlay = async () => {
    if (streamUrl) {
      audioRef.current?.play();
      return;
    }
    setLoading(true);
    try {
      const token = await getToken();
      const res = await fetch(`${API_URL}/tracks/${track.id}/stream`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Could not get stream URL");
      const { url } = (await res.json()) as { url: string };
      setStreamUrl(url);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <li>
      <button
        onClick={handlePlay}
        disabled={loading}
        className="w-full flex items-center gap-3 px-2 py-2.5 hover:bg-white/5 active:bg-white/10 transition-colors text-left group"
      >
        {/* Artwork placeholder */}
        <div className="w-12 h-12 rounded-lg bg-zinc-900 flex items-center justify-center shrink-0">
          <span className="text-xl text-zinc-600">♫</span>
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className="text-white text-base font-semibold truncate">{track.title}</p>
          <p className="text-zinc-500 text-sm truncate mt-0.5">
            {track.artist ?? "Unknown artist"}
            {track.originalBpm != null ? `  ·  ${track.originalBpm} BPM` : ""}
          </p>
        </div>

        {/* Duration + play */}
        <div className="flex items-center gap-3 shrink-0">
          <span className="text-zinc-600 text-xs tabular-nums">{formatDuration(track.duration)}</span>
          <span className="text-zinc-500 text-xs opacity-0 group-hover:opacity-100 transition-opacity">
            {loading ? "…" : "▶"}
          </span>
        </div>
      </button>

      {streamUrl && (
        <div className="px-4 pb-2">
          <audio
            ref={audioRef}
            src={streamUrl}
            controls
            autoPlay
            className="w-full h-8 accent-white"
          />
        </div>
      )}
    </li>
  );
}

export default function TrackList() {
  const { getToken } = useAuth();
  const [tracks, setTracks] = useState<LibraryTrack[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sort, setSort] = useState<SortOption>("date");

  useEffect(() => {
    const loadTracks = async () => {
      try {
        const token = await getToken();
        const res = await fetch(`${API_URL}/tracks`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error("Failed to load tracks");
        const data = (await res.json()) as LibraryTrack[];
        setTracks(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load tracks.");
      } finally {
        setLoading(false);
      }
    };
    loadTracks();
  }, [getToken]);

  const sorted = sortTracks(tracks, sort);
  const sections = sort === "date" ? groupByDate(sorted) : [{ title: "", items: sorted }];
  const trackCount = tracks.length;

  if (loading) return <p className="text-zinc-500 text-sm py-8 text-center">Loading…</p>;
  if (error) return <p className="text-red-400 text-sm">{error}</p>;

  return (
    <div>
      {/* Header row */}
      <div className="flex items-end justify-between mb-4">
        <div>
          {trackCount > 0 && (
            <p className="text-zinc-600 text-sm mt-1">
              {trackCount === 1 ? "1 track" : `${trackCount} tracks`}
            </p>
          )}
        </div>
        {trackCount > 0 && (
          <div className="relative">
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortOption)}
              className="appearance-none bg-zinc-900 text-zinc-400 text-sm font-medium px-3 py-1.5 pr-7 rounded-full border-0 cursor-pointer focus:outline-none focus:ring-1 focus:ring-zinc-600"
            >
              {(Object.keys(SORT_LABELS) as SortOption[]).map((s) => (
                <option key={s} value={s}>{SORT_LABELS[s]}</option>
              ))}
            </select>
            <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 text-xs">▾</span>
          </div>
        )}
      </div>

      {trackCount === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-2">
          <p className="text-white text-lg font-medium">No tracks yet</p>
          <p className="text-zinc-600 text-sm">Go to Downloads to add music</p>
        </div>
      ) : (
        <div className="space-y-6">
          {sections.map(({ title, items }) => (
            <div key={title || "all"}>
              {title && (
                <p className="text-zinc-600 text-xs font-semibold uppercase tracking-widest px-2 mb-1">
                  {title}
                </p>
              )}
              <ul className="divide-y divide-zinc-900">
                {items.map((track) => (
                  <TrackRow key={track.id} track={track} getToken={getToken} />
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
