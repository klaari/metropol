"use client";

import { useAuth } from "@clerk/nextjs";
import Link from "next/link";
import { useEffect, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";

interface Playlist {
  id: string;
  name: string;
  trackCount: number;
}

export default function PlaylistsPage() {
  const { getToken } = useAuth();
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetchPlaylists();
  }, []);

  async function fetchPlaylists() {
    try {
      const token = await getToken();
      const res = await fetch(`${API_URL}/playlists`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) setPlaylists(await res.json());
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    setCreating(true);
    try {
      const token = await getToken();
      const res = await fetch(`${API_URL}/playlists`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name }),
      });
      if (res.ok) {
        const p = await res.json();
        setPlaylists((prev) => [...prev, p]);
        setNewName("");
        setShowCreate(false);
      }
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete "${name}"?`)) return;
    const token = await getToken();
    await fetch(`${API_URL}/playlists/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
    setPlaylists((prev) => prev.filter((p) => p.id !== id));
  }

  return (
    <div className="px-4 py-6">
      <div className="flex items-end justify-between mb-5">
        <h1 className="text-3xl font-bold text-white">Playlists</h1>
        <button
          onClick={() => setShowCreate(true)}
          className="w-9 h-9 rounded-full bg-white text-black text-xl font-light flex items-center justify-center hover:bg-zinc-100 transition-colors"
        >
          +
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <form onSubmit={handleCreate} className="flex items-center gap-2 mb-4">
          <input
            autoFocus
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Playlist name"
            className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-white placeholder-zinc-600 text-sm focus:outline-none focus:border-zinc-600"
          />
          <button
            type="submit"
            disabled={creating || !newName.trim()}
            className="bg-white text-black text-sm font-semibold px-4 py-2.5 rounded-xl disabled:opacity-40 hover:bg-zinc-100 transition-colors"
          >
            {creating ? "…" : "Create"}
          </button>
          <button
            type="button"
            onClick={() => { setShowCreate(false); setNewName(""); }}
            className="text-zinc-500 text-sm px-2 py-2.5 hover:text-zinc-300 transition-colors"
          >
            Cancel
          </button>
        </form>
      )}

      {loading ? (
        <p className="text-zinc-500 text-sm py-12 text-center">Loading…</p>
      ) : playlists.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-2">
          <p className="text-white text-lg font-medium">No playlists yet</p>
          <p className="text-zinc-600 text-sm">Tap + to create one</p>
        </div>
      ) : (
        <ul className="divide-y divide-zinc-900">
          {playlists.map((p) => (
            <li key={p.id} className="flex items-center group">
              <Link
                href={`/playlists/${p.id}`}
                className="flex-1 flex items-center justify-between py-4 hover:opacity-80 transition-opacity"
              >
                <span className="text-white text-base font-medium">{p.name}</span>
                <span className="text-zinc-500 text-sm mr-3">
                  {p.trackCount} {p.trackCount === 1 ? "track" : "tracks"}
                </span>
              </Link>
              <button
                onClick={() => handleDelete(p.id, p.name)}
                className="text-zinc-700 hover:text-red-500 transition-colors p-1 opacity-0 group-hover:opacity-100"
                title="Delete"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
