import { useAuth } from "@clerk/clerk-expo";
import { Ionicons } from "@expo/vector-icons";
import { memo, useCallback, useEffect, useRef, useState } from "react";
import { Alert, Modal, View } from "react-native";
import DraggableFlatList, {
  ScaleDecorator,
  type RenderItemParams,
} from "react-native-draggable-flatlist";
import {
  GestureHandlerRootView,
  Swipeable,
  TouchableOpacity,
} from "react-native-gesture-handler";
import { type QueueItem, usePlayerStore } from "../store/player";
import PlaylistPickerSheet from "./PlaylistPickerSheet";
import {
  HStack,
  IconButton,
  Pressable,
  Surface,
  Text,
  VStack,
  palette,
  radius,
  space,
} from "./ui";

interface QueueRowProps {
  item: QueueItem;
  idx: number;
  drag: () => void;
  isActive: boolean;
  renderRightActions: () => React.ReactElement;
  onPress: (idx: number) => void;
  onMenu: (trackId: string, title: string, idx: number, isCurrent: boolean) => void;
  onSwipeRemove: (idx: number) => void;
  onTogglePlayPause: () => void;
}

const QueueRow = memo(function QueueRow({
  item,
  idx,
  drag,
  isActive,
  renderRightActions,
  onPress,
  onMenu,
  onSwipeRemove,
  onTogglePlayPause,
}: QueueRowProps) {
  const isCurrent = usePlayerStore((s) => s.currentIndex === idx);
  const isPast = usePlayerStore((s) => idx < s.currentIndex);
  const playing = usePlayerStore((s) => (s.currentIndex === idx ? s.playing : false));
  const swipeRef = useRef<Swipeable | null>(null);

  const rowContent = (
    <View
      style={{
        borderRadius: radius.md,
        backgroundColor: isActive
          ? palette.paperSunken
          : isCurrent
            ? palette.paperRaised
            : palette.transparent,
        opacity: isPast ? 0.55 : 1,
      }}
    >
      <HStack gap="sm" padX="sm" padY="sm">
        <View style={{ width: 36, alignItems: "center" }}>
          {isCurrent ? (
            <IconButton
              icon={playing ? "pause" : "play"}
              accessibilityLabel={playing ? "Pause" : "Play"}
              onPress={onTogglePlayPause}
              disabled={isActive}
              size={22}
            />
          ) : (
            <TouchableOpacity
              onLongPress={drag}
              delayLongPress={150}
              disabled={isActive}
              style={{
                width: 36,
                height: 36,
                justifyContent: "center",
                alignItems: "center",
              }}
              activeOpacity={0.5}
            >
              <Ionicons
                name="reorder-three"
                size={22}
                color={isPast ? palette.inkFaint : palette.inkMuted}
              />
            </TouchableOpacity>
          )}
        </View>

        <Pressable
          flat
          style={{ flex: 1 }}
          onPress={() => {
            if (isCurrent) return;
            onPress(idx);
          }}
          disabled={isActive}
        >
          <VStack gap="xs">
            <Text
              variant="bodyStrong"
              tone={isPast ? "muted" : "primary"}
              numberOfLines={1}
            >
              {item.track.title}
            </Text>
            {item.track.artist ? (
              <Text
                variant="caption"
                tone={isPast ? "faint" : "muted"}
                numberOfLines={1}
              >
                {item.track.artist}
              </Text>
            ) : null}
          </VStack>
        </Pressable>

        <IconButton
          icon="ellipsis-vertical"
          accessibilityLabel="Queue row options"
          onPress={() => onMenu(item.trackId, item.track.title, idx, isCurrent)}
          disabled={isActive}
          color={palette.inkMuted}
          size={20}
        />
      </HStack>
    </View>
  );

  if (isCurrent) {
    return <ScaleDecorator>{rowContent}</ScaleDecorator>;
  }

  return (
    <ScaleDecorator>
      <Swipeable
        ref={swipeRef}
        renderRightActions={renderRightActions}
        onSwipeableOpen={() => {
          onSwipeRemove(idx);
          swipeRef.current?.close();
        }}
        rightThreshold={50}
        overshootRight={false}
      >
        {rowContent}
      </Swipeable>
    </ScaleDecorator>
  );
});

