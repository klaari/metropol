import { tracks } from "@metropol/db";
import type { Track } from "@metropol/types";
import { useAuth } from "@clerk/clerk-expo";
import * as DocumentPicker from "expo-document-picker";
import {
  uploadAsync,
  FileSystemUploadType,
} from "expo-file-system/legacy";
import { randomUUID } from "expo-crypto";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActionSheetIOS,
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import EditTrackModal from "../../components/EditTrackModal";
import TrackItem from "../../components/TrackItem";
import { db } from "../../lib/db";
import { buildFileKey, getUploadUrl } from "../../lib/r2";
import { type SortOption, useLibraryStore } from "../../store/library";
import { usePlaylistsStore } from "../../store/playlists";

const AUDIO_TYPES = [
  "audio/mpeg",
  "audio/mp4",
  "audio/aac",
  "audio/wav",
  "audio/x-wav",
  "audio/flac",
  "audio/ogg",
];

function extFromName(name: string): string {
  const parts = name.split(".");
  return parts.length > 1 ? parts.pop()!.toLowerCase() : "mp3";
}

function contentTypeFromExt(ext: string): string {
  const map: Record<string, string> = {
    mp3: "audio/mpeg",
    m4a: "audio/mp4",
    aac: "audio/aac",
    wav: "audio/wav",
    flac: "audio/flac",
    ogg: "audio/ogg",
  };
  return map[ext] ?? "audio/mpeg";
}

const SORT_LABELS: Record<SortOption, string> = {
  date: "Date Added",
  title: "Title A–Z",
  bpm: "BPM",
};

