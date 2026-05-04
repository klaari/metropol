import { tracks, userTracks } from "@aani/db";
import type { LibraryTrack, Track } from "@aani/types";
import { useAuth } from "@clerk/clerk-expo";
import { and, eq } from "drizzle-orm";
import * as DocumentPicker from "expo-document-picker";
import {
  EncodingType,
  readAsStringAsync,
  uploadAsync,
  FileSystemUploadType,
} from "expo-file-system/legacy";
import * as Crypto from "expo-crypto";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
  ActionSheetIOS,
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Platform,
  Pressable,
  SectionList,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import EditTrackModal from "../../components/EditTrackModal";
import TrackItem from "../../components/TrackItem";
import { getDb } from "../../lib/db";
import { buildContentKey, getUploadUrl } from "../../lib/r2";
import { ensureLocalCopy } from "../../lib/localAudio";
import { type SortOption, useLibraryStore } from "../../store/library";
import { usePlayerStore } from "../../store/player";
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

function base64ToBytes(b64: string): Uint8Array<ArrayBuffer> {
  const binary = atob(b64);
  const len = binary.length;
  const bytes = new Uint8Array(new ArrayBuffer(len));
  for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function bytesToHex(buf: ArrayBuffer | Uint8Array): string {
  const arr = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let hex = "";
  for (let i = 0; i < arr.length; i++) hex += arr[i]!.toString(16).padStart(2, "0");
  return hex;
}

async function sha256OfFile(uri: string): Promise<string> {
  const b64 = await readAsStringAsync(uri, { encoding: EncodingType.Base64 });
  const bytes = base64ToBytes(b64);
  const hashBuf = await Crypto.digest(Crypto.CryptoDigestAlgorithm.SHA256, bytes);
  return bytesToHex(hashBuf);
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

  useFocusEffect(
    useCallback(() => {
      if (userId) {
        fetchTracks(userId);
        fetchPlaylists(userId);
      }
    }, [userId]),
  );

  const handleImport = useCallback(async () => {
    if (!userId) return;

    const result = await DocumentPicker.getDocumentAsync({
      type: AUDIO_TYPES,
      copyToCacheDirectory: true,
    });

    if (result.canceled || result.assets.length === 0) return;

    const file = result.assets[0]!;
    const ext = extFromName(file.name);
    const contentType = contentTypeFromExt(ext);
    const title = file.name.replace(/\.[^.]+$/, "");
    const db = getDb();

    setImporting(true);
    try {
      console.log("[import] hashing file…");
      const contentHash = await sha256OfFile(file.uri);

      // Dedup: same bytes already in tracks?
      const [dupe] = await db
        .select()
        .from(tracks)
        .where(eq(tracks.contentHash, contentHash));

      let track: Track;
      if (dupe) {
        console.log(`[import] dedup hit: ${contentHash} → reusing track ${dupe.id}`);
        track = dupe as Track;
      } else {
        const fileKey = buildContentKey(contentHash, ext);
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

        console.log("[import] inserting tracks row…");
        const [inserted] = await db
          .insert(tracks)
          .values({
            source: "upload",
            sourceId: null,
            contentHash,
            title,
            fileKey,
            fileSize: file.size ?? null,
            format: ext,
          })
          .returning();
        track = inserted as Track;
      }

      console.log("[import] linking userTracks…");
      const [insertedLink] = await db
        .insert(userTracks)
        .values({ userId, trackId: track.id, originalBpm: null })
        .onConflictDoNothing()
        .returning();
      const userTrack =
        insertedLink ??
        (
          await db
            .select()
            .from(userTracks)
            .where(and(eq(userTracks.userId, userId), eq(userTracks.trackId, track.id)))
        )[0]!;

      const libraryTrack: LibraryTrack = {
        ...track,
        userTrackId: userTrack.id,
        addedAt: userTrack.addedAt,
        originalBpm: userTrack.originalBpm,
      };

      addTrack(libraryTrack);
      ensureLocalCopy(track, userId).catch((e) =>
        console.warn("[localAudio] import cache failed:", e?.message ?? e),
      );
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
    const options = [
      "Play next",
      "Add to queue",
      "Add to Playlist",
      "Edit Metadata",
      "Delete",
      "Cancel",
    ];
    const destructiveIndex = 4;
    const cancelIndex = 5;

    function handleAction(index: number) {
      if (!userId) return;
      if (index === 0) {
        usePlayerStore.getState().playNext(track.id, userId);
      } else if (index === 1) {
        usePlayerStore.getState().addToQueue(track.id, userId);
      } else if (index === 2) {
        openPlaylistPicker(track);
      } else if (index === 3) {
        setEditingTrack(track);
      } else if (index === 4) {
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
        { text: "Play next", onPress: () => handleAction(0) },
        { text: "Add to queue", onPress: () => handleAction(1) },
        { text: "Add to Playlist", onPress: () => handleAction(2) },
        { text: "Edit Metadata", onPress: () => handleAction(3) },
        { text: "Delete", style: "destructive", onPress: () => handleAction(4) },
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

  const sections = useMemo(() => {
    if (sort !== "date") return [{ title: "", data: trackList }];
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(today.getTime() - 7 * 86400000);

    const groups: Record<string, LibraryTrack[]> = {};
    const order: string[] = [];
    for (const track of trackList) {
      const added = new Date(track.addedAt);
      let label: string;
      if (added >= today) label = "Today";
      else if (added >= weekAgo) label = "This Week";
      else label = "Earlier";

      if (!groups[label]) {
        groups[label] = [];
        order.push(label);
      }
      groups[label]!.push(track);
    }
    return order.map((title) => ({ title, data: groups[title]! }));
  }, [trackList, sort]);

  const trackCount = trackList.length;
  const trackCountLabel = trackCount === 1 ? "1 track" : `${trackCount} tracks`;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Library</Text>
          {trackCount > 0 && (
            <Text style={styles.headerSubtitle}>{trackCountLabel}</Text>
          )}
        </View>
        <Pressable
          style={styles.sortPill}
          onPress={showSortPicker}
          android_ripple={{ color: "rgba(255,255,255,0.1)", borderless: true }}
        >
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
            Tap "Add track" to import audio files
          </Text>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          renderSectionHeader={({ section: { title } }) =>
            title ? (
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionHeaderText}>{title}</Text>
              </View>
            ) : null
          }
          renderItem={({ item }) => (
            <TrackItem
              track={item}
              onPress={() => {
                if (!userId) return;
                const idx = trackList.findIndex((t) => t.id === item.id);
                usePlayerStore
                  .getState()
                  .playWithQueue(trackList, Math.max(0, idx), userId);
              }}
              onLongPress={() => showTrackActions(item)}
            />
          )}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          contentContainerStyle={styles.listContent}
          stickySectionHeadersEnabled={false}
        />
      )}

      {importing ? (
        <View style={styles.fab}>
          <ActivityIndicator color="#000" />
        </View>
      ) : (
        <Pressable
          style={styles.fab}
          onPress={handleImport}
          android_ripple={{ color: "rgba(0,0,0,0.15)" }}
        >
          <Text style={styles.fabIcon}>+</Text>
          <Text style={styles.fabLabel}>Add track</Text>
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
  headerSubtitle: {
    color: "#666",
    fontSize: 13,
    marginTop: 2,
  },
  sortPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: "#1a1a1a",
  },
  sortButton: {
    color: "#999",
    fontSize: 13,
    fontWeight: "500",
  },
  sectionHeader: {
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 8,
  },
  sectionHeaderText: {
    color: "#666",
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "#1a1a1a",
    marginLeft: 78,
  },
  listContent: {
    paddingBottom: 100,
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
    right: 20,
    flexDirection: "row",
    alignItems: "center",
    height: 48,
    paddingHorizontal: 20,
    borderRadius: 24,
    backgroundColor: "#fff",
    elevation: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    gap: 6,
  },
  fabIcon: {
    fontSize: 22,
    fontWeight: "500",
    color: "#000",
    marginTop: -1,
  },
  fabLabel: {
    fontSize: 15,
    fontWeight: "600",
    color: "#000",
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