export default function QueueSheet() {
  const { userId } = useAuth();
  const visible = usePlayerStore((s) => s.queueSheetVisible);
  const queue = usePlayerStore((s) => s.queue);
  const currentIndex = usePlayerStore((s) => s.currentIndex);
  const setQueueSheetVisible = usePlayerStore((s) => s.setQueueSheetVisible);
  const skipToIndex = usePlayerStore((s) => s.skipToIndex);
  const removeAt = usePlayerStore((s) => s.removeAt);
  const reorder = usePlayerStore((s) => s.reorder);

  const listRef = useRef<any>(null);
  const [pickerTrack, setPickerTrack] = useState<{ id: string; title: string } | null>(null);

  const handleClose = useCallback(() => setQueueSheetVisible(false), [setQueueSheetVisible]);

  useEffect(() => {
    if (!visible) return;
    const idx = usePlayerStore.getState().currentIndex;
    if (idx < 0) return;
    const t = setTimeout(() => {
      const rowHeightEstimate = 62;
      const offset = Math.max(0, idx * rowHeightEstimate - rowHeightEstimate * 2);
      try {
        listRef.current?.scrollToOffset?.({ offset, animated: false });
      } catch {
        // Ignore scroll failures while the list is mounting.
      }
    }, 50);
    return () => clearTimeout(t);
  }, [visible]);

  const togglePlayPause = usePlayerStore((s) => s.togglePlayPause);

  const showRowMenu = useCallback(
    (trackId: string, title: string, idx: number, isCurrent: boolean) => {
      Alert.alert(title, undefined, [
        {
          text: "Add to playlist",
          onPress: () => setPickerTrack({ id: trackId, title }),
        },
        {
          text: isCurrent ? "Remove (skips to next)" : "Remove from queue",
          style: "destructive",
          onPress: () => userId && removeAt(idx, userId),
        },
        { text: "Cancel", style: "cancel" },
      ]);
    },
    [userId, removeAt],
  );

  const renderRightActions = useCallback(
    () => (
      <View
        style={{
          backgroundColor: palette.critical,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          paddingHorizontal: space.lg,
          gap: space.sm,
          borderRadius: radius.md,
          marginVertical: space.hair,
        }}
      >
        <Ionicons name="trash" size={22} color={palette.inkInverse} />
        <Text variant="bodyStrong" tone="inverse">
          Remove
        </Text>
      </View>
    ),
    [],
  );

  const handleRowPress = useCallback(
    (idx: number) => {
      if (!userId) return;
      skipToIndex(idx, userId);
    },
    [userId, skipToIndex],
  );

  const handleSwipeRemove = useCallback(
    (idx: number) => {
      if (!userId) return;
      removeAt(idx, userId);
    },
    [userId, removeAt],
  );

  const renderItem = useCallback(
    ({ item, drag, isActive, getIndex }: RenderItemParams<QueueItem>) => (
      <QueueRow
        item={item}
        idx={getIndex() ?? 0}
        drag={drag}
        isActive={isActive}
        renderRightActions={renderRightActions}
        onPress={handleRowPress}
        onMenu={showRowMenu}
        onSwipeRemove={handleSwipeRemove}
        onTogglePlayPause={togglePlayPause}
      />
    ),
    [renderRightActions, handleRowPress, showRowMenu, handleSwipeRemove, togglePlayPause],
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

  const closePicker = useCallback(() => setPickerTrack(null), []);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={handleClose}
    >
      <GestureHandlerRootView style={{ flex: 1 }}>
        <Pressable
          flat
          style={{ flex: 1, backgroundColor: "rgba(22,19,14,0.45)" }}
          onPress={handleClose}
        />
        <Surface
          tone="raised"
          lift="sheet"
          rounded="xl"
          pad="md"
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            maxHeight: "85%",
            minHeight: "55%",
          }}
        >
          <VStack gap="md" flex>
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
              <VStack gap="xs">
                <Text variant="title">Queue</Text>
                <Text variant="caption" tone="muted">
                  {summary}
                </Text>
              </VStack>
              <IconButton
                icon="close"
                accessibilityLabel="Close queue"
                onPress={handleClose}
              />
            </HStack>

            {queue.length > 0 ? (
              <DraggableFlatList
                ref={listRef}
                data={queue}
                keyExtractor={(item, i) => `${item.trackId}-${i}`}
                renderItem={renderItem}
                onDragEnd={handleDragEnd}
                contentContainerStyle={{ paddingBottom: space.xl, paddingTop: space.xs }}
                activationDistance={8}
              />
            ) : (
              <VStack padY="xl" align="center">
                <Text variant="caption" tone="muted">
                  Tracks you play will appear here
                </Text>
              </VStack>
            )}
          </VStack>
        </Surface>
      </GestureHandlerRootView>
      <PlaylistPickerSheet
        visible={pickerTrack != null}
        track={pickerTrack}
        onClose={closePicker}
      />
    </Modal>
  );
}
