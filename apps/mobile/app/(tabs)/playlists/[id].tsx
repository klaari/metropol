import type { Track } from "@aani/types";
import { useAuth } from "@clerk/clerk-expo";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { memo, useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  View,
  type ListRenderItemInfo,
} from "react-native";
import {
  ActionSheet,
  type ActionItem,
  AppBar,
  Button,
  Divider,
  HStack,
  IconButton,
  Input,
  MiniTile,
  Pressable,
  Screen,
  Text,
  VStack,
  palette,
  radius,
  space,
} from "../../../components/ui";
import { useLibraryStore } from "../../../store/library";
import { usePlayerStore } from "../../../store/player";
import { usePlaylistsStore } from "../../../store/playlists";

type PlaylistTrackItem = Track & { playlistTrackId: string; position: number };

function formatDuration(seconds: number | null): string {
  if (seconds == null) return "--:--";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatTotal(seconds: number): string {
  if (!seconds) return "0 min";
  const totalMin = Math.round(seconds / 60);
  if (totalMin < 60) return `${totalMin} min`;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

interface RowProps {
  track: PlaylistTrackItem;
  onPress: () => void;
  onMore: () => void;
}

const Row = memo(function Row({ track, onPress, onMore }: RowProps) {
  const bpm = (track as PlaylistTrackItem & { originalBpm?: number | null }).originalBpm;
  const duration = track.duration ?? 0;
  return (
    <Pressable
      flat
      onPress={onPress}
      onLongPress={onMore}
      delayLongPress={400}
      accessibilityLabel={`${track.title}${track.artist ? `, ${track.artist}` : ""}`}
      accessibilityRole="button"
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: space.md,
        paddingVertical: space.sm,
        paddingHorizontal: space.base,
        borderBottomWidth: 1,
        borderBottomColor: palette.paperEdge,
      }}
    >
      <MiniTile title={track.title} size={36} />
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <Text variant="bodyStrong" numberOfLines={1}>
          {track.artist ? `${track.artist}  ·  ` : ""}
          {track.title}
        </Text>
        {bpm != null || duration > 0 ? (
          <Text variant="caption" tone="muted" numberOfLines={1}>
            {[
              bpm != null ? `${Math.round(bpm)} BPM` : null,
              duration > 0 ? formatDuration(duration) : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
});

export default function PlaylistDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { userId } = useAuth();
  const router = useRouter();

  const {
    playlists,
    getPlaylistTracks,
    addTracksToPlaylist,
    removeTrackFromPlaylist,
    reorderTrack,
    renamePlaylist,
    deletePlaylist,
  } = usePlaylistsStore();
  const libraryTracks = useLibraryStore((s) => s.tracks);
  const fetchLibraryTracks = useLibraryStore((s) => s.fetchTracks);
  const setPlaylistContext = usePlayerStore((s) => s.setPlaylistContext);

  const playlist = playlists.find((p) => p.id === id);

  const [tracks, setTracks] = useState<PlaylistTrackItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPicker, setShowPicker] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [contextTrack, setContextTrack] = useState<{
    track: PlaylistTrackItem;
    index: number;
  } | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);

  const loadTracks = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    const rows = await getPlaylistTracks(id);
    setTracks(rows);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    loadTracks();
  }, [loadTracks]);

  function handleTrackPress(index: number) {
    if (id) setPlaylistContext(id);
    if (!userId) return;
    usePlayerStore.getState().playWithQueue(tracks, index, userId);
  }

  function handlePlayAll() {
    if (id) setPlaylistContext(id);
    if (!userId || tracks.length === 0) return;
    usePlayerStore.getState().playWithQueue(tracks, 0, userId);
  }

  async function handleRemove(item: PlaylistTrackItem) {
    if (!id) return;
    await removeTrackFromPlaylist(item.playlistTrackId, id);
    setTracks((prev) =>
      prev.filter((t) => t.playlistTrackId !== item.playlistTrackId),
    );
  }

  async function handleMove(index: number, delta: -1 | 1) {
    if (!id) return;
    const next = index + delta;
    if (next < 0 || next >= tracks.length) return;
    await reorderTrack(id, index, next);
    await loadTracks();
  }

  function startRename() {
    setNameInput(playlist?.name ?? "");
    setEditingName(true);
    setMoreOpen(false);
  }

  async function saveRename() {
    setEditingName(false);
    const name = nameInput.trim();
    if (!name || !id) return;
    await renamePlaylist(id, name);
  }

  async function handleAddTracks(selectedIds: string[]) {
    if (!id) return;
    await addTracksToPlaylist(id, selectedIds);
    setShowPicker(false);
    await loadTracks();
  }

  function confirmDelete() {
    if (!id || !playlist) return;
    setMoreOpen(false);
    Alert.alert("Delete Playlist", `Delete "${playlist.name}"?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await deletePlaylist(id);
          router.back();
        },
      },
    ]);
  }

  const totalDuration = useMemo(
    () => tracks.reduce((acc, t) => acc + (t.duration ?? 0), 0),
    [tracks],
  );

  const moreActions = useMemo<ActionItem[]>(
    () => [
      {
        icon: "add-outline",
        label: "Add tracks",
        onPress: () => {
          if (userId) fetchLibraryTracks(userId);
          setShowPicker(true);
        },
      },
      {
        icon: "create-outline",
        label: "Rename",
        onPress: startRename,
      },
      {
        icon: "trash-outline",
        label: "Delete playlist",
        destructive: true,
        onPress: confirmDelete,
      },
    ],
    [userId, fetchLibraryTracks],
  );

  const trackContextActions = useMemo<ActionItem[]>(() => {
    if (!contextTrack || !userId) return [];
    const t = contextTrack.track;
    const i = contextTrack.index;
    const out: ActionItem[] = [
      {
        icon: "play-skip-forward",
        label: "Play next",
        onPress: () => usePlayerStore.getState().playNext(t.id, userId),
      },
      {
        icon: "list-outline",
        label: "Add to queue",
        onPress: () => usePlayerStore.getState().addToQueue(t.id, userId),
      },
    ];
    if (i > 0) {
      out.push({
        icon: "arrow-up",
        label: "Move up",
        onPress: () => handleMove(i, -1),
      });
    }
    if (i < tracks.length - 1) {
      out.push({
        icon: "arrow-down",
        label: "Move down",
        onPress: () => handleMove(i, 1),
      });
    }
    out.push({
      icon: "close",
      label: "Remove from playlist",
      destructive: true,
      onPress: () => handleRemove(t),
    });
    return out;
  }, [contextTrack, userId, tracks.length]);

  if (!playlist) {
    return (
      <Screen scroll={false}>
        <VStack flex justify="center" align="center">
          <Text variant="title">Playlist not found</Text>
        </VStack>
      </Screen>
    );
  }

  const trackCount = tracks.length;
  const trackCountLabel = trackCount === 1 ? "1 track" : `${trackCount} tracks`;

  const renderItem = ({
    item,
    index,
  }: ListRenderItemInfo<PlaylistTrackItem>) => (
    <Row
      track={item}
      onPress={() => handleTrackPress(index)}
      onMore={() => setContextTrack({ track: item, index })}
    />
  );

  const ListHeader = (
    <View
      style={{
        paddingHorizontal: space.base,
        paddingTop: space.sm,
        paddingBottom: space.lg,
      }}
    >
      <Text variant="eyebrow" tone="muted">
        Playlist
      </Text>
      {editingName ? (
        <View style={{ marginTop: space.xs }}>
          <Input
            value={nameInput}
            onChangeText={setNameInput}
            autoFocus
            onSubmitEditing={saveRename}
            onBlur={saveRename}
            returnKeyType="done"
          />
        </View>
      ) : (
        <Pressable
          flat
          onPress={startRename}
          accessibilityLabel="Rename playlist"
          accessibilityRole="button"
          style={{ marginTop: space.xs }}
        >
          <Text
            variant="titleLg"
            numberOfLines={2}
            style={{ fontSize: 30, letterSpacing: -0.6 }}
          >
            {playlist.name}
          </Text>
        </Pressable>
      )}
      <Text
        variant="caption"
        tone="muted"
        style={{ marginTop: space.xs }}
      >
        {trackCountLabel}
        {totalDuration > 0 ? `  ·  ${formatTotal(totalDuration)}` : ""}
      </Text>

      {trackCount > 0 ? (
        <View style={{ marginTop: space.md }}>
          <Pressable
            flat
            onPress={handlePlayAll}
            accessibilityLabel="Play playlist"
            accessibilityRole="button"
            style={{
              alignSelf: "flex-start",
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
              paddingVertical: 8,
              paddingHorizontal: 14,
              borderRadius: radius.full,
              backgroundColor: palette.ink,
            }}
          >
            <Ionicons name="play" size={14} color={palette.inkInverse} />
            <Text
              variant="bodyStrong"
              tone="inverse"
              style={{ fontSize: 13 }}
            >
              Play
            </Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );

  return (
    <Screen scroll={false} inset={false}>
      <VStack flex>
        <AppBar
          onBack={() => router.back()}
          trailing={
            <IconButton
              icon="ellipsis-horizontal"
              accessibilityLabel="More"
              size={20}
              onPress={() => setMoreOpen(true)}
            />
          }
        />

        {loading ? (
          <VStack flex justify="center" align="center">
            <ActivityIndicator color={palette.ink} size="large" />
          </VStack>
        ) : tracks.length === 0 ? (
          <VStack flex>
            {ListHeader}
            <VStack flex justify="center" align="center" gap="sm" padX="base">
              <Ionicons
                name="musical-notes-outline"
                size={48}
                color={palette.inkFaint}
              />
              <Text variant="title" align="center">
                Nothing here yet
              </Text>
              <Text variant="body" tone="muted" align="center">
                Use the more menu to add tracks from your library.
              </Text>
            </VStack>
          </VStack>
        ) : (
          <FlatList
            data={tracks}
            keyExtractor={(item) => item.playlistTrackId}
            renderItem={renderItem}
            ListHeaderComponent={ListHeader}
            contentContainerStyle={{ paddingBottom: space["2xl"] }}
            showsVerticalScrollIndicator={false}
            initialNumToRender={14}
            maxToRenderPerBatch={10}
            windowSize={9}
          />
        )}
      </VStack>

      <ActionSheet
        visible={moreOpen}
        onClose={() => setMoreOpen(false)}
        actions={moreActions}
      />

      <ActionSheet
        visible={contextTrack != null}
        onClose={() => setContextTrack(null)}
        title={contextTrack?.track.title}
        subtitle={contextTrack?.track.artist ?? undefined}
        actions={trackContextActions}
      />

      <TrackPickerModal
        visible={showPicker}
        tracks={libraryTracks}
        existingTrackIds={tracks.map((t) => t.id)}
        onClose={() => setShowPicker(false)}
        onAdd={handleAddTracks}
      />
    </Screen>
  );
}

function TrackPickerModal({
  visible,
  tracks,
  existingTrackIds,
  onClose,
  onAdd,
}: {
  visible: boolean;
  tracks: Track[];
  existingTrackIds: string[];
  onClose: () => void;
  onAdd: (ids: string[]) => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (visible) setSelected(new Set());
  }, [visible]);

  const available = tracks.filter((t) => !existingTrackIds.includes(t.id));

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="formSheet"
      onRequestClose={onClose}
    >
      <Screen scroll={false}>
        <VStack flex gap="lg">
          <AppBar
            title="Add Tracks"
            onBack={onClose}
            trailing={
              <Button
                label={`Add (${selected.size})`}
                size="sm"
                disabled={selected.size === 0}
                onPress={() => onAdd(Array.from(selected))}
              />
            }
          />

          {available.length === 0 ? (
            <VStack flex justify="center" align="center">
              <Text variant="body" tone="muted">
                All tracks already added
              </Text>
            </VStack>
          ) : (
            <FlatList
              data={available}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <Pressable flat onPress={() => toggle(item.id)}>
                  <HStack gap="md" padY="md">
                    <View
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 14,
                        borderWidth: 2,
                        borderColor: selected.has(item.id)
                          ? palette.cobalt
                          : palette.paperEdge,
                        justifyContent: "center",
                        alignItems: "center",
                        backgroundColor: selected.has(item.id)
                          ? palette.cobalt
                          : palette.transparent,
                      }}
                    >
                      {selected.has(item.id) ? (
                        <Ionicons
                          name="checkmark"
                          size={16}
                          color={palette.inkInverse}
                        />
                      ) : null}
                    </View>
                    <VStack gap="xs" flex>
                      <Text variant="bodyStrong" numberOfLines={1}>
                        {item.title}
                      </Text>
                      {item.artist ? (
                        <Text variant="caption" tone="muted" numberOfLines={1}>
                          {item.artist}
                        </Text>
                      ) : null}
                    </VStack>
                  </HStack>
                </Pressable>
              )}
              ItemSeparatorComponent={() => <Divider inset="none" />}
              contentContainerStyle={{ paddingBottom: space.xl }}
              showsVerticalScrollIndicator={false}
            />
          )}
        </VStack>
      </Screen>
    </Modal>
  );
}
