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

    if (!groups[label]) { groups[label] = []; order.push(label); }
    groups[label]!.push(track);
  }

  return order.map((title) => ({ title, items: groups[title]! }));
}

function TrackRow({ track, getToken }: { track: LibraryTrack; getToken: () => Promise<string | null> }) {
  const [streamUrl, setStreamUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  const handlePlay = async () => {
    if (streamUrl) { audioRef.current?.play(); return; }
    setLoading(true);
    try {
      const token = await getToken();
      const res = await fetch(`${API_URL}/tracks/${track.id}/stream`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error();
      const { url } = (await res.json()) as { url: string };
      setStreamUrl(url);
    } catch { /* ignore */ } finally { setLoading(false); }
  };

  const subtitle = [
    track.artist ?? null,
    track.originalBpm != null ? `${track.originalBpm} BPM` : null,
  ].filter(Boolean).join("  ·  ");

  return (
    <li>
      <button
        onClick={handlePlay}
        disabled={loading}
        className="w-full flex items-center gap-3 py-2.5 hover:bg-white/5 active:bg-white/10 transition-colors text-left group rounded-xl"
      >
        {/* Artwork */}
        <div className="w-11 h-11 rounded-lg bg-zinc-900 flex items-center justify-center shrink-0">
          <span className="text-lg text-zinc-600">♫</span>
        </div>

        {/* Title + subtitle */}
        <div className="flex-1 min-w-0">
          <p className="text-white text-sm font-medium leading-snug truncate">{track.title}</p>
          {subtitle && (
            <p className="text-zinc-500 text-xs leading-snug truncate mt-0.5">{subtitle}</p>
          )}
        </div>

        {/* Duration */}
        <span className="text-zinc-600 text-xs tabular-nums shrink-0">
          {loading ? "…" : formatDuration(track.duration)}
        </span>
      </button>

      {streamUrl && (
        <div className="pb-1">
          <audio ref={audioRef} src={streamUrl} controls autoPlay className="w-full h-8 accent-white" />
        </div>
      )}
    </li>
  );
}

export default function TrackList({ sort = "date" }: { sort?: SortOption }) {
  const { getToken } = useAuth();
  const [tracks, setTracks] = useState<LibraryTrack[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const token = await getToken();
        const res = await fetch(`${API_URL}/tracks`, { headers: { Authorization: `Bearer ${token}` } });
        if (!res.ok) throw new Error("Failed to load tracks");
        setTracks(await res.json() as LibraryTrack[]);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load tracks.");
      } finally { setLoading(false); }
    })();
  }, [getToken]);

  const sorted = sortTracks(tracks, sort);
  const sections = sort === "date" ? groupByDate(sorted) : [{ title: "", items: sorted }];
  const trackCount = tracks.length;

  if (loading) return <p className="text-zinc-500 text-sm py-12 text-center">Loading…</p>;
  if (error) return <p className="text-red-400 text-sm px-4">{error}</p>;
  if (trackCount === 0) return (
    <div className="flex flex-col items-center justify-center py-20 gap-2 text-center">
      <p className="text-white text-lg font-medium">No tracks yet</p>
      <p className="text-zinc-600 text-sm">Go to Downloads to add music</p>
    </div>
  );

  return (
    <div className="space-y-5">
      {sections.map(({ title, items }) => (
        <div key={title || "all"}>
          {title && (
            <p className="text-zinc-600 text-xs font-semibold uppercase tracking-widest mb-1">
              {title}
            </p>
          )}
          <ul className="divide-y divide-zinc-900/60">
            {items.map((track) => (
              <TrackRow key={track.id} track={track} getToken={getToken} />
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
