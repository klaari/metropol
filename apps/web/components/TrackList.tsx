"use client";

import { useEffect, useRef, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import type { LibraryTrack } from "@aani/types";
import {
  Button,
  Field,
  Input,
  ListRow,
  Surface,
  Text,
  VStack,
  HStack,
  palette,
} from "./ui";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";

type SortOption = "date" | "title" | "bpm";

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
    default:
      return sorted.sort(
        (a, b) => new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime(),
      );
  }
}

// ─── Track action menu ───────────────────────────────────────────────────────

interface Playlist { id: string; name: string; trackCount: number }

interface TrackMenuProps {
  track: LibraryTrack;
  onClose: () => void;
  onDeleted: (id: string) => void;
  onRenamed: (id: string, title: string) => void;
  getToken: () => Promise<string | null>;
}

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
      const res = await fetch(`${API_URL}/playlists`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setPlaylists(await res.json());
    } finally {
      setLoadingPlaylists(false);
    }
  };

  const addToPlaylist = async (playlistId: string, playlistName: string) => {
    const token = await getToken();
    const res = await fetch(`${API_URL}/playlists/${playlistId}/tracks`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ trackIds: [track.id] }),
    });
    const data = (await res.json()) as { added: number };
    setFeedback(
      data.added > 0
        ? `Added to "${playlistName}"`
        : `Already in "${playlistName}"`,
    );
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
      const playlist = (await res.json()) as Playlist;
      await addToPlaylist(playlist.id, playlist.name);
    } finally {
      setCreatingPlaylist(false);
    }
  };

  const handleRename = async () => {
    const title = renameValue.trim();
    if (!title || title === track.title) {
      onClose();
      return;
    }
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
    } finally {
      setSaving(false);
    }
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
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-ink/40"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-sm"
        onClick={(e) => e.stopPropagation()}
      >
        <Surface
          tone="raised"
          rounded="xl"
          pad="none"
          lift="popover"
          bordered
          className="overflow-hidden rounded-b-none sm:rounded-b-xl"
        >
          {feedback && (
            <div className="px-base py-md text-center">
              <Text variant="bodyStrong" tone="positive">{feedback}</Text>
            </div>
          )}

          {view === "menu" && (
            <>
              <VStack gap="xs" pad="base" className="border-b border-paper-edge">
                <Text variant="bodyStrong" numberOfLines={1}>
                  {track.title}
                </Text>
                {track.artist ? (
                  <Text variant="caption" tone="muted" numberOfLines={1}>
                    {track.artist}
                  </Text>
                ) : null}
              </VStack>
              <ul>
                {[
                  { label: "Add to playlist", icon: "＋", action: openPlaylistPicker },
                  { label: "Rename", icon: "✎", action: () => setView("rename") },
                  { label: "Delete", icon: "✕", action: () => setView("delete"), danger: true },
                ].map(({ label, icon, action, danger }) => (
                  <li key={label}>
                    <button
                      onClick={action}
                      className={`w-full flex items-center gap-md px-base py-md hover:bg-paper-sunken transition-colors text-left ${
                        danger ? "text-critical" : "text-ink"
                      }`}
                    >
                      <span className="w-5 text-center text-body-lg">{icon}</span>
                      <Text variant="body" tone={danger ? "critical" : "primary"}>
                        {label}
                      </Text>
                    </button>
                  </li>
                ))}
              </ul>
              <div className="p-sm border-t border-paper-edge">
                <button
                  onClick={onClose}
                  className="w-full py-md rounded-lg text-ink-muted text-caption font-semibold hover:bg-paper-sunken transition-colors"
                >
                  Cancel
                </button>
              </div>
            </>
          )}

          {view === "playlist" && (
            <>
              <HStack
                justify="between"
                align="center"
                pad="base"
                className="border-b border-paper-edge"
              >
                <button
                  onClick={() => setView("menu")}
                  className="text-ink-muted text-caption hover:text-ink"
                >
                  ‹ Back
                </button>
                <Text variant="bodyStrong">Add to playlist</Text>
                <div className="w-10" />
              </HStack>

              <VStack gap="sm" pad="base" className="border-b border-paper-edge">
                <Field label="New playlist">
                  <HStack gap="sm">
                    <div className="flex-1">
                      <Input
                        autoFocus
                        value={newPlaylistName}
                        onChange={(e) => setNewPlaylistName(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && createAndAdd()}
                        placeholder="Playlist name…"
                      />
                    </div>
                    <Button
                      label={creatingPlaylist ? "…" : "Create"}
                      size="sm"
                      onClick={createAndAdd}
                      disabled={!newPlaylistName.trim() || creatingPlaylist}
                    />
                  </HStack>
                </Field>
              </VStack>

              <div className="max-h-64 overflow-y-auto">
                {loadingPlaylists ? (
                  <Text variant="caption" tone="muted" align="center" className="py-2xl">
                    Loading…
                  </Text>
                ) : playlists.length === 0 ? (
                  <Text variant="caption" tone="faint" align="center" className="py-2xl">
                    No playlists yet
                  </Text>
                ) : (
                  <ul>
                    {playlists.map((p) => (
                      <li key={p.id}>
                        <ListRow
                          title={p.name}
                          subtitle={`${p.trackCount} ${p.trackCount === 1 ? "track" : "tracks"}`}
                          onClick={() => addToPlaylist(p.id, p.name)}
                        />
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          )}

          {view === "rename" && (
            <VStack gap="md" pad="base">
              <Text variant="bodyStrong">Rename track</Text>
              <Input
                autoFocus
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleRename()}
              />
              <HStack gap="sm">
                <div className="flex-1">
                  <Button label="Cancel" variant="secondary" block onClick={onClose} />
                </div>
                <div className="flex-1">
                  <Button
                    label={saving ? "Saving…" : "Save"}
                    block
                    onClick={handleRename}
                    disabled={saving || !renameValue.trim()}
                  />
                </div>
              </HStack>
            </VStack>
          )}

          {view === "delete" && (
            <VStack gap="md" pad="base">
              <Text variant="bodyStrong">Delete track</Text>
              <Text variant="body" tone="muted">
                Remove &ldquo;{track.title}&rdquo; from your library? This cannot be undone.
              </Text>
              <HStack gap="sm">
                <div className="flex-1">
                  <Button
                    label="Cancel"
                    variant="secondary"
                    block
                    onClick={() => setView("menu")}
                  />
                </div>
                <div className="flex-1">
                  <Button
                    label="Delete"
                    variant="destructive"
                    block
                    onClick={handleDelete}
                  />
                </div>
              </HStack>
            </VStack>
          )}
        </Surface>
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
      if (!res.ok) throw new Error();
      const { url } = (await res.json()) as { url: string };
      setStreamUrl(url);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  };

  const handleTouchStart = () => {
    pressTimer.current = setTimeout(onLongPress, 500);
  };
  const handleTouchEnd = () => {
    if (pressTimer.current) clearTimeout(pressTimer.current);
  };

  const subtitle = [
    track.artist ?? null,
    track.originalBpm != null ? `${track.originalBpm} BPM` : null,
  ]
    .filter(Boolean)
    .join("  ·  ");

  return (
    <li>
      <div className="flex items-center group">
        <button
          onClick={handlePlay}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          onTouchMove={handleTouchEnd}
          disabled={loading}
          className="flex-1 flex items-center gap-md py-sm hover:bg-paper-sunken active:bg-paper-edge transition-colors text-left rounded-lg min-w-0"
        >
          <div className="w-11 h-11 rounded-md bg-paper-sunken flex items-center justify-center shrink-0 ml-sm">
            <span className="text-body-lg text-ink-muted">♫</span>
          </div>
          <div className="flex-1 min-w-0">
            <Text variant="bodyStrong" numberOfLines={1}>
              {track.title}
            </Text>
            {subtitle ? (
              <Text variant="caption" tone="muted" numberOfLines={1}>
                {subtitle}
              </Text>
            ) : null}
          </div>
          <span className="text-ink-muted text-caption tabular-nums shrink-0 pr-sm">
            {loading ? "…" : formatDuration(track.duration)}
          </span>
        </button>

        <button
          onClick={onLongPress}
          aria-label="Track options"
          title="Track options"
          className="p-sm text-ink-faint hover:text-ink transition-colors opacity-0 group-hover:opacity-100 shrink-0"
        >
          ⋯
        </button>
      </div>

      {streamUrl ? (
        <div className="pb-xs">
          <audio
            ref={audioRef}
            src={streamUrl}
            controls
            autoPlay
            className="w-full h-9"
            style={{ accentColor: palette.ink }}
          />
        </div>
      ) : null}
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
        const res = await fetch(`${API_URL}/tracks`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error("Failed to load tracks");
        setTracks((await res.json()) as LibraryTrack[]);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load tracks.");
      } finally {
        setLoading(false);
      }
    })();
  }, [getToken]);

  const sorted = sortTracks(tracks, sort);

  if (loading) {
    return (
      <Text variant="caption" tone="muted" align="center" className="py-2xl">
        Loading…
      </Text>
    );
  }
  if (error) {
    return (
      <Text variant="caption" tone="critical">
        {error}
      </Text>
    );
  }
  if (tracks.length === 0) {
    return (
      <VStack gap="xs" align="center" padY="3xl">
        <Text variant="title" align="center">
          No tracks yet
        </Text>
        <Text variant="body" tone="muted" align="center">
          Go to Downloads to add music
        </Text>
      </VStack>
    );
  }

  return (
    <>
      <ul className="divide-y divide-paper-edge">
        {sorted.map((track) => (
          <TrackRow
            key={track.id}
            track={track}
            getToken={getToken}
            onLongPress={() => setActiveTrack(track)}
          />
        ))}
      </ul>

      {activeTrack ? (
        <TrackMenu
          track={activeTrack}
          getToken={getToken}
          onClose={() => setActiveTrack(null)}
          onDeleted={(id) => {
            setTracks((prev) => prev.filter((t) => t.id !== id));
            setActiveTrack(null);
          }}
          onRenamed={(id, title) => {
            setTracks((prev) =>
              prev.map((t) => (t.id === id ? { ...t, title } : t)),
            );
            setActiveTrack(null);
          }}
        />
      ) : null}
    </>
  );
}
