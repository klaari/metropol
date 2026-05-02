import { useAuth } from "@clerk/clerk-expo";
import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Keyboard,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  ToastAndroid,
  View,
} from "react-native";
import { usePlaylistsStore } from "../store/playlists";

interface Props {
  visible: boolean;
  track: { id: string; title: string } | null;
  onClose: () => void;
}

export default function PlaylistPickerSheet({ visible, track, onClose }: Props) {
  const { userId } = useAuth();
  const playlists = usePlaylistsStore((s) => s.playlists);
  const fetchPlaylists = usePlaylistsStore((s) => s.fetchPlaylists);
  const addTracksToPlaylist = usePlaylistsStore((s) => s.addTracksToPlaylist);
  const createPlaylist = usePlaylistsStore((s) => s.createPlaylist);

  const [newPlaylistName, setNewPlaylistName] = useState("");
  const [creatingPlaylist, setCreatingPlaylist] = useState(false);
  const [showCreateInput, setShowCreateInput] = useState(false);
  const [kbHeight, setKbHeight] = useState(0);

  useEffect(() => {
    const showSub = Keyboard.addListener("keyboardDidShow", (e) =>
      setKbHeight(e.endCoordinates.height),
    );
    const hideSub = Keyboard.addListener("keyboardDidHide", () => setKbHeight(0));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  useEffect(() => {
    if (visible && userId) fetchPlaylists(userId);
  }, [visible, userId, fetchPlaylists]);

  const close = useCallback(() => {
    setNewPlaylistName("");
    setShowCreateInput(false);
    onClose();
  }, [onClose]);

  async function handlePickPlaylist(playlistId: string, playlistName: string) {
    if (!track) return;
    const t = track;
    close();
    try {
      const added = await addTracksToPlaylist(playlistId, [t.id]);
      const msg =
        added > 0 ? `Added to ${playlistName}` : `Already in ${playlistName}`;
      if (Platform.OS === "android") {
        ToastAndroid.show(msg, ToastAndroid.SHORT);
      }
    } catch (e: any) {
      Alert.alert("Couldn't add to playlist", e?.message ?? "Unknown error");
    }
  }

  async function handleCreateAndAdd() {
    const name = newPlaylistName.trim();
    if (!name || !userId || !track) return;
    setCreatingPlaylist(true);
    try {
      await createPlaylist(userId, name);
      const created = usePlaylistsStore
        .getState()
        .playlists.find((p) => p.name === name);
      if (created) {
        await handlePickPlaylist(created.id, created.name);
      }
    } finally {
      setCreatingPlaylist(false);
    }
  }

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={close}
    >
      <Pressable style={styles.backdrop} onPress={close} />
      <View style={[styles.sheet, { bottom: kbHeight }]}>
        <View style={styles.handle} />
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Add to playlist</Text>
          <Pressable onPress={close} hitSlop={10}>
            <Ionicons name="close" size={24} color="#fff" />
          </Pressable>
        </View>

        <FlatList
          data={playlists}
          keyExtractor={(p) => p.id}
          ListHeaderComponent={
            showCreateInput ? (
              <View style={styles.newPlaylistRow}>
                <TextInput
                  style={styles.newPlaylistInput}
                  value={newPlaylistName}
                  onChangeText={setNewPlaylistName}
                  placeholder="New playlist name…"
                  placeholderTextColor="#666"
                  returnKeyType="done"
                  autoFocus
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
            ) : (
              <Pressable
                style={styles.createNewRow}
                onPress={() => setShowCreateInput(true)}
                android_ripple={{ color: "rgba(255,255,255,0.06)" }}
              >
                <Ionicons name="add" size={22} color="#fff" />
                <Text style={styles.createNewText}>Create new playlist</Text>
              </Pressable>
            )
          }
          ListEmptyComponent={
            showCreateInput ? null : (
              <Text style={styles.emptyText}>
                No playlists yet — tap "Create new playlist" above.
              </Text>
            )
          }
          renderItem={({ item: pl }) => (
            <Pressable
              style={styles.row}
              onPress={() => handlePickPlaylist(pl.id, pl.name)}
              android_ripple={{ color: "rgba(255,255,255,0.06)" }}
            >
              <Text style={styles.rowText}>{pl.name}</Text>
              <Text style={styles.rowCount}>
                {pl.trackCount} {pl.trackCount === 1 ? "track" : "tracks"}
              </Text>
            </Pressable>
          )}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  sheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#0a0a0a",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingTop: 8,
    paddingHorizontal: 12,
    paddingBottom: 16,
    maxHeight: "70%",
    minHeight: "30%",
  },
  handle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#333",
    marginBottom: 8,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 4,
    paddingTop: 4,
    paddingBottom: 8,
  },
  headerTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
  },
  newPlaylistRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#222",
    marginBottom: 4,
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
  createNewRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 16,
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#222",
    marginBottom: 4,
  },
  createNewText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "500",
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#1a1a1a",
  },
  rowText: {
    color: "#fff",
    fontSize: 16,
  },
  rowCount: {
    color: "#666",
    fontSize: 13,
  },
  emptyText: {
    color: "#666",
    textAlign: "center",
    paddingVertical: 32,
    fontSize: 14,
  },
});
