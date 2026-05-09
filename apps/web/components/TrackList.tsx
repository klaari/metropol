"use client";

import { useEffect, useRef, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import type { LibraryTrack } from "@aani/types";

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
    case "title": return sorted.sort((a, b) => a.title.localeCompare(b.title));
    case "bpm": return sorted.sort((a, b) => (a.originalBpm ?? Infinity) - (b.originalBpm ?? Infinity));
    default: return sorted.sort((a, b) => new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime());
  }
}

// ─── Track action menu ───────────────────────────────────────────────────────

interface TrackMenuProps {
  track: LibraryTrack;
  onClose: () => void;
  onDeleted: (id: string) => void;
  onRenamed: (id: string, title: string) => void;
  getToken: () => Promise<string | null>;
}

interface Playlist { id: string; name: string; trackCount: number }

function TrackMenu({ track, onClose, onDeleted, onRenamed, getToken }: TrackMenuProps) {
  const [view, setView] = useState<"menu" | "playlist" | "rename" | "delete">("menu");
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [loadingPlaylists, setLoadingPlaylists] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState("");
  const [creatingPlaylist, setCreatingPlaylist] = useState(false);
  const [renameValue, setRenameValue] = useState(track.title);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const openPlaylistPicker = async () => {
    setView("playlist");
    setLoadingPlaylists(true);
    try {
      const token = await getToken();
      const res = await fetch(`${API_URL}/playlists`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) setPlaylists(await res.json());
    } finally { setLoadingPlaylists(false); }
  };

  const addToPlaylist = async (playlistId: string, playlistName: string) => {
    const token = await getToken();
    const res = await fetch(`${API_URL}/playlists/${playlistId}/tracks`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ trackIds: [track.id] }),
    });
    const data = await res.json() as { added: number };
    if (data.added > 0) {
      setFeedback(`Added to "${playlistName}"`);
    } else {
      setFeedback(`Already in "${playlistName}"`);
    }
    setTimeout(onClose, 1200);
  };

  const createAndAdd = async () => {
    const name = newPlaylistName.trim();
    if (!name) return;
    setCreatingPlaylist(true);
    try {
      const token = await getToken();
      const res = await fetch(`${API_URL}/playlists`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name }),
      });
      const playlist = await res.json() as Playlist;
      await addToPlaylist(playlist.id, playlist.name);
    } finally { setCreatingPlaylist(false); }
  };

  const handleRename = async () => {
    const title = renameValue.trim();
    if (!title || title === track.title) { onClose(); return; }
    setSaving(true);
    try {
      const token = await getToken();
      await fetch(`${API_URL}/tracks/${track.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ title }),
      });
      onRenamed(track.id, title);
      onClose();
    } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    const token = await getToken();
    await fetch(`${API_URL}/tracks/${track.id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    onDeleted(track.id);
    onClose();
  };

  return (
    // Backdrop
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60"
      onClick={onClose}
    >
      <div
        className="bg-zinc-950 w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Feedback toast */}
        {feedback && (
          <div className="px-4 py-3 text-center text-green-400 text-sm font-medium">{feedback}</div>
        )}

        {/* ── Main menu ── */}
        {view === "menu" && (
          <>
            <div className="px-4 pt-4 pb-2 border-b border-zinc-900">
              <p className="text-white font-semibold text-base truncate">{track.title}</p>
              {track.artist && <p className="text-zinc-500 text-sm truncate mt-0.5">{track.artist}</p>}
            </div>
            <ul className="py-1">
              {[
                { label: "Add to Playlist", icon: "＋", action: openPlaylistPicker },
                { label: "Rename", icon: "✎", action: () => setView("rename") },
                { label: "Delete", icon: "✕", action: () => setView("delete"), danger: true },
              ].map(({ label, icon, action, danger }) => (
                <li key={label}>
                  <button
                    onClick={action}
                    className={`w-full flex items-center gap-3 px-4 py-3.5 text-sm hover:bg-zinc-900 transition-colors text-left ${danger ? "text-red-400" : "text-white"}`}
                  >
                    <span className="w-5 text-center text-base">{icon}</span>
                    {label}
                  </button>
                </li>
              ))}
            </ul>
            <div className="p-2">
              <button onClick={onClose} className="w-full py-3 text-zinc-500 text-sm font-medium hover:bg-zinc-900 rounded-xl transition-colors">
                Cancel
              </button>
            </div>
          </>
        )}

        {/* ── Playlist picker ── */}
        {view === "playlist" && (
          <>
            <div className="flex items-center justify-between px-4 py-4 border-b border-zinc-900">
              <button onClick={() => setView("menu")} className="text-zinc-500 text-sm">‹ Back</button>
              <span className="text-white font-semibold text-base">Add to Playlist</span>
              <div className="w-12" />
            </div>

            {/* Create new */}
            <div className="px-4 py-3 border-b border-zinc-900">
              <div className="flex gap-2">
                <input
                  autoFocus
                  type="text"
                  value={newPlaylistName}
                  onChange={(e) => setNewPlaylistName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && createAndAdd()}
                  placeholder="New playlist name…"
                  className="flex-1 bg-zinc-900 rounded-xl px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none"
                />
                <button
                  onClick={createAndAdd}
                  disabled={!newPlaylistName.trim() || creatingPlaylist}
                  className="bg-white text-black text-sm font-semibold px-4 py-2 rounded-xl disabled:opacity-30 hover:bg-zinc-100 transition-colors"
                >
                  {creatingPlaylist ? "…" : "Create"}
                </button>
              </div>
            </div>

            <div className="max-h-64 overflow-y-auto">
              {loadingPlaylists ? (
                <p className="text-zinc-500 text-sm text-center py-8">Loading…</p>
              ) : playlists.length === 0 ? (
                <p className="text-zinc-600 text-sm text-center py-8">No playlists yet</p>
              ) : (
                <ul>
                  {playlists.map((p) => (
                    <li key={p.id}>
                      <button
                        onClick={() => addToPlaylist(p.id, p.name)}
                        className="w-full flex items-center justify-between px-4 py-3.5 text-sm hover:bg-zinc-900 transition-colors text-left"
                      >
                        <span className="text-white">{p.name}</span>
                        <span className="text-zinc-600">{p.trackCount} {p.trackCount === 1 ? "track" : "tracks"}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}

        {/* ── Rename ── */}
        {view === "rename" && (
          <div className="p-4 space-y-3">
            <p className="text-white font-semibold text-base">Rename Track</p>
            <input
              autoFocus
              type="text"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleRename()}
              className="w-full bg-zinc-900 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:ring-1 focus:ring-zinc-600"
            />
            <div className="flex gap-2">
              <button onClick={onClose} className="flex-1 py-3 text-zinc-500 text-sm font-medium border border-zinc-800 rounded-xl hover:bg-zinc-900 transition-colors">
                Cancel
              </button>
              <button
                onClick={handleRename}
                disabled={saving || !renameValue.trim()}
                className="flex-1 py-3 text-black text-sm font-semibold bg-white rounded-xl disabled:opacity-40 hover:bg-zinc-100 transition-colors"
              >
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        )}

        {/* ── Delete confirm ── */}
        {view === "delete" && (
          <div className="p-4 space-y-3">
            <p className="text-white font-semibold text-base">Delete Track</p>
            <p className="text-zinc-500 text-sm">Remove "{track.title}" from your library? This cannot be undone.</p>
            <div className="flex gap-2">
              <button onClick={() => setView("menu")} className="flex-1 py-3 text-zinc-500 text-sm font-medium border border-zinc-800 rounded-xl hover:bg-zinc-900 transition-colors">
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="flex-1 py-3 text-white text-sm font-semibold bg-red-600 rounded-xl hover:bg-red-700 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Track row ───────────────────────────────────────────────────────────────

function TrackRow({
  track,
  getToken,
  onLongPress,
}: {
  track: LibraryTrack;
  getToken: () => Promise<string | null>;
  onLongPress: () => void;
}) {
  const [streamUrl, setStreamUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  // Long-press support for touch devices
  const handleTouchStart = () => {
    pressTimer.current = setTimeout(() => { onLongPress(); }, 500);
  };
  const handleTouchEnd = () => {
    if (pressTimer.current) clearTimeout(pressTimer.current);
  };

  const subtitle = [
    track.artist ?? null,
    track.originalBpm != null ? `${track.originalBpm} BPM` : null,
  ].filter(Boolean).join("  ·  ");

  return (
    <li>
      <div className="flex items-center group">
        <button
          onClick={handlePlay}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          onTouchMove={handleTouchEnd}
          disabled={loading}
          className="flex-1 flex items-center gap-3 py-2.5 hover:bg-white/5 active:bg-white/10 transition-colors text-left rounded-xl min-w-0"
        >
          <div className="w-11 h-11 rounded-lg bg-zinc-900 flex items-center justify-center shrink-0">
            <span className="text-lg text-zinc-600">♫</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white text-sm font-medium leading-snug truncate">{track.title}</p>
            {subtitle && <p className="text-zinc-500 text-xs leading-snug truncate mt-0.5">{subtitle}</p>}
          </div>
          <span className="text-zinc-600 text-xs tabular-nums shrink-0 pr-1">
            {loading ? "…" : formatDuration(track.duration)}
          </span>
        </button>

        {/* ⋯ button — visible on hover (desktop) */}
        <button
          onClick={onLongPress}
          className="p-2 text-zinc-700 hover:text-zinc-300 transition-colors opacity-0 group-hover:opacity-100 shrink-0"
          title="Track options"
        >
          ⋯
        </button>
      </div>

      {streamUrl && (
        <div className="pb-1">
          <audio ref={audioRef} src={streamUrl} controls autoPlay className="w-full h-8 accent-white" />
        </div>
      )}
    </li>
  );
}

// ─── TrackList ───────────────────────────────────────────────────────────────

export default function TrackList({ sort = "date" }: { sort?: SortOption }) {
  const { getToken } = useAuth();
  const [tracks, setTracks] = useState<LibraryTrack[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTrack, setActiveTrack] = useState<LibraryTrack | null>(null);

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

  if (loading) return <p className="text-zinc-500 text-sm py-12 text-center">Loading…</p>;
  if (error) return <p className="text-red-400 text-sm px-4">{error}</p>;
  if (tracks.length === 0) return (
    <div className="flex flex-col items-center justify-center py-20 gap-2 text-center">
      <p className="text-white text-lg font-medium">No tracks yet</p>
      <p className="text-zinc-600 text-sm">Go to Downloads to add music</p>
    </div>
  );

  return (
    <>
      <ul className="divide-y divide-zinc-900/60">
        {sorted.map((track) => (
          <TrackRow
            key={track.id}
            track={track}
            getToken={getToken}
            onLongPress={() => setActiveTrack(track)}
          />
        ))}
      </ul>

      {activeTrack && (
        <TrackMenu
          track={activeTrack}
          getToken={getToken}
          onClose={() => setActiveTrack(null)}
          onDeleted={(id) => {
            setTracks((prev) => prev.filter((t) => t.id !== id));
            setActiveTrack(null);
          }}
          onRenamed={(id, title) => {
            setTracks((prev) => prev.map((t) => t.id === id ? { ...t, title } : t));
            setActiveTrack(null);
          }}
        />
      )}
    </>
  );
}
