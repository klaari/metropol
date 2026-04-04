"use client";

import { useAuth } from "@clerk/nextjs";
import Link from "next/link";
import { use, useEffect, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";

interface PlaylistTrack {
  playlistTrackId: string;
  position: number;
  id: string;
  title: string;
  artist: string | null;
  duration: number | null;
}

interface LibraryTrack {
  id: string;
  title: string;
  artist: string | null;
  addedAt: string;
}

function formatDuration(s: number | null) {
  if (!s) return "--:--";
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export default function PlaylistDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { getToken } = useAuth();
  const [name, setName] = useState("");
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [tracks, setTracks] = useState<PlaylistTrack[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPicker, setShowPicker] = useState(false);
  const [libraryTracks, setLibraryTracks] = useState<LibraryTrack[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    loadTracks();
  }, [id]);

  async function loadTracks() {
    setLoading(true);
    try {
      const token = await getToken();
      const res = await fetch(`${API_URL}/playlists/${id}/tracks`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const data: PlaylistTrack[] = await res.json();
        setTracks(data);
      }
      // Fetch playlist name from list
      const listRes = await fetch(`${API_URL}/playlists`, { headers: { Authorization: `Bearer ${token}` } });
      if (listRes.ok) {
        const all: { id: string; name: string }[] = await listRes.json();
        const p = all.find((x) => x.id === id);
        if (p) setName(p.name);
      }
    } finally {
      setLoading(false);
    }
  }

  async function saveRename() {
    setEditingName(false);
    const trimmed = nameInput.trim();
    if (!trimmed || trimmed === name) return;
    const token = await getToken();
    await fetch(`${API_URL}/playlists/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name: trimmed }),
    });
    setName(trimmed);
  }

  async function handleRemove(ptId: string, title: string) {
    if (!confirm(`Remove "${title}" from playlist?`)) return;
    const token = await getToken();
    await fetch(`${API_URL}/playlists/${id}/tracks/${ptId}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
    setTracks((prev) => prev.filter((t) => t.playlistTrackId !== ptId));
  }

  async function handleMove(index: number, dir: -1 | 1) {
    const token = await getToken();
    await fetch(`${API_URL}/playlists/${id}/tracks/reorder`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ fromPos: index, toPos: index + dir }),
    });
    await loadTracks();
  }

  async function openPicker() {
    const token = await getToken();
    const res = await fetch(`${API_URL}/tracks`, { headers: { Authorization: `Bearer ${token}` } });
    if (res.ok) setLibraryTracks(await res.json());
    setSelected(new Set());
    setShowPicker(true);
  }

  async function handleAdd() {
    if (selected.size === 0) return;
    setAdding(true);
    const token = await getToken();
    await fetch(`${API_URL}/playlists/${id}/tracks`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ trackIds: Array.from(selected) }),
    });
    setShowPicker(false);
    setAdding(false);
    await loadTracks();
  }

  const existingIds = new Set(tracks.map((t) => t.id));
  const available = libraryTracks.filter((t) => !existingIds.has(t.id));

  return (
    <div className="px-4 py-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <Link href="/playlists" className="text-zinc-500 hover:text-white transition-colors text-2xl leading-none">
          ‹
        </Link>
        {editingName ? (
          <input
            autoFocus
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            onBlur={saveRename}
            onKeyDown={(e) => e.key === "Enter" && saveRename()}
            className="flex-1 bg-transparent text-white text-2xl font-bold focus:outline-none border-b border-zinc-600"
          />
        ) : (
          <button
            onClick={() => { setNameInput(name); setEditingName(true); }}
            className="flex-1 text-left text-3xl font-bold text-white hover:opacity-70 transition-opacity"
          >
            {name || "Playlist"}
          </button>
        )}
        <button
          onClick={openPicker}
          className="text-zinc-400 hover:text-white text-sm font-medium transition-colors"
        >
          + Add
        </button>
      </div>

      {loading ? (
        <p className="text-zinc-500 text-sm py-12 text-center">Loading…</p>
      ) : tracks.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-2">
          <p className="text-white text-lg font-medium">No tracks yet</p>
          <p className="text-zinc-600 text-sm">Tap + Add to add tracks from your library</p>
        </div>
      ) : (
        <ul className="divide-y divide-zinc-900">
          {tracks.map((track, i) => (
            <li key={track.playlistTrackId} className="flex items-center gap-3 py-3 group">
              {/* Reorder */}
              <div className="flex flex-col gap-0.5 shrink-0">
                <button
                  onClick={() => handleMove(i, -1)}
                  disabled={i === 0}
                  className="text-zinc-700 hover:text-zinc-400 disabled:opacity-20 transition-colors text-xs leading-none"
                >▲</button>
                <button
                  onClick={() => handleMove(i, 1)}
                  disabled={i === tracks.length - 1}
                  className="text-zinc-700 hover:text-zinc-400 disabled:opacity-20 transition-colors text-xs leading-none"
                >▼</button>
              </div>

              {/* Track info */}
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-medium truncate">{track.title}</p>
                {track.artist && <p className="text-zinc-500 text-xs truncate mt-0.5">{track.artist}</p>}
              </div>

              <span className="text-zinc-600 text-xs tabular-nums shrink-0">{formatDuration(track.duration)}</span>

              <button
                onClick={() => handleRemove(track.playlistTrackId, track.title)}
                className="text-zinc-700 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100 shrink-0 p-1"
              >✕</button>
            </li>
          ))}
        </ul>
      )}

      {/* Track picker overlay */}
      {showPicker && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-end sm:items-center justify-center">
          <div className="bg-zinc-950 w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between px-4 py-4 border-b border-zinc-800">
              <button onClick={() => setShowPicker(false)} className="text-zinc-500 text-sm">Cancel</button>
              <span className="text-white font-semibold text-base">Add Tracks</span>
              <button
                onClick={handleAdd}
                disabled={selected.size === 0 || adding}
                className="text-white text-sm font-semibold disabled:opacity-30"
              >
                {adding ? "Adding…" : `Add${selected.size > 0 ? ` (${selected.size})` : ""}`}
              </button>
            </div>

            <div className="overflow-y-auto flex-1">
              {available.length === 0 ? (
                <p className="text-zinc-500 text-sm text-center py-12">All tracks already added</p>
              ) : (
                <ul>
                  {available.map((t) => {
                    const isSelected = selected.has(t.id);
                    return (
                      <li key={t.id}>
                        <button
                          onClick={() => setSelected((prev) => {
                            const next = new Set(prev);
                            isSelected ? next.delete(t.id) : next.add(t.id);
                            return next;
                          })}
                          className={`w-full flex items-center gap-3 px-4 py-3 transition-colors text-left ${isSelected ? "bg-zinc-900" : "hover:bg-zinc-900/50"}`}
                        >
                          <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${isSelected ? "border-white bg-white" : "border-zinc-600"}`}>
                            {isSelected && <span className="text-black text-xs font-bold">✓</span>}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-white text-sm font-medium truncate">{t.title}</p>
                            {t.artist && <p className="text-zinc-500 text-xs truncate">{t.artist}</p>}
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
