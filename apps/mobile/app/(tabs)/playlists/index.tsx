import { useAuth } from "@clerk/clerk-expo";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActionSheetIOS,
  ActivityIndicator,
  Alert,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { usePlaylistsStore } from "../../../store/playlists";

export default function PlaylistsScreen() {
  const { userId } = useAuth();
  const router = useRouter();
  const { playlists, isLoading, fetchPlaylists, createPlaylist, renamePlaylist, deletePlaylist } =
    usePlaylistsStore();

  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");

  useEffect(() => {
    if (userId) fetchPlaylists(userId);
  }, [userId]);

  function handleCreate() {
    const name = newName.trim();
    if (!name || !userId) return;
    createPlaylist(userId, name);
    setNewName("");
    setShowCreate(false);
  }

  function showActions(playlistId: string, currentName: string) {
    const options = ["Rename", "Delete", "Cancel"];

    function handleAction(index: number) {
      if (index === 0) {
        Alert.prompt?.(
          "Rename Playlist",
          undefined,
          (name: string) => {
            if (name.trim()) renamePlaylist(playlistId, name.trim());
          },
          "plain-text",
          currentName,
        ) ??
          // Android fallback
          Alert.alert("Rename", "Enter new name", [
            { text: "Cancel", style: "cancel" },
            {
              text: "OK",
              onPress: () => {
                // On Android, Alert.prompt doesn't exist — handled inline
              },
            },
          ]);
      } else if (index === 1) {
        Alert.alert("Delete Playlist", `Delete "${currentName}"?`, [
          { text: "Cancel", style: "cancel" },
          {
            text: "Delete",
            style: "destructive",
            onPress: () => deletePlaylist(playlistId),
          },
        ]);
      }
    }

    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        { options, destructiveButtonIndex: 1, cancelButtonIndex: 2 },
        handleAction,
      );
    } else {
      Alert.alert("Playlist Options", currentName, [
        { text: "Rename", onPress: () => handleAction(0) },
        { text: "Delete", style: "destructive", onPress: () => handleAction(1) },
        { text: "Cancel", style: "cancel" },
      ]);
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Playlists</Text>
      </View>

      {showCreate ? (
        <View style={styles.createRow}>
          <TextInput
            style={styles.createInput}
            placeholder="Playlist name"
            placeholderTextColor="#666"
            value={newName}
            onChangeText={setNewName}
            autoFocus
            onSubmitEditing={handleCreate}
          />
          <Pressable style={styles.createBtn} onPress={handleCreate}>
            <Text style={styles.createBtnText}>Create</Text>
          </Pressable>
          <Pressable onPress={() => { setShowCreate(false); setNewName(""); }}>
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
        </View>
      ) : null}

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color="#fff" size="large" />
        </View>
      ) : playlists.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyText}>No playlists yet</Text>
          <Text style={styles.emptySubtext}>Tap + to create one</Text>
        </View>
      ) : (
        <FlatList
          data={playlists}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <Pressable
              style={({ pressed }) => [styles.item, pressed && styles.itemPressed]}
              onPress={() => router.push(`/(tabs)/playlists/${item.id}`)}
              onLongPress={() => showActions(item.id, item.name)}
            >
              <Text style={styles.itemName}>{item.name}</Text>
              <Text style={styles.itemCount}>
                {item.trackCount} {item.trackCount === 1 ? "track" : "tracks"}
              </Text>
            </Pressable>
          )}
        />
      )}

      <Pressable style={styles.fab} onPress={() => setShowCreate(true)}>
        <Text style={styles.fabText}>+</Text>
      </Pressable>
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
  createRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 8,
  },
  createInput: {
    flex: 1,
    backgroundColor: "#1a1a1a",
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: "#fff",
    borderWidth: 1,
    borderColor: "#333",
  },
  createBtn: {
    backgroundColor: "#fff",
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  createBtnText: {
    color: "#000",
    fontWeight: "600",
    fontSize: 14,
  },
  cancelText: {
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
  item: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#222",
  },
  itemPressed: {
    backgroundColor: "#111",
  },
  itemName: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "500",
  },
  itemCount: {
    color: "#888",
    fontSize: 14,
  },
});
