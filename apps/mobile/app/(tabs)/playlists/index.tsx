import { useAuth } from "@clerk/clerk-expo";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Platform,
  View,
  type ListRenderItemInfo,
} from "react-native";
import {
  ActionSheet,
  type ActionItem,
  Button,
  HStack,
  IconButton,
  Input,
  Pressable,
  Screen,
  Text,
  VStack,
  palette,
  radius,
  space,
} from "../../../components/ui";
import { usePlaylistsStore } from "../../../store/playlists";

const ACCENTS: string[] = [
  palette.ink,
  palette.cobalt,
  palette.critical,
  palette.positive,
  palette.cobaltDeep,
  palette.warning,
];

function hashIndex(str: string, mod: number): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h * 31 + str.charCodeAt(i)) >>> 0;
  }
  return h % mod;
}

interface PlaylistRowProps {
  id: string;
  name: string;
  trackCount: number;
  onPress: () => void;
  onMore: () => void;
}

function PlaylistRow({ id, name, trackCount, onPress, onMore }: PlaylistRowProps) {
  const accent = ACCENTS[hashIndex(name || id, ACCENTS.length)]!;
  return (
    <Pressable
      flat
      onPress={onPress}
      onLongPress={onMore}
      delayLongPress={400}
      accessibilityLabel={`${name}, ${trackCount} tracks`}
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
      <View
        style={{
          width: 44,
          height: 44,
          borderRadius: radius.sm,
          backgroundColor: accent,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Ionicons name="albums" size={18} color={palette.inkInverse} />
      </View>
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <Text variant="bodyStrong" numberOfLines={1}>
          {name}
        </Text>
        <Text variant="caption" tone="muted">
          {trackCount} {trackCount === 1 ? "track" : "tracks"}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={palette.inkFaint} />
    </Pressable>
  );
}

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

  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [contextPlaylist, setContextPlaylist] = useState<{
    id: string;
    name: string;
  } | null>(null);

  useEffect(() => {
    if (userId) fetchPlaylists(userId);
  }, [userId]);

  function handleCreate() {
    const name = newName.trim();
    if (!name || !userId) return;
    createPlaylist(userId, name);
    setNewName("");
    setCreateOpen(false);
  }

  function handleRename(p: { id: string; name: string }) {
    setContextPlaylist(null);
    if (Platform.OS === "ios" && (Alert as { prompt?: unknown }).prompt) {
      (Alert as unknown as {
        prompt: (
          t: string,
          m: string | undefined,
          cb: (v: string) => void,
          type: string,
          def: string,
        ) => void;
      }).prompt(
        "Rename Playlist",
        undefined,
        (name: string) => {
          if (name.trim()) renamePlaylist(p.id, name.trim());
        },
        "plain-text",
        p.name,
      );
    } else {
      Alert.alert("Rename", "Use long-press → Rename in the playlist screen.");
    }
  }

  function handleDelete(p: { id: string; name: string }) {
    setContextPlaylist(null);
    Alert.alert("Delete Playlist", `Delete "${p.name}"?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => deletePlaylist(p.id),
      },
    ]);
  }

  const playlistCount = playlists.length;

  const contextActions = useMemo<ActionItem[]>(() => {
    if (!contextPlaylist) return [];
    return [
      {
        icon: "open-outline",
        label: "Open",
        onPress: () => router.push(`/(tabs)/playlists/${contextPlaylist.id}`),
      },
      {
        icon: "create-outline",
        label: "Rename",
        onPress: () => handleRename(contextPlaylist),
      },
      {
        icon: "trash-outline",
        label: "Delete",
        destructive: true,
        onPress: () => handleDelete(contextPlaylist),
      },
    ];
  }, [contextPlaylist]);

  const renderItem = ({
    item,
  }: ListRenderItemInfo<{
    id: string;
    name: string;
    trackCount: number;
  }>) => (
    <PlaylistRow
      id={item.id}
      name={item.name}
      trackCount={item.trackCount}
      onPress={() => router.push(`/(tabs)/playlists/${item.id}`)}
      onMore={() => setContextPlaylist({ id: item.id, name: item.name })}
    />
  );

  return (
    <Screen scroll={false} inset={false}>
      <VStack flex>
        {/* Big-title bar */}
        <HStack
          padX="base"
          align="center"
          justify="between"
          style={{ paddingTop: space.md, paddingBottom: space.md }}
        >
          <Text
            variant="titleLg"
            style={{ fontSize: 30, letterSpacing: -0.6 }}
          >
            Playlists
          </Text>
          <IconButton
            icon={createOpen ? "close-outline" : "add"}
            accessibilityLabel={createOpen ? "Cancel" : "New playlist"}
            size={22}
            onPress={() => {
              setCreateOpen((v) => !v);
              setNewName("");
            }}
          />
        </HStack>

        {/* Inline create input */}
        {createOpen ? (
          <View
            style={{
              paddingHorizontal: space.base,
              paddingBottom: space.md,
            }}
          >
            <HStack gap="sm">
              <View style={{ flex: 1 }}>
                <Input
                  placeholder="Playlist name"
                  value={newName}
                  onChangeText={setNewName}
                  autoFocus
                  onSubmitEditing={handleCreate}
                  returnKeyType="done"
                />
              </View>
              <Button
                label="Create"
                onPress={handleCreate}
                disabled={!newName.trim()}
              />
            </HStack>
          </View>
        ) : null}

        {/* Body */}
        {isLoading ? (
          <VStack flex justify="center" align="center">
            <ActivityIndicator color={palette.ink} size="large" />
          </VStack>
        ) : playlistCount === 0 ? (
          <VStack flex justify="center" align="center" gap="sm" padX="base">
            <Ionicons name="albums-outline" size={48} color={palette.inkFaint} />
            <Text variant="title" align="center">
              No playlists yet
            </Text>
            <Text variant="body" tone="muted" align="center">
              Tap + to create your first one.
            </Text>
          </VStack>
        ) : (
          <FlatList
            data={playlists}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            contentContainerStyle={{ paddingBottom: space["2xl"] }}
            showsVerticalScrollIndicator={false}
          />
        )}
      </VStack>

      <ActionSheet
        visible={contextPlaylist != null}
        onClose={() => setContextPlaylist(null)}
        title={contextPlaylist?.name}
        actions={contextActions}
      />
    </Screen>
  );
}
