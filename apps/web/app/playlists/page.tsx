"use client";

import { useAuth } from "@clerk/nextjs";
import { useEffect, useState } from "react";
import {
  Button,
  HStack,
  IconButton,
  Input,
  ListRow,
  Text,
  VStack,
  palette,
} from "@/components/ui";

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
      const res = await fetch(`${API_URL}/playlists`, {
        headers: { Authorization: `Bearer ${token}` },
      });
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
    await fetch(`${API_URL}/playlists/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    setPlaylists((prev) => prev.filter((p) => p.id !== id));
  }

  const playlistCount = playlists.length;
  const playlistCountLabel =
    playlistCount === 1 ? "1 playlist" : `${playlistCount} playlists`;

  return (
    <VStack gap="lg" pad="lg" className="max-w-3xl w-full mx-auto">
      <VStack gap="xs">
        <Text variant="eyebrow" tone="muted">
          Collections
        </Text>
        <HStack justify="between" align="center">
          <Text variant="titleLg">
            {playlistCount > 0 ? playlistCountLabel : "Playlists"}
          </Text>
          <IconButton
            aria-label={showCreate ? "Cancel" : "Create playlist"}
            onClick={() => {
              setShowCreate((cur) => !cur);
              setNewName("");
            }}
          >
            <span className="text-body-lg leading-none">
              {showCreate ? "✕" : "＋"}
            </span>
          </IconButton>
        </HStack>
      </VStack>

      {showCreate && (
        <form onSubmit={handleCreate}>
          <HStack gap="sm">
            <div className="flex-1">
              <Input
                autoFocus
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Playlist name"
              />
            </div>
            <Button
              label={creating ? "…" : "Create"}
              type="submit"
              disabled={creating || !newName.trim()}
            />
          </HStack>
        </form>
      )}

      {loading ? (
        <Text variant="caption" tone="muted" align="center" className="py-2xl">
          Loading…
        </Text>
      ) : playlists.length === 0 ? (
        <VStack gap="xs" align="center" padY="3xl">
          <Text variant="title" align="center">
            No playlists yet
          </Text>
          <Text variant="body" tone="muted" align="center">
            Tap + to create your first one
          </Text>
        </VStack>
      ) : (
        <ul className="divide-y divide-paper-edge -mx-lg">
          {playlists.map((p) => (
            <li key={p.id} className="flex items-center group">
              <div className="flex-1 min-w-0">
                <ListRow
                  href={`/playlists/${p.id}`}
                  title={p.name}
                  subtitle={`${p.trackCount} ${
                    p.trackCount === 1 ? "track" : "tracks"
                  }`}
                  leading={
                    <div className="w-10 h-10 rounded-md bg-paper-sunken flex items-center justify-center">
                      <span className="text-ink-muted">♫</span>
                    </div>
                  }
                  trailing={
                    <span
                      className="text-ink-faint"
                      style={{ color: palette.inkFaint }}
                    >
                      ›
                    </span>
                  }
                />
              </div>
              <button
                onClick={() => handleDelete(p.id, p.name)}
                aria-label={`Delete ${p.name}`}
                className="px-md text-ink-faint hover:text-critical opacity-0 group-hover:opacity-100 transition-colors"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
    </VStack>
  );
}
