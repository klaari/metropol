import type { Track } from "@aani/types";
import { useAuth } from "@clerk/clerk-expo";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, FlatList, Modal, View } from "react-native";
import {
  AppBar,
  Button,
  Divider,
  HStack,
  IconButton,
  Input,
  ListRow,
  Pressable,
  Screen,
  Text,
  VStack,
  palette,
  space,
} from "../../../components/ui";
import { useLibraryStore } from "../../../store/library";
import { usePlayerStore } from "../../../store/player";
import { usePlaylistsStore } from "../../../store/playlists";

type PlaylistTrackItem = Track & { playlistTrackId: string; position: number };

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

  function handleTrackPress(trackId: string) {
    if (id) setPlaylistContext(id);
    if (!userId) return;
    const idx = tracks.findIndex((t) => t.id === trackId);
    usePlayerStore
      .getState()
      .playWithQueue(tracks, Math.max(0, idx), userId);
  }

  async function handleRemove(item: PlaylistTrackItem) {
    if (!id) return;
    await removeTrackFromPlaylist(item.playlistTrackId, id);
    setTracks((prev) => prev.filter((t) => t.playlistTrackId !== item.playlistTrackId));
  }

  async function handleMoveUp(index: number) {
    if (index === 0 || !id) return;
    await reorderTrack(id, index, index - 1);
    await loadTracks();
  }

  async function handleMoveDown(index: number) {
    if (index >= tracks.length - 1 || !id) return;
    await reorderTrack(id, index, index + 1);
    await loadTracks();
  }

  function startRename() {
    setNameInput(playlist?.name ?? "");
    setEditingName(true);
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

  if (!playlist) {
    return (
      <Screen scroll={false}>
        <VStack flex justify="center" align="center">
          <Text variant="title">Playlist not found</Text>
        </VStack>
      </Screen>
    );
  }

  return (
    <Screen scroll={false}>
      <VStack flex gap="lg">
        <AppBar
          title={editingName ? undefined : playlist.name}
          onBack={() => router.back()}
          trailing={
            <IconButton
              icon="add"
              accessibilityLabel="Add tracks"
              onPress={() => {
                if (userId) fetchLibraryTracks(userId);
                setShowPicker(true);
              }}
            />
          }
        />

        {editingName ? (
          <HStack gap="sm">
            <View style={{ flex: 1 }}>
              <Input
                value={nameInput}
                onChangeText={setNameInput}
                autoFocus
                onSubmitEditing={saveRename}
                onBlur={saveRename}
              />
            </View>
            <Button label="Save" onPress={saveRename} />
          </HStack>
        ) : (
          <Pressable flat onPress={startRename}>
            <Text variant="display">{playlist.name}</Text>
          </Pressable>
        )}

        {loading ? (
          <VStack flex justify="center" align="center">
            <ActivityIndicator color={palette.ink} size="large" />
          </VStack>
        ) : tracks.length === 0 ? (
          <VStack flex justify="center" align="center" gap="xs">
            <Text variant="title" align="center">
              No tracks in this playlist
            </Text>
            <Text variant="body" tone="muted" align="center">
              Tap add to add tracks
            </Text>
          </VStack>
        ) : (
          <FlatList
            data={tracks}
            keyExtractor={(item) => item.playlistTrackId}
            renderItem={({ item, index }) => (
              <ListRow
                title={item.title}
                subtitle={item.artist ?? undefined}
                leading={
                  <VStack gap="xs" align="center">
                    <IconButton
                      icon="chevron-up"
                      accessibilityLabel="Move track up"
                      onPress={() => handleMoveUp(index)}
                      disabled={index === 0}
                      size={16}
                    />
                    <IconButton
                      icon="chevron-down"
                      accessibilityLabel="Move track down"
                      onPress={() => handleMoveDown(index)}
                      disabled={index === tracks.length - 1}
                      size={16}
                    />
                  </VStack>
                }
                trailing={
                  <IconButton
                    icon="close"
                    accessibilityLabel="Remove from playlist"
                    color={palette.inkMuted}
                    onPress={() =>
                      Alert.alert("Remove", `Remove "${item.title}" from playlist?`, [
                        { text: "Cancel", style: "cancel" },
                        {
                          text: "Remove",
                          style: "destructive",
                          onPress: () => handleRemove(item),
                        },
                      ])
                    }
                  />
                }
                onPress={() => handleTrackPress(item.id)}
                onLongPress={() => {
                  if (!userId) return;
                  Alert.alert(item.title, undefined, [
                    {
                      text: "Play next",
                      onPress: () => usePlayerStore.getState().playNext(item.id, userId),
                    },
                    {
                      text: "Add to queue",
                      onPress: () => usePlayerStore.getState().addToQueue(item.id, userId),
                    },
                    { text: "Cancel", style: "cancel" },
                  ]);
                }}
              />
            )}
            ItemSeparatorComponent={() => <Divider indent={64} inset="none" />}
            showsVerticalScrollIndicator={false}
          />
        )}

        <TrackPickerModal
          visible={showPicker}
          tracks={libraryTracks}
          existingTrackIds={tracks.map((t) => t.id)}
          onClose={() => setShowPicker(false)}
          onAdd={handleAddTracks}
        />
      </VStack>
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
    <Modal visible={visible} animationType="slide" presentationStyle="formSheet" onRequestClose={onClose}>
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
