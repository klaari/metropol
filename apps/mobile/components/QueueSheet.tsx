import { useAuth } from "@clerk/clerk-expo";
import { Ionicons } from "@expo/vector-icons";
import { useCallback } from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import DraggableFlatList, {
  type RenderItemParams,
  ScaleDecorator,
} from "react-native-draggable-flatlist";
import { type QueueItem, usePlayerStore } from "../store/player";

export default function QueueSheet() {
  const { userId } = useAuth();
  const visible = usePlayerStore((s) => s.queueSheetVisible);
  const queue = usePlayerStore((s) => s.queue);
  const currentIndex = usePlayerStore((s) => s.currentIndex);
  const setQueueSheetVisible = usePlayerStore((s) => s.setQueueSheetVisible);
  const skipToIndex = usePlayerStore((s) => s.skipToIndex);
  const removeAt = usePlayerStore((s) => s.removeAt);
  const reorder = usePlayerStore((s) => s.reorder);

  const handleClose = useCallback(() => setQueueSheetVisible(false), [setQueueSheetVisible]);

  const upcoming = currentIndex >= 0 ? queue.slice(currentIndex + 1) : queue;
  const upcomingOffset = currentIndex >= 0 ? currentIndex + 1 : 0;
  const nowPlaying = currentIndex >= 0 ? queue[currentIndex] : null;

  const renderItem = useCallback(
    ({ item, drag, isActive, getIndex }: RenderItemParams<QueueItem>) => {
      const localIdx = getIndex() ?? 0;
      const queueIdx = upcomingOffset + localIdx;
      return (
        <ScaleDecorator>
          <Pressable
            onPress={() => {
              if (!userId) return;
              skipToIndex(queueIdx, userId);
              handleClose();
            }}
            onLongPress={drag}
            delayLongPress={200}
            disabled={isActive}
            style={[styles.row, isActive && styles.rowActive]}
            android_ripple={{ color: "rgba(255,255,255,0.06)" }}
          >
            <Ionicons name="reorder-three" size={22} color="#555" style={styles.dragIcon} />
            <View style={styles.info}>
              <Text style={styles.title} numberOfLines={1}>{item.track.title}</Text>
              {item.track.artist ? (
                <Text style={styles.artist} numberOfLines={1}>{item.track.artist}</Text>
              ) : null}
            </View>
            <Pressable
              hitSlop={10}
              onPress={() => userId && removeAt(queueIdx, userId)}
              style={styles.removeBtn}
            >
              <Ionicons name="close" size={20} color="#666" />
            </Pressable>
          </Pressable>
        </ScaleDecorator>
      );
    },
    [userId, skipToIndex, removeAt, upcomingOffset, handleClose],
  );

  const handleDragEnd = useCallback(
    ({ from, to }: { from: number; to: number }) => {
      if (!userId || from === to) return;
      reorder(upcomingOffset + from, upcomingOffset + to, userId);
    },
    [userId, reorder, upcomingOffset],
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={handleClose}
    >
      <Pressable style={styles.backdrop} onPress={handleClose} />
      <View style={styles.sheet}>
        <View style={styles.handle} />
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Queue</Text>
          <Pressable onPress={handleClose} hitSlop={10}>
            <Ionicons name="close" size={24} color="#fff" />
          </Pressable>
        </View>

        {nowPlaying ? (
          <>
            <Text style={styles.sectionLabel}>Now playing</Text>
            <View style={[styles.row, styles.nowPlaying]}>
              <Ionicons name="musical-notes" size={20} color="#fff" style={styles.dragIcon} />
              <View style={styles.info}>
                <Text style={styles.title} numberOfLines={1}>{nowPlaying.track.title}</Text>
                {nowPlaying.track.artist ? (
                  <Text style={styles.artist} numberOfLines={1}>{nowPlaying.track.artist}</Text>
                ) : null}
              </View>
            </View>
          </>
        ) : null}

        <Text style={styles.sectionLabel}>
          {upcoming.length > 0
            ? `Next up · ${upcoming.length}`
            : nowPlaying
              ? "Nothing else queued"
              : "Queue is empty"}
        </Text>

        {upcoming.length > 0 ? (
          <DraggableFlatList
            data={upcoming}
            keyExtractor={(item, i) => `${item.trackId}-${i}`}
            renderItem={renderItem}
            onDragEnd={handleDragEnd}
            contentContainerStyle={{ paddingBottom: 40 }}
          />
        ) : null}
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
    maxHeight: "80%",
    minHeight: "50%",
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
    paddingVertical: 8,
  },
  headerTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
  },
  sectionLabel: {
    color: "#666",
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    paddingHorizontal: 4,
    paddingTop: 12,
    paddingBottom: 6,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 8,
    gap: 10,
  },
  rowActive: {
    backgroundColor: "#1a1a1a",
  },
  nowPlaying: {
    backgroundColor: "#181818",
  },
  dragIcon: {
    width: 24,
  },
  info: {
    flex: 1,
    gap: 2,
  },
  title: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "500",
  },
  artist: {
    color: "#888",
    fontSize: 12,
  },
  removeBtn: {
    width: 32,
    height: 32,
    justifyContent: "center",
    alignItems: "center",
  },
});
