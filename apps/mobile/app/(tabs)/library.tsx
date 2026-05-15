import { tracks, userTracks } from "@aani/db";
import type { LibraryTrack, Track } from "@aani/types";
import { useAuth } from "@clerk/clerk-expo";
import { Ionicons } from "@expo/vector-icons";
import { and, eq } from "drizzle-orm";
import * as Crypto from "expo-crypto";
import * as DocumentPicker from "expo-document-picker";
import {
  EncodingType,
  FileSystemUploadType,
  readAsStringAsync,
  uploadAsync,
} from "expo-file-system/legacy";
import { useFocusEffect, useRouter } from "expo-router";
import { memo, useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  ScrollView,
  View,
  type ListRenderItemInfo,
} from "react-native";
import EditTrackModal from "../../components/EditTrackModal";
import PlaylistPickerSheet from "../../components/PlaylistPickerSheet";
import {
  ActionSheet,
  type ActionItem,
  HStack,
  IconButton,
  Input,
  MiniTile,
  PlaylistCard,
  Pressable,
  Screen,
  Text,
  VStack,
  palette,
  radius,
  space,
} from "../../components/ui";
import { getDb } from "../../lib/db";
import { ensureLocalCopy } from "../../lib/localAudio";
import { buildContentKey, getUploadUrl } from "../../lib/r2";
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

const SORT_LABELS: Record<SortOption, string> = {
  date: "Last added",
  title: "Title A → Z",
  bpm: "BPM (slow → fast)",
};

const SORT_OPTIONS: SortOption[] = ["date", "title", "bpm"];

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

