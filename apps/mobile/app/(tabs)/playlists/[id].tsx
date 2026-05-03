import type { Track } from "@aani/types";
import { useAuth } from "@clerk/clerk-expo";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useLibraryStore } from "../../../store/library";
import { usePlaylistsStore } from "../../../store/playlists";
import { usePlayerStore } from "../../../store/player";

type PlaylistTrackItem = Track & { playlistTrackId: string; position: number };

export default function PlaylistDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { userId } = useAuth();
  const router = useRouter();

  const { playlists, getPlaylistTracks, addTracksToPlaylist, removeTrackFromPlaylist, reorderTrack, renamePlaylist } =
    usePlaylistsStore();
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
    if (userId) {
      const idx = tracks.findIndex((t) => t.id === trackId);
      usePlayerStore
        .getState()
        .playWithQueue(
          tracks.map((t) => t.id),
          Math.max(0, idx),
          userId,
        );
    }
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
      <View style={styles.container}>
        <Text style={styles.emptyText}>Playlist not found</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Text style={styles.backArrow}>‹</Text>
        </Pressable>
        {editingName ? (
          <TextInput
            style={styles.nameInput}
            value={nameInput}
            onChangeText={setNameInput}
            autoFocus
            onSubmitEditing={saveRename}
            onBlur={saveRename}
          />
        ) : (
          <Pressable onPress={startRename}>
            <Text style={styles.headerTitle}>{playlist.name}</Text>
          </Pressable>
        )}
        <Pressable onPress={() => {
          if (userId) fetchLibraryTracks(userId);
          setShowPicker(true);
        }}>
          <Text style={styles.addButton}>+ Add</Text>
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color="#fff" size="large" />
        </View>
      ) : tracks.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyText}>No tracks in this playlist</Text>
          <Text style={styles.emptySubtext}>Tap + Add to add tracks</Text>
        </View>
      ) : (
        <FlatList
          data={tracks}
          keyExtractor={(item) => item.playlistTrackId}
          renderItem={({ item, index }) => (
            <View style={styles.trackRow}>
              <View style={styles.reorderBtns}>
                <Pressable
                  onPress={() => handleMoveUp(index)}
                  hitSlop={8}
                  disabled={index === 0}
                >
                  <Text style={[styles.reorderText, index === 0 && styles.reorderDisabled]}>▲</Text>
                </Pressable>
                <Pressable
                  onPress={() => handleMoveDown(index)}
                  hitSlop={8}
                  disabled={index === tracks.length - 1}
                >
                  <Text style={[styles.reorderText, index === tracks.length - 1 && styles.reorderDisabled]}>▼</Text>
                </Pressable>
              </View>
              <Pressable
                style={styles.trackInfo}
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
              >
                <Text style={styles.trackTitle} numberOfLines={1}>
                  {item.title}
                </Text>
                {item.artist ? (
                  <Text style={styles.trackArtist} numberOfLines={1}>
                    {item.artist}
                  </Text>
                ) : null}
              </Pressable>
              <Pressable
                onPress={() =>
                  Alert.alert("Remove", `Remove "${item.title}" from playlist?`, [
                    { text: "Cancel", style: "cancel" },
                    { text: "Remove", style: "destructive", onPress: () => handleRemove(item) },
                  ])
                }
                hitSlop={8}
              >
                <Text style={styles.removeBtn}>✕</Text>
              </Pressable>
            </View>
          )}
        />
      )}

      {/* Track Picker Modal */}
      <TrackPickerModal
        visible={showPicker}
        tracks={libraryTracks}
        existingTrackIds={tracks.map((t) => t.id)}
        onClose={() => setShowPicker(false)}
        onAdd={handleAddTracks}
      />
    </View>
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
      <View style={pickerStyles.container}>
        <View style={pickerStyles.header}>
          <Pressable onPress={onClose}>
            <Text style={pickerStyles.cancel}>Cancel</Text>
          </Pressable>
          <Text style={pickerStyles.title}>Add Tracks</Text>
          <Pressable
            onPress={() => onAdd(Array.from(selected))}
            disabled={selected.size === 0}
          >
            <Text style={[pickerStyles.done, selected.size === 0 && pickerStyles.doneDisabled]}>
              Add ({selected.size})
            </Text>
          </Pressable>
        </View>

        {available.length === 0 ? (
          <View style={pickerStyles.center}>
            <Text style={pickerStyles.emptyText}>All tracks already added</Text>
          </View>
        ) : (
          <FlatList
            data={available}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <Pressable
                style={[pickerStyles.item, selected.has(item.id) && pickerStyles.itemSelected]}
                onPress={() => toggle(item.id)}
              >
                <View style={pickerStyles.check}>
                  <Text style={pickerStyles.checkText}>
                    {selected.has(item.id) ? "✓" : ""}
                  </Text>
                </View>
                <View style={pickerStyles.info}>
                  <Text style={pickerStyles.trackTitle} numberOfLines={1}>
                    {item.title}
                  </Text>
                  {item.artist ? (
                    <Text style={pickerStyles.trackArtist} numberOfLines={1}>
                      {item.artist}
                    </Text>
                  ) : null}
                </View>
              </Pressable>
            )}
          />
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
  },
  backArrow: {
    color: "#fff",
    fontSize: 28,
    fontWeight: "300",
  },
  headerTitle: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "700",
    flex: 1,
    textAlign: "center",
    marginHorizontal: 12,
  },
  nameInput: {
    flex: 1,
    backgroundColor: "#1a1a1a",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 18,
    color: "#fff",
    marginHorizontal: 12,
    borderWidth: 1,
    borderColor: "#444",
    textAlign: "center",
  },
  addButton: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "500",
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "500",
    marginBottom: 6,
    textAlign: "center",
  },
  emptySubtext: {
    color: "#666",
    fontSize: 14,
  },
  trackRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#222",
  },
  reorderBtns: {
    marginRight: 12,
    gap: 2,
  },
  reorderText: {
    color: "#888",
    fontSize: 14,
  },
  reorderDisabled: {
    opacity: 0.2,
  },
  trackInfo: {
    flex: 1,
    marginRight: 12,
  },
  trackTitle: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "500",
  },
  trackArtist: {
    color: "#888",
    fontSize: 14,
    marginTop: 2,
  },
  removeBtn: {
    color: "#666",
    fontSize: 16,
    padding: 4,
  },
});

const pickerStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#333",
  },
  title: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "600",
  },
  cancel: {
    color: "#888",
    fontSize: 16,
  },
  done: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  doneDisabled: {
    opacity: 0.3,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyText: {
    color: "#888",
    fontSize: 16,
  },
  item: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#222",
  },
  itemSelected: {
    backgroundColor: "#111",
  },
  check: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: "#444",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  checkText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
  },
  info: {
    flex: 1,
  },
  trackTitle: {
    color: "#fff",
    fontSize: 16,
  },
  trackArtist: {
    color: "#888",
    fontSize: 14,
    marginTop: 2,
  },
});
