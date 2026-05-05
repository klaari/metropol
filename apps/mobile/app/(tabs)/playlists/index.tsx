import { useAuth } from "@clerk/clerk-expo";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActionSheetIOS,
  ActivityIndicator,
  Alert,
  FlatList,
  Platform,
  View,
} from "react-native";
import {
  Button,
  Divider,
  HStack,
  IconButton,
  Input,
  ListRow,
  Screen,
  Text,
  VStack,
  palette,
} from "../../../components/ui";
import { usePlaylistsStore } from "../../../store/playlists";

export default function PlaylistsScreen() {
  const { userId } = useAuth();
  const router = useRouter();
  const {
    playlists,
    isLoading,
    fetchPlaylists,
    createPlaylist,
    renamePlaylist,
    deletePlaylist,
  } = usePlaylistsStore();

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
          Alert.alert("Rename", "Enter new name", [
            { text: "Cancel", style: "cancel" },
            { text: "OK" },
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
    <Screen scroll={false}>
      <VStack flex gap="lg">
        <HStack justify="between">
          <Text variant="titleLg">Playlists</Text>
          <IconButton
            icon={showCreate ? "close" : "add"}
            accessibilityLabel={showCreate ? "Cancel playlist creation" : "Create playlist"}
            onPress={() => {
              setShowCreate((current) => !current);
              setNewName("");
            }}
          />
        </HStack>

        {showCreate ? (
          <HStack gap="sm">
            <View style={{ flex: 1 }}>
              <Input
                placeholder="Playlist name"
                value={newName}
                onChangeText={setNewName}
                autoFocus
                onSubmitEditing={handleCreate}
              />
            </View>
            <Button label="Create" onPress={handleCreate} disabled={!newName.trim()} />
          </HStack>
        ) : null}

        {isLoading ? (
          <VStack flex justify="center" align="center">
            <ActivityIndicator color={palette.ink} size="large" />
          </VStack>
        ) : playlists.length === 0 ? (
          <VStack flex justify="center" align="center" gap="xs">
            <Ionicons name="list-outline" size={40} color={palette.inkFaint} />
            <Text variant="title" align="center">
              No playlists yet
            </Text>
            <Text variant="body" tone="muted" align="center">
              Tap add to create one
            </Text>
          </VStack>
        ) : (
          <FlatList
            data={playlists}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <ListRow
                title={item.name}
                subtitle={`${item.trackCount} ${
                  item.trackCount === 1 ? "track" : "tracks"
                }`}
                trailing={
                  <Ionicons
                    name="chevron-forward"
                    size={20}
                    color={palette.inkMuted}
                  />
                }
                onPress={() => router.push(`/(tabs)/playlists/${item.id}`)}
                onLongPress={() => showActions(item.id, item.name)}
              />
            )}
            ItemSeparatorComponent={() => <Divider indent={64} inset="none" />}
            showsVerticalScrollIndicator={false}
          />
        )}
      </VStack>
    </Screen>
  );
}