export default function LibraryScreen() {
  const { userId } = useAuth();
  const router = useRouter();
  const {
    tracks: trackList,
    isLoading,
    sort,
    setSort,
    fetchTracks,
    addTrack,
    updateTrack,
    deleteTrack,
  } = useLibraryStore();

  const [importing, setImporting] = useState(false);
  const [editingTrack, setEditingTrack] = useState<Track | null>(null);
  const [playlistPickerTrack, setPlaylistPickerTrack] = useState<Track | null>(null);
  const [newPlaylistName, setNewPlaylistName] = useState("");
  const [creatingPlaylist, setCreatingPlaylist] = useState(false);

  const {
    playlists: playlistList,
    fetchPlaylists,
    addTracksToPlaylist,
    createPlaylist,
  } = usePlaylistsStore();

  useEffect(() => {
    if (userId) {
      fetchTracks(userId);
      fetchPlaylists(userId);
    }
  }, [userId]);

  const handleImport = useCallback(async () => {
    if (!userId) return;

    const result = await DocumentPicker.getDocumentAsync({
      type: AUDIO_TYPES,
      copyToCacheDirectory: true,
    });

    if (result.canceled || result.assets.length === 0) return;

    const file = result.assets[0]!;
    const ext = extFromName(file.name);
    const trackId = randomUUID();
    const fileKey = buildFileKey(userId, trackId, ext);
    const contentType = contentTypeFromExt(ext);

    setImporting(true);
    try {
      console.log("[import] generating presigned URL…");
      const uploadUrl = await getUploadUrl(fileKey, contentType);

      console.log("[import] uploading to R2…");
      const uploadResult = await uploadAsync(uploadUrl, file.uri, {
        httpMethod: "PUT",
        headers: { "Content-Type": contentType },
        uploadType: FileSystemUploadType.BINARY_CONTENT,
      });

      if (uploadResult.status < 200 || uploadResult.status >= 300) {
        throw new Error(`Upload failed with status ${uploadResult.status}`);
      }

      console.log("[import] inserting into DB…");
      const title = file.name.replace(/\.[^.]+$/, "");

      const [inserted] = await db
        .insert(tracks)
        .values({
          id: trackId,
          userId,
          title,
          fileKey,
          fileSize: file.size ?? null,
          format: ext,
        })
        .returning();

      addTrack(inserted as Track);
      console.log("[import] done!");
    } catch (err) {
      console.error("[import] error:", err);
      Alert.alert(
        "Import Failed",
        err instanceof Error ? err.message : "Something went wrong",
      );
    } finally {
      setImporting(false);
    }
  }, [userId]);

  function openPlaylistPicker(track: Track) {
    if (userId) fetchPlaylists(userId);
    setNewPlaylistName("");
    setCreatingPlaylist(false);
    setPlaylistPickerTrack(track);
  }

  async function handlePickPlaylist(playlistId: string, playlistName: string) {
    if (!playlistPickerTrack) return;
    const track = playlistPickerTrack;
    setPlaylistPickerTrack(null);
    const added = await addTracksToPlaylist(playlistId, [track.id]);
    if (added > 0) {
      Alert.alert("Added", `"${track.title}" added to ${playlistName}`);
    } else {
      Alert.alert("Already Added", `"${track.title}" is already in ${playlistName}`);
    }
  }

  async function handleCreateAndAdd() {
    const name = newPlaylistName.trim();
    if (!name || !userId || !playlistPickerTrack) return;
    setCreatingPlaylist(true);
    try {
      await createPlaylist(userId, name);
      const created = usePlaylistsStore.getState().playlists.find(
        (p) => p.name === name,
      );
      if (created) {
        await handlePickPlaylist(created.id, created.name);
      }
    } finally {
      setCreatingPlaylist(false);
    }
  }

  function showTrackActions(track: Track) {
    const options = ["Add to Playlist", "Edit Metadata", "Delete", "Cancel"];
    const destructiveIndex = 2;
    const cancelIndex = 3;

    function handleAction(index: number) {
      if (index === 0) {
        openPlaylistPicker(track);
      } else if (index === 1) {
        setEditingTrack(track);
      } else if (index === 2) {
        Alert.alert("Delete Track", `Delete "${track.title}"?`, [
          { text: "Cancel", style: "cancel" },
          {
            text: "Delete",
            style: "destructive",
            onPress: () => deleteTrack(track.id),
          },
        ]);
      }
    }

    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        { options, destructiveButtonIndex: destructiveIndex, cancelButtonIndex: cancelIndex },
        handleAction,
      );
    } else {
      Alert.alert("Track Options", track.title, [
        { text: "Add to Playlist", onPress: () => handleAction(0) },
        { text: "Edit Metadata", onPress: () => handleAction(1) },
        { text: "Delete", style: "destructive", onPress: () => handleAction(2) },
        { text: "Cancel", style: "cancel" },
      ]);
    }
  }

  function showSortPicker() {
    const options: SortOption[] = ["date", "title", "bpm"];
    const labels = options.map((o) => SORT_LABELS[o]);
    labels.push("Cancel");

    function handleSort(index: number) {
      if (index < options.length) setSort(options[index]!);
    }

    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: labels, cancelButtonIndex: labels.length - 1 },
        handleSort,
      );
    } else {
      Alert.alert("Sort By", undefined, [
        ...options.map((o, i) => ({ text: SORT_LABELS[o], onPress: () => handleSort(i) })),
        { text: "Cancel", style: "cancel" as const },
      ]);
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Library</Text>
        <Pressable onPress={showSortPicker}>
          <Text style={styles.sortButton}>{SORT_LABELS[sort]} ▾</Text>
        </Pressable>
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color="#fff" size="large" />
        </View>
      ) : trackList.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyText}>No tracks yet</Text>
          <Text style={styles.emptySubtext}>
            Tap + to import audio files
          </Text>
        </View>
      ) : (
        <FlatList
          data={trackList}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TrackItem
              track={item}
              onPress={() => router.push(`/player/${item.id}`)}
              onLongPress={() => showTrackActions(item)}
            />
          )}
        />
      )}

      {importing ? (
        <View style={styles.fab}>
          <ActivityIndicator color="#000" />
        </View>
      ) : (
        <Pressable style={styles.fab} onPress={handleImport}>
          <Text style={styles.fabText}>+</Text>
        </Pressable>
      )}

      <EditTrackModal
        track={editingTrack}
        visible={editingTrack != null}
        onClose={() => setEditingTrack(null)}
        onSave={async (data) => {
          if (editingTrack) await updateTrack(editingTrack.id, data);
        }}
      />

      <Modal
        visible={playlistPickerTrack != null}
        animationType="slide"
        presentationStyle="formSheet"
        onRequestClose={() => setPlaylistPickerTrack(null)}
      >
        <View style={styles.pickerContainer}>
          <View style={styles.pickerHeader}>
            <Pressable onPress={() => setPlaylistPickerTrack(null)}>
              <Text style={styles.pickerCancel}>Cancel</Text>
            </Pressable>
            <Text style={styles.pickerTitle}>Add to Playlist</Text>
            <View style={{ width: 50 }} />
          </View>

          <FlatList
            data={playlistList}
            keyExtractor={(item) => item.id}
            ListHeaderComponent={
              <View style={styles.newPlaylistRow}>
                <TextInput
                  style={styles.newPlaylistInput}
                  value={newPlaylistName}
                  onChangeText={setNewPlaylistName}
                  placeholder="New playlist name..."
                  placeholderTextColor="#666"
                  returnKeyType="done"
                  onSubmitEditing={handleCreateAndAdd}
                />
                <Pressable
                  style={[
                    styles.newPlaylistButton,
                    (!newPlaylistName.trim() || creatingPlaylist) &&
                      styles.newPlaylistButtonDisabled,
                  ]}
                  onPress={handleCreateAndAdd}
                  disabled={!newPlaylistName.trim() || creatingPlaylist}
                >
                  {creatingPlaylist ? (
                    <ActivityIndicator color="#000" size="small" />
                  ) : (
                    <Text style={styles.newPlaylistButtonText}>Create</Text>
                  )}
                </Pressable>
              </View>
            }
            ListEmptyComponent={
              <View style={styles.pickerEmpty}>
                <Text style={styles.pickerEmptyText}>No playlists yet</Text>
              </View>
            }
            renderItem={({ item }) => (
              <Pressable
                style={styles.pickerRow}
                onPress={() => handlePickPlaylist(item.id, item.name)}
              >
                <Text style={styles.pickerRowText}>{item.name}</Text>
                <Text style={styles.pickerRowCount}>
                  {item.trackCount} {item.trackCount === 1 ? "track" : "tracks"}
                </Text>
              </Pressable>
            )}
          />
        </View>
      </Modal>
    </View>
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
  headerTitle: {
    color: "#fff",
    fontSize: 28,
    fontWeight: "700",
  },
  sortButton: {
    color: "#888",
    fontSize: 14,
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
  },
  emptySubtext: {
    color: "#666",
    fontSize: 14,
  },
  fab: {
    position: "absolute",
    bottom: 32,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  fabText: {
    fontSize: 28,
    fontWeight: "400",
    color: "#000",
    marginTop: -2,
  },
  pickerContainer: {
    flex: 1,
    backgroundColor: "#000",
  },
  pickerHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#333",
  },
  pickerTitle: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "600",
  },
  pickerCancel: {
    color: "#888",
    fontSize: 16,
  },
  newPlaylistRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#333",
  },
  newPlaylistInput: {
    flex: 1,
    backgroundColor: "#1a1a1a",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 16,
    color: "#fff",
    borderWidth: 1,
    borderColor: "#333",
  },
  newPlaylistButton: {
    backgroundColor: "#fff",
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  newPlaylistButtonDisabled: {
    opacity: 0.3,
  },
  newPlaylistButtonText: {
    color: "#000",
    fontSize: 15,
    fontWeight: "600",
  },
  pickerEmpty: {
    paddingVertical: 32,
    alignItems: "center",
  },
  pickerEmptyText: {
    color: "#666",
    fontSize: 15,
  },
  pickerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#1a1a1a",
  },
  pickerRowText: {
    color: "#fff",
    fontSize: 16,
  },
  pickerRowCount: {
    color: "#666",
    fontSize: 13,
  },
});
