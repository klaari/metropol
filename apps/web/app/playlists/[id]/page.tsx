"use client";

import { useAuth } from "@clerk/nextjs";
import Link from "next/link";
import { use, useEffect, useState } from "react";
import {
  Button,
  HStack,
  Input,
  Surface,
  Text,
  VStack,
} from "@/components/ui";

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

export default function PlaylistDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
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
      const res = await fetch(`${API_URL}/playlists/${id}/tracks`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setTracks((await res.json()) as PlaylistTrack[]);
      const listRes = await fetch(`${API_URL}/playlists`, {
        headers: { Authorization: `Bearer ${token}` },
      });
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
    await fetch(`${API_URL}/playlists/${id}/tracks/${ptId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
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
    const res = await fetch(`${API_URL}/tracks`, {
      headers: { Authorization: `Bearer ${token}` },
    });
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
  const trackCount = tracks.length;
  const trackCountLabel =
    trackCount === 1 ? "1 track" : `${trackCount} tracks`;

  return (
    <VStack gap="lg" pad="lg">
      <HStack gap="md" align="center">
        <Link
          href="/playlists"
          aria-label="Back to playlists"
          className="text-ink-muted hover:text-ink text-title leading-none"
        >
          ‹
        </Link>
        <div className="flex-1 min-w-0">
          <Text variant="eyebrow" tone="muted">
            Playlist
          </Text>
          {editingName ? (
            <Input
              autoFocus
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              onBlur={saveRename}
              onKeyDown={(e) => e.key === "Enter" && saveRename()}
              className="!h-auto !px-0 !rounded-none !border-0 !border-b !border-ink-soft !bg-transparent !text-display !font-bold"
            />
          ) : (
            <button
              onClick={() => {
                setNameInput(name);
                setEditingName(true);
              }}
              className="text-left w-full hover:opacity-80 transition-opacity"
            >
              <Text variant="display" numberOfLines={2}>
                {name || "Playlist"}
              </Text>
            </button>
          )}
          {trackCount > 0 ? (
            <Text variant="caption" tone="muted">
              {trackCountLabel}
            </Text>
          ) : null}
        </div>
        <Button label="+ Add" size="sm" variant="secondary" onClick={openPicker} />
      </HStack>

      {loading ? (
        <Text variant="caption" tone="muted" align="center" className="py-2xl">
          Loading…
        </Text>
      ) : tracks.length === 0 ? (
        <VStack gap="xs" align="center" padY="3xl">
          <Text variant="title" align="center">
            Nothing here yet
          </Text>
          <Text variant="body" tone="muted" align="center">
            Tap + Add to add tracks from your library
          </Text>
        </VStack>
      ) : (
        <ul className="divide-y divide-paper-edge -mx-lg">
          {tracks.map((track, i) => (
            <li
              key={track.playlistTrackId}
              className="flex items-center gap-md px-lg py-sm group"
            >
              <div className="flex flex-col gap-[2px] shrink-0">
                <button
                  onClick={() => handleMove(i, -1)}
                  disabled={i === 0}
                  aria-label="Move up"
                  className="text-ink-faint hover:text-ink disabled:opacity-20 transition-colors text-caption leading-none"
                >
                  ▲
                </button>
                <button
                  onClick={() => handleMove(i, 1)}
                  disabled={i === tracks.length - 1}
                  aria-label="Move down"
                  className="text-ink-faint hover:text-ink disabled:opacity-20 transition-colors text-caption leading-none"
                >
                  ▼
                </button>
              </div>
              <div className="flex-1 min-w-0">
                <Text variant="bodyStrong" numberOfLines={1}>
                  {track.title}
                </Text>
                {track.artist ? (
                  <Text variant="caption" tone="muted" numberOfLines={1}>
                    {track.artist}
                  </Text>
                ) : null}
              </div>
              <Text variant="caption" tone="muted" numeric>
                {formatDuration(track.duration)}
              </Text>
              <button
                onClick={() => handleRemove(track.playlistTrackId, track.title)}
                aria-label={`Remove ${track.title}`}
                className="text-ink-faint hover:text-critical opacity-0 group-hover:opacity-100 transition-colors p-xs"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}

      {showPicker ? (
        <div className="fixed inset-0 z-50 bg-ink/40 flex items-end sm:items-center justify-center">
          <div className="w-full sm:max-w-md max-h-[80vh] flex flex-col">
            <Surface
              tone="raised"
              rounded="xl"
              pad="none"
              lift="popover"
              bordered
              className="overflow-hidden rounded-b-none sm:rounded-b-xl flex flex-col"
            >
              <HStack
                justify="between"
                align="center"
                pad="base"
                className="border-b border-paper-edge"
              >
                <button
                  onClick={() => setShowPicker(false)}
                  className="text-ink-muted text-caption hover:text-ink"
                >
                  Cancel
                </button>
                <Text variant="bodyStrong">Add tracks</Text>
                <button
                  onClick={handleAdd}
                  disabled={selected.size === 0 || adding}
                  className="text-caption font-semibold text-ink disabled:opacity-30"
                >
                  {adding
                    ? "Adding…"
                    : `Add${selected.size > 0 ? ` (${selected.size})` : ""}`}
                </button>
              </HStack>

              <div className="overflow-y-auto flex-1 max-h-[60vh]">
                {available.length === 0 ? (
                  <Text
                    variant="caption"
                    tone="muted"
                    align="center"
                    className="py-2xl"
                  >
                    All tracks already added
                  </Text>
                ) : (
                  <ul>
                    {available.map((t) => {
                      const isSelected = selected.has(t.id);
                      return (
                        <li key={t.id}>
                          <button
                            onClick={() =>
                              setSelected((prev) => {
                                const next = new Set(prev);
                                if (isSelected) next.delete(t.id);
                                else next.add(t.id);
                                return next;
                              })
                            }
                            className={`w-full flex items-center gap-md px-base py-md transition-colors text-left ${
                              isSelected ? "bg-paper-sunken" : "hover:bg-paper-sunken/60"
                            }`}
                          >
                            <div
                              className={`w-6 h-6 rounded-full border-thick flex items-center justify-center shrink-0 transition-colors ${
                                isSelected
                                  ? "border-cobalt bg-cobalt"
                                  : "border-paper-edge"
                              }`}
                            >
                              {isSelected ? (
                                <span className="text-ink-inverse text-caption font-bold">
                                  ✓
                                </span>
                              ) : null}
                            </div>
                            <div className="flex-1 min-w-0">
                              <Text variant="bodyStrong" numberOfLines={1}>
                                {t.title}
                              </Text>
                              {t.artist ? (
                                <Text variant="caption" tone="muted" numberOfLines={1}>
                                  {t.artist}
                                </Text>
                              ) : null}
                            </div>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </Surface>
          </div>
        </div>
      ) : null}
    </VStack>
  );
}