function formatDuration(seconds: number | null): string {
  if (seconds == null) return "--:--";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

interface LibraryRowProps {
  track: LibraryTrack;
  onPress: () => void;
  onMore: () => void;
}

const LibraryRow = memo(function LibraryRow({
  track,
  onPress,
  onMore,
}: LibraryRowProps) {
  const bpm = track.originalBpm;
  const duration = track.duration ?? 0;

  return (
    <Pressable
      flat
      onPress={onPress}
      onLongPress={onMore}
      delayLongPress={400}
      accessibilityLabel={`${track.title}${track.artist ? `, ${track.artist}` : ""}`}
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
      <MiniTile title={track.title} size={36} />

      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <Text variant="bodyStrong" numberOfLines={1}>
          {track.artist ? `${track.artist}  ·  ` : ""}
          {track.title}
        </Text>
        {bpm != null || duration > 0 ? (
          <Text variant="caption" tone="muted" numberOfLines={1}>
            {[
              bpm != null ? `${Math.round(bpm)} BPM` : null,
              duration > 0 ? formatDuration(duration) : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
});

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

  const playlistList = usePlaylistsStore((s) => s.playlists);
  const fetchPlaylists = usePlaylistsStore((s) => s.fetchPlaylists);

  const [importing, setImporting] = useState(false);
  const [editingTrack, setEditingTrack] = useState<Track | null>(null);
  const [pickerTrack, setPickerTrack] = useState<{ id: string; title: string } | null>(null);
  const [contextTrack, setContextTrack] = useState<Track | null>(null);
  const [sortSheetOpen, setSortSheetOpen] = useState(false);
  const [moreSheetOpen, setMoreSheetOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState("");

  useFocusEffect(
    useCallback(() => {
      if (userId) {
        fetchTracks(userId);
        fetchPlaylists(userId);
      }
    }, [userId, fetchTracks, fetchPlaylists]),
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
      const contentHash = await sha256OfFile(file.uri);

      const [dupe] = await db
        .select()
        .from(tracks)
        .where(eq(tracks.contentHash, contentHash));

      let track: Track;
      if (dupe) {
        track = dupe as Track;
      } else {
        const fileKey = buildContentKey(contentHash, ext);
        const uploadUrl = await getUploadUrl(fileKey, contentType);

        const uploadResult = await uploadAsync(uploadUrl, file.uri, {
          httpMethod: "PUT",
          headers: { "Content-Type": contentType },
          uploadType: FileSystemUploadType.BINARY_CONTENT,
        });

        if (uploadResult.status < 200 || uploadResult.status >= 300) {
          throw new Error(`Upload failed with status ${uploadResult.status}`);
        }

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
        beatOffset: userTrack.beatOffset ?? null,
      };

      addTrack(libraryTrack);
      ensureLocalCopy(track, userId).catch((e) =>
        console.warn("[localAudio] import cache failed:", e?.message ?? e),
      );
    } catch (err) {
      console.error("[import] error:", err);
      Alert.alert(
        "Import Failed",
        err instanceof Error ? err.message : "Something went wrong",
      );
    } finally {
      setImporting(false);
    }
  }, [userId, addTrack]);

  const filteredTracks = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return trackList;
    return trackList.filter((t) => {
      const title = t.title?.toLowerCase() ?? "";
      const artist = t.artist?.toLowerCase() ?? "";
      return title.includes(q) || artist.includes(q);
    });
  }, [trackList, search]);

  const handleRowPress = useCallback(
    (track: LibraryTrack) => {
      if (!userId) return;
      const idx = filteredTracks.findIndex((t) => t.id === track.id);
      usePlayerStore
        .getState()
        .playWithQueue(filteredTracks, Math.max(0, idx), userId);
    },
    [userId, filteredTracks],
  );

  const handleRowMore = useCallback((track: Track) => {
    setContextTrack(track);
  }, []);

  const sortActions = useMemo<ActionItem[]>(
    () =>
      SORT_OPTIONS.map((opt) => ({
        icon:
          opt === sort
            ? ("checkmark" as const)
            : ("ellipse-outline" as const),
        label: SORT_LABELS[opt],
        onPress: () => setSort(opt),
      })),
    [sort, setSort],
  );

  const moreActions = useMemo<ActionItem[]>(
    () => [
      {
        icon: "add-outline",
        label: importing ? "Importing…" : "Add track",
        onPress: () => {
          if (!importing) handleImport();
        },
      },
    ],
    [importing, handleImport],
  );

  const trackContextActions = useMemo<ActionItem[]>(() => {
    if (!contextTrack || !userId) return [];
    const t = contextTrack;
    return [
      {
        icon: "play-skip-forward",
        label: "Play next",
        onPress: () => usePlayerStore.getState().playNext(t.id, userId),
      },
      {
        icon: "list-outline",
        label: "Add to queue",
        onPress: () => usePlayerStore.getState().addToQueue(t.id, userId),
      },
      {
        icon: "albums-outline",
        label: "Add to playlist",
        onPress: () => setPickerTrack({ id: t.id, title: t.title }),
      },
      {
        icon: "create-outline",
        label: "Edit metadata",
        onPress: () => setEditingTrack(t),
      },
      {
        icon: "trash-outline",
        label: "Delete",
        destructive: true,
        onPress: () =>
          Alert.alert("Delete Track", `Delete "${t.title}"?`, [
            { text: "Cancel", style: "cancel" },
            {
              text: "Delete",
              style: "destructive",
              onPress: () => deleteTrack(t.id),
            },
          ]),
      },
    ];
  }, [contextTrack, userId, deleteTrack]);

  const trackCount = trackList.length;
  const playlistCount = playlistList.length;

  const renderRow = useCallback(
    ({ item }: ListRenderItemInfo<LibraryTrack>) => (
      <LibraryRow
        track={item}
        onPress={() => handleRowPress(item)}
        onMore={() => handleRowMore(item)}
      />
    ),
    [handleRowPress, handleRowMore],
  );

  const keyExtractor = useCallback((item: LibraryTrack) => item.id, []);

  const ListHeader = (
    <View>
      {/* Playlists strip */}
      <View style={{ paddingTop: space.none, paddingBottom: space.md }}>
        {playlistList.length > 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{
              paddingHorizontal: space.base,
              gap: space.sm,
            }}
          >
            {playlistList.map((pl) => (
              <PlaylistCard
                key={pl.id}
                name={pl.name}
                trackCount={pl.trackCount}
                onPress={() => router.push(`/(tabs)/playlists/${pl.id}`)}
              />
            ))}
          </ScrollView>
        ) : (
          <View style={{ paddingHorizontal: space.base }}>
            <Text variant="caption" tone="faint">
              No playlists yet — create one from the Playlists tab.
            </Text>
          </View>
        )}
      </View>

      {/* Sort row */}
      <View
        style={{
          borderBottomWidth: 1,
          borderBottomColor: palette.paperEdge,
        }}
      >
        <HStack
          padX="base"
          padY="sm"
          align="center"
          justify="end"
        >
          <Pressable
            flat
            onPress={() => setSortSheetOpen(true)}
            accessibilityLabel="Change sort"
            accessibilityRole="button"
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
              paddingVertical: 4,
              paddingHorizontal: 8,
              borderRadius: radius.full,
            }}
          >
            <Text variant="caption" tone="muted">
              {SORT_LABELS[sort]}
            </Text>
            <Ionicons name="chevron-down" size={11} color={palette.inkMuted} />
          </Pressable>
        </HStack>
      </View>
    </View>
  );

  return (
    <Screen scroll={false} inset={false}>
      <VStack flex>
        {/* Big-title app bar */}
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
            Library
          </Text>
          <HStack gap="xs">
            <IconButton
              icon={searchOpen ? "close-outline" : "search-outline"}
              accessibilityLabel={searchOpen ? "Close search" : "Search"}
              size={20}
              onPress={() => {
                setSearchOpen((v) => {
                  if (v) setSearch("");
                  return !v;
                });
              }}
            />
            <IconButton
              icon="ellipsis-horizontal"
              accessibilityLabel="More"
              size={20}
              onPress={() => setMoreSheetOpen(true)}
            />
          </HStack>
        </HStack>

        {/* Optional search input */}
        {searchOpen ? (
          <View
            style={{
              paddingHorizontal: space.base,
              paddingBottom: space.md,
            }}
          >
            <Input
              variant="search"
              value={search}
              onChangeText={setSearch}
              placeholder="Search title or artist..."
              autoCorrect={false}
              autoCapitalize="none"
              autoFocus
              returnKeyType="search"
            />
          </View>
        ) : null}

        {/* Body */}
        {isLoading ? (
          <VStack flex justify="center" align="center">
            <ActivityIndicator color={palette.ink} size="large" />
          </VStack>
        ) : trackList.length === 0 ? (
          <VStack flex justify="center" align="center" gap="sm" padX="base">
            <Ionicons
              name="musical-notes-outline"
              size={48}
              color={palette.inkFaint}
            />
            <Text variant="title" align="center">
              No tracks yet
            </Text>
            <Text variant="body" tone="muted" align="center">
              Tap the more menu to import audio files.
            </Text>
          </VStack>
        ) : (
          <FlatList
            data={filteredTracks}
            keyExtractor={keyExtractor}
            renderItem={renderRow}
            ListHeaderComponent={ListHeader}
            ListEmptyComponent={
              <VStack padY="xl" align="center" gap="sm">
                <Ionicons
                  name="search-outline"
                  size={32}
                  color={palette.inkFaint}
                />
                <Text variant="caption" tone="muted">
                  Nothing matches "{search.trim()}"
                </Text>
              </VStack>
            }
            contentContainerStyle={{ paddingBottom: space["2xl"] }}
            showsVerticalScrollIndicator={false}
            initialNumToRender={14}
            maxToRenderPerBatch={10}
            windowSize={9}
          />
        )}
      </VStack>

      <ActionSheet
        visible={sortSheetOpen}
        onClose={() => setSortSheetOpen(false)}
        title="Sort by"
        actions={sortActions}
      />

      <ActionSheet
        visible={moreSheetOpen}
        onClose={() => setMoreSheetOpen(false)}
        actions={moreActions}
      />

      <ActionSheet
        visible={contextTrack != null}
        onClose={() => setContextTrack(null)}
        title={contextTrack?.title}
        subtitle={contextTrack?.artist ?? undefined}
        actions={trackContextActions}
      />

      <EditTrackModal
        track={editingTrack}
        visible={editingTrack != null}
        onClose={() => setEditingTrack(null)}
        onSave={async (data) => {
          if (editingTrack) await updateTrack(editingTrack.id, data);
        }}
      />

      <PlaylistPickerSheet
        visible={pickerTrack != null}
        track={pickerTrack}
        onClose={() => setPickerTrack(null)}
      />
    </Screen>
  );
}
