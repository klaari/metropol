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
import { Ionicons } from "@expo/vector-icons";
import { useCallback, useMemo, useState } from "react";
import {
  ActionSheetIOS,
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Platform,
  SectionList,
  View,
} from "react-native";
import EditTrackModal from "../../components/EditTrackModal";
import TrackItem from "../../components/TrackItem";
import {
  AppBar,
  Button,
  Divider,
  HStack,
  IconButton,
  Input,
  Pressable,
  Screen,
  Surface,
  Text,
  VStack,
  palette,
  space,
} from "../../components/ui";
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
  const [search, setSearch] = useState("");

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

  const filteredTracks = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return trackList;
    return trackList.filter((t) => {
      const title = t.title?.toLowerCase() ?? "";
      const artist = t.artist?.toLowerCase() ?? "";
      return title.includes(q) || artist.includes(q);
    });
  }, [trackList, search]);

  const sections = useMemo(() => {
    if (sort !== "date") return [{ title: "", data: filteredTracks }];
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(today.getTime() - 7 * 86400000);

    const groups: Record<string, LibraryTrack[]> = {};
    const order: string[] = [];
    for (const track of filteredTracks) {
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
  }, [filteredTracks, sort]);

  const trackCount = trackList.length;
  const trackCountLabel = trackCount === 1 ? "1 track" : `${trackCount} tracks`;
  const isSearching = search.trim().length > 0;

  const footer = (
    <Surface tone="raised" rounded="none" pad="md" bordered>
      <Button
        label={importing ? "Importing" : "Add track"}
        onPress={handleImport}
        disabled={importing}
        block
        leading={
          importing ? (
            <ActivityIndicator color={palette.inkInverse} />
          ) : (
            <Ionicons name="add" size={20} color={palette.inkInverse} />
          )
        }
      />
    </Surface>
  );

  return (
    <Screen scroll={false} footer={footer}>
      <VStack flex gap="lg">
        <VStack gap="xs">
          <Text variant="eyebrow" tone="muted">
            Your library
          </Text>
          <HStack justify="between" align="center">
            <Text variant="titleLg">
              {trackCount > 0 ? trackCountLabel : "Library"}
            </Text>
            {trackList.length > 0 ? (
              <Button
                label={SORT_LABELS[sort]}
                variant="secondary"
                size="sm"
                onPress={showSortPicker}
                leading={
                  <Ionicons name="swap-vertical" size={14} color={palette.ink} />
                }
              />
            ) : null}
          </HStack>
        </VStack>

        {trackList.length > 0 ? (
          <Input
            variant="search"
            value={search}
            onChangeText={setSearch}
            placeholder="Search title or artist..."
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
            clearButtonMode="while-editing"
          />
        ) : null}

        {isLoading ? (
          <VStack flex justify="center" align="center">
            <ActivityIndicator color={palette.ink} size="large" />
          </VStack>
        ) : trackList.length === 0 ? (
          <VStack flex justify="center" align="center" gap="sm">
            <Ionicons
              name="musical-notes-outline"
              size={48}
              color={palette.inkFaint}
            />
            <Text variant="title" align="center">
              No tracks yet
            </Text>
            <Text variant="body" tone="muted" align="center">
              Tap Add track to import audio files
            </Text>
          </VStack>
        ) : filteredTracks.length === 0 ? (
          <VStack flex justify="center" align="center" gap="sm">
            <Ionicons
              name="search-outline"
              size={40}
              color={palette.inkFaint}
            />
            <Text variant="title" align="center">
              No matches
            </Text>
            <Text variant="body" tone="muted" align="center">
              Nothing matches "{search.trim()}"
            </Text>
          </VStack>
        ) : (
          <SectionList
            sections={sections}
            keyExtractor={(item) => item.id}
            renderSectionHeader={({ section: { title } }) =>
              title ? (
                <View style={{ paddingTop: space.lg, paddingBottom: space.sm }}>
                  <Text variant="eyebrow" tone="muted">
                    {title}
                  </Text>
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
            ItemSeparatorComponent={() => <Divider indent={64} inset="none" />}
            contentContainerStyle={{ paddingBottom: space.xl }}
            stickySectionHeadersEnabled={false}
            showsVerticalScrollIndicator={false}
          />
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
        <Screen scroll={false}>
          <VStack flex gap="lg">
            <AppBar
              title="Add to Playlist"
              onBack={() => setPlaylistPickerTrack(null)}
            />

            <HStack gap="sm">
              <View style={{ flex: 1 }}>
                <Input
                  value={newPlaylistName}
                  onChangeText={setNewPlaylistName}
                  placeholder="New playlist name..."
                  returnKeyType="done"
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

            <FlatList
              data={playlistList}
              keyExtractor={(item) => item.id}
              ListEmptyComponent={
                <VStack padY="xl" align="center">
                  <Text variant="body" tone="muted">
                    No playlists yet
                  </Text>
                </VStack>
              }
              renderItem={({ item }) => (
                <Pressable
                  flat
                  onPress={() => handlePickPlaylist(item.id, item.name)}
                  android_ripple={{ color: palette.paperSunken }}
                >
                  <HStack justify="between" padY="md">
                    <Text variant="bodyStrong">{item.name}</Text>
                    <Text variant="caption" tone="muted">
                      {item.trackCount}{" "}
                      {item.trackCount === 1 ? "track" : "tracks"}
                    </Text>
                  </HStack>
                </Pressable>
              )}
              ItemSeparatorComponent={() => <Divider inset="none" />}
              showsVerticalScrollIndicator={false}
            />
          </VStack>
        </Screen>
      </Modal>
      </VStack>
    </Screen>
  );
}
