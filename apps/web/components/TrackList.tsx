"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import type { LibraryTrack } from "@metropol/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";

function formatDuration(seconds: number | null): string {
  if (seconds === null) return "";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function TrackList() {
  const { getToken } = useAuth();
  const [tracks, setTracks] = useState<LibraryTrack[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadTracks = async () => {
      try {
        const token = await getToken();
        const res = await fetch(`${API_URL}/tracks`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error("Failed to load tracks");
        const data = (await res.json()) as LibraryTrack[];
        data.sort(
          (a, b) =>
            new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime()
        );
        setTracks(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load tracks.");
      } finally {
        setLoading(false);
      }
    };

    loadTracks();
  }, [getToken]);

  if (loading) {
    return <p className="text-zinc-500 text-sm">Loading…</p>;
  }

  if (error) {
    return <p className="text-red-400 text-sm">{error}</p>;
  }

  if (tracks.length === 0) {
    return (
      <p className="text-zinc-500 text-sm">
        No tracks yet. Download some music first.
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {tracks.map((track) => (
        <li
          key={track.id}
          className="flex items-center justify-between bg-zinc-900 rounded-lg px-4 py-3 gap-4"
        >
          <div className="min-w-0">
            <p className="text-sm font-medium text-white truncate">{track.title}</p>
            {track.artist && (
              <p className="text-xs text-zinc-400 mt-0.5">{track.artist}</p>
            )}
          </div>
          {track.duration !== null && (
            <span className="text-xs text-zinc-500 shrink-0">
              {formatDuration(track.duration)}
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}
