"use client";

import { useEffect, useRef, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import type { LibraryTrack } from "@metropol/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";

function formatDuration(seconds: number | null): string {
  if (seconds === null) return "";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
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
    <li className="flex flex-col gap-2 bg-zinc-900 rounded-lg px-4 py-3">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-medium text-white truncate">{track.title}</p>
          {track.artist && (
            <p className="text-xs text-zinc-400 mt-0.5">{track.artist}</p>
          )}
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {track.duration !== null && (
            <span className="text-xs text-zinc-500">
              {formatDuration(track.duration)}
            </span>
          )}
          <button
            onClick={handlePlay}
            disabled={loading}
            className="text-xs bg-zinc-700 hover:bg-zinc-600 text-white px-3 py-1 rounded-full disabled:opacity-50 transition-colors"
          >
            {loading ? "…" : streamUrl ? "▶ Play" : "▶"}
          </button>
        </div>
      </div>
      {streamUrl && (
        <audio
          ref={audioRef}
          src={streamUrl}
          controls
          autoPlay
          className="w-full h-8 accent-white"
        />
      )}
    </li>
  );
}

export default function TrackList({ refreshKey }: { refreshKey?: number }) {
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
        setTracks(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load tracks.");
      } finally {
        setLoading(false);
      }
    };

    loadTracks();
  }, [getToken, refreshKey]);

  if (loading) return <p className="text-zinc-500 text-sm">Loading…</p>;
  if (error) return <p className="text-red-400 text-sm">{error}</p>;
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
        <TrackRow key={track.id} track={track} getToken={getToken} />
      ))}
    </ul>
  );
}
