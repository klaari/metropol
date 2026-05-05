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
  ToastAndroid,
  View,
} from "react-native";
import { usePlaylistsStore } from "../store/playlists";
import {
  Button,
  Divider,
  HStack,
  IconButton,
  Input,
  Pressable,
  Surface,
  Text,
  VStack,
  palette,
  radius,
  space,
} from "./ui";

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
      <Pressable
        flat
        style={{ flex: 1, backgroundColor: "rgba(22,19,14,0.45)" }}
        onPress={close}
      />
      <Surface
        tone="raised"
        lift="sheet"
        rounded="xl"
        pad="md"
        style={{
          position: "absolute",
          bottom: kbHeight,
          left: 0,
          right: 0,
          maxHeight: "70%",
          minHeight: "30%",
        }}
      >
        <VStack gap="md">
          <View
            style={{
              alignSelf: "center",
              width: 40,
              height: 4,
              borderRadius: radius.full,
              backgroundColor: palette.paperEdge,
            }}
          />
          <HStack justify="between">
            <Text variant="title">Add to playlist</Text>
            <IconButton icon="close" accessibilityLabel="Close" onPress={close} />
          </HStack>

          <FlatList
            data={playlists}
            keyExtractor={(p) => p.id}
            ListHeaderComponent={
              showCreateInput ? (
                <HStack gap="sm" padY="sm">
                  <View style={{ flex: 1 }}>
                    <Input
                      value={newPlaylistName}
                      onChangeText={setNewPlaylistName}
                      placeholder="New playlist name..."
                      returnKeyType="done"
                      autoFocus
                      onSubmitEditing={handleCreateAndAdd}
                    />
                  </View>
                  <Button
                    label={creatingPlaylist ? "Creating" : "Create"}
                    onPress={handleCreateAndAdd}
                    disabled={!newPlaylistName.trim() || creatingPlaylist}
                    leading={
                      creatingPlaylist ? (
                        <ActivityIndicator color={palette.inkInverse} size="small" />
                      ) : null
                    }
                  />
                </HStack>
              ) : (
                <Pressable
                  flat
                  onPress={() => setShowCreateInput(true)}
                  android_ripple={{ color: palette.paperSunken }}
                >
                  <HStack gap="md" padY="md">
                    <Ionicons name="add" size={22} color={palette.ink} />
                    <Text variant="bodyStrong">Create new playlist</Text>
                  </HStack>
                </Pressable>
              )
            }
            ListEmptyComponent={
              showCreateInput ? null : (
                <VStack padY="xl" align="center">
                  <Text variant="caption" tone="muted" align="center">
                    No playlists yet — tap Create new playlist above.
                  </Text>
                </VStack>
              )
            }
            renderItem={({ item: pl }) => (
              <Pressable
                flat
                onPress={() => handlePickPlaylist(pl.id, pl.name)}
                android_ripple={{ color: palette.paperSunken }}
              >
                <HStack justify="between" padY="md">
                  <Text variant="bodyStrong">{pl.name}</Text>
                  <Text variant="caption" tone="muted">
                    {pl.trackCount} {pl.trackCount === 1 ? "track" : "tracks"}
                  </Text>
                </HStack>
              </Pressable>
            )}
            ItemSeparatorComponent={() => <Divider inset="none" />}
            contentContainerStyle={{ paddingBottom: space.lg }}
            showsVerticalScrollIndicator={false}
          />
        </VStack>
      </Surface>
    </Modal>
  );
}
