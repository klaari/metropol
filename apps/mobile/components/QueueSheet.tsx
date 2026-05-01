import { useAuth } from "@clerk/clerk-expo";
import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useRef, useState } from "react";
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
import DraggableFlatList, {
  type RenderItemParams,
  ScaleDecorator,
} from "react-native-draggable-flatlist";
import {
  GestureHandlerRootView,
  Swipeable,
  TouchableOpacity,
} from "react-native-gesture-handler";
import { getTrackPlayer } from "../lib/trackPlayer";
import { type QueueItem, usePlayerStore } from "../store/player";
import { usePlaylistsStore } from "../store/playlists";

export default function QueueSheet() {
  const { userId } = useAuth();
  const visible = usePlayerStore((s) => s.queueSheetVisible);
  const queue = usePlayerStore((s) => s.queue);
  const currentIndex = usePlayerStore((s) => s.currentIndex);
  const playing = usePlayerStore((s) => s.playing);
  const setQueueSheetVisible = usePlayerStore((s) => s.setQueueSheetVisible);
  const skipToIndex = usePlayerStore((s) => s.skipToIndex);
  const removeAt = usePlayerStore((s) => s.removeAt);
  const reorder = usePlayerStore((s) => s.reorder);

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

  const listRef = useRef<any>(null);
  const swipeableRefs = useRef<Map<string, Swipeable>>(new Map());
  const [pickerTrack, setPickerTrack] = useState<{ id: string; title: string } | null>(null);

  const handleClose = useCallback(() => setQueueSheetVisible(false), [setQueueSheetVisible]);

  useEffect(() => {
    if (!visible) return;
    if (userId) fetchPlaylists(userId);
    const idx = usePlayerStore.getState().currentIndex;
    if (idx < 0) return;
    const t = setTimeout(() => {
      const ROW_HEIGHT_ESTIMATE = 62;
      const offset = Math.max(0, idx * ROW_HEIGHT_ESTIMATE - ROW_HEIGHT_ESTIMATE * 2);
      try {
        listRef.current?.scrollToOffset?.({ offset, animated: false });
      } catch {
        // ignore
      }
    }, 50);
    return () => clearTimeout(t);
  }, [visible, userId, fetchPlaylists]);

  const togglePlayPause = useCallback(async () => {
    const tp = getTrackPlayer();
    if (!tp) return;
    try {
      if (playing) await tp.pause();
      else await tp.play();
    } catch {
      // ignore
    }
  }, [playing]);

  const showRowMenu = useCallback(
    (trackId: string, title: string, idx: number, isCurrent: boolean) => {
      const buttons = [
        {
          text: "Add to playlist",
          onPress: () => setPickerTrack({ id: trackId, title }),
        },
        {
          text: isCurrent ? "Remove (skips to next)" : "Remove from queue",
          style: "destructive" as const,
          onPress: () => userId && removeAt(idx, userId),
        },
        { text: "Cancel", style: "cancel" as const },
      ];
      Alert.alert(title, undefined, buttons);
    },
    [userId, removeAt],
  );

  const renderRightActions = useCallback(
    () => (
      <View style={styles.swipeRemove}>
        <Ionicons name="trash" size={22} color="#fff" />
        <Text style={styles.swipeRemoveText}>Remove</Text>
      </View>
    ),
    [],
  );

  const renderItem = useCallback(
    ({ item, drag, isActive, getIndex }: RenderItemParams<QueueItem>) => {
      const idx = getIndex() ?? 0;
      const isCurrent = idx === currentIndex;
      const isPast = idx < currentIndex;
      const swipeKey = `${item.trackId}-${idx}`;

      const rowContent = (
        <View
          style={[
            styles.row,
            isCurrent && styles.rowCurrent,
            isActive && styles.rowActive,
            isPast && styles.rowPast,
          ]}
        >
          <View style={styles.iconSlot}>
            {isCurrent ? (
              <Pressable
                onPress={togglePlayPause}
                disabled={isActive}
                style={styles.iconHit}
                hitSlop={6}
              >
                <Ionicons name={playing ? "pause" : "play"} size={22} color="#fff" />
              </Pressable>
            ) : (
              <TouchableOpacity
                onLongPress={drag}
                delayLongPress={150}
                disabled={isActive}
                style={styles.iconHit}
                activeOpacity={0.5}
              >
                <Ionicons name="reorder-three" size={22} color={isPast ? "#444" : "#888"} />
              </TouchableOpacity>
            )}
          </View>

          <Pressable
            style={styles.info}
            onPress={() => {
              if (!userId || isCurrent) return;
              skipToIndex(idx, userId);
            }}
            disabled={isActive}
          >
            <Text style={[styles.title, isPast && styles.titlePast]} numberOfLines={1}>
              {item.track.title}
            </Text>
            {item.track.artist ? (
              <Text style={[styles.artist, isPast && styles.artistPast]} numberOfLines={1}>
                {item.track.artist}
              </Text>
            ) : null}
          </Pressable>

          <View style={styles.iconSlot}>
            <Pressable
              hitSlop={10}
              onPress={() => showRowMenu(item.trackId, item.track.title, idx, isCurrent)}
              disabled={isActive}
              style={styles.iconHit}
            >
              <Ionicons name="ellipsis-vertical" size={20} color="#888" />
            </Pressable>
          </View>
        </View>
      );

      if (isCurrent) {
        return <ScaleDecorator>{rowContent}</ScaleDecorator>;
      }

      return (
        <ScaleDecorator>
          <Swipeable
            ref={(ref) => {
              if (ref) swipeableRefs.current.set(swipeKey, ref);
              else swipeableRefs.current.delete(swipeKey);
            }}
            renderRightActions={renderRightActions}
            onSwipeableOpen={() => {
              if (userId) removeAt(idx, userId);
              swipeableRefs.current.get(swipeKey)?.close();
            }}
            rightThreshold={50}
            overshootRight={false}
          >
            {rowContent}
          </Swipeable>
        </ScaleDecorator>
      );
    },
    [userId, skipToIndex, removeAt, currentIndex, playing, togglePlayPause, renderRightActions, showRowMenu],
  );

  const handleDragEnd = useCallback(
    ({ from, to }: { from: number; to: number }) => {
      if (!userId || from === to) return;
      reorder(from, to, userId);
    },
    [userId, reorder],
  );

  const playedCount = Math.max(0, currentIndex);
  const upcomingCount = currentIndex >= 0 ? queue.length - currentIndex - 1 : queue.length;
  const summary =
    queue.length === 0
      ? "Queue is empty"
      : `${playedCount} played · ${upcomingCount} upcoming`;

  function closePicker() {
    setPickerTrack(null);
    setNewPlaylistName("");
    setShowCreateInput(false);
  }

  async function handlePickPlaylist(playlistId: string, playlistName: string) {
    if (!pickerTrack) return;
    const track = pickerTrack;
    closePicker();
    try {
      const added = await addTracksToPlaylist(playlistId, [track.id]);
      const msg =
        added > 0
          ? `Added to ${playlistName}`
          : `Already in ${playlistName}`;
      if (Platform.OS === "android") {
        ToastAndroid.show(msg, ToastAndroid.SHORT);
      }
    } catch (e: any) {
      Alert.alert("Couldn't add to playlist", e?.message ?? "Unknown error");
    }
  }

  async function handleCreateAndAdd() {
    const name = newPlaylistName.trim();
    if (!name || !userId || !pickerTrack) return;
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

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={handleClose}
    >
      <GestureHandlerRootView style={{ flex: 1 }}>
        <Pressable style={styles.backdrop} onPress={handleClose} />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <View>
              <Text style={styles.headerTitle}>Queue</Text>
              <Text style={styles.headerSubtitle}>{summary}</Text>
            </View>
            <Pressable onPress={handleClose} hitSlop={10}>
              <Ionicons name="close" size={24} color="#fff" />
            </Pressable>
          </View>

          {queue.length > 0 ? (
            <DraggableFlatList
              ref={listRef}
              data={queue}
              keyExtractor={(item, i) => `${item.trackId}-${i}`}
              renderItem={renderItem}
              onDragEnd={handleDragEnd}
              contentContainerStyle={{ paddingBottom: 40, paddingTop: 4 }}
              activationDistance={8}
            />
          ) : (
            <Text style={styles.emptyText}>Tracks you play will appear here</Text>
          )}
        </View>

        <Modal
          visible={pickerTrack != null}
          animationType="fade"
          transparent
          onRequestClose={closePicker}
        >
          <Pressable style={styles.backdrop} onPress={closePicker} />
          <View style={[styles.pickerSheet, { bottom: kbHeight }]}>
            <View style={styles.handle} />
            <View style={styles.header}>
              <Text style={styles.headerTitle}>Add to playlist</Text>
              <Pressable onPress={closePicker} hitSlop={10}>
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
                  style={styles.pickerRow}
                  onPress={() => handlePickPlaylist(pl.id, pl.name)}
                  android_ripple={{ color: "rgba(255,255,255,0.06)" }}
                >
                  <Text style={styles.pickerRowText}>{pl.name}</Text>
                  <Text style={styles.pickerRowCount}>
                    {pl.trackCount} {pl.trackCount === 1 ? "track" : "tracks"}
                  </Text>
                </Pressable>
              )}
            />
          </View>
        </Modal>
      </GestureHandlerRootView>
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
    maxHeight: "85%",
    minHeight: "55%",
  },
  pickerSheet: {
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
  headerSubtitle: {
    color: "#666",
    fontSize: 12,
    marginTop: 2,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderRadius: 8,
    gap: 8,
    backgroundColor: "#0a0a0a",
  },
  rowActive: {
    backgroundColor: "#222",
  },
  rowCurrent: {
    backgroundColor: "#181818",
  },
  rowPast: {
    opacity: 0.55,
  },
  iconSlot: {
    width: 36,
    height: 36,
    justifyContent: "center",
    alignItems: "center",
  },
  iconHit: {
    width: 36,
    height: 36,
    justifyContent: "center",
    alignItems: "center",
  },
  info: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  title: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "500",
  },
  titlePast: {
    color: "#999",
  },
  artist: {
    color: "#888",
    fontSize: 12,
  },
  artistPast: {
    color: "#666",
  },
  swipeRemove: {
    backgroundColor: "#b3261e",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    gap: 6,
    borderRadius: 8,
    marginVertical: 1,
  },
  swipeRemoveText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  pickerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#1a1a1a",
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
  pickerRowText: {
    color: "#fff",
    fontSize: 16,
  },
  pickerRowCount: {
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
