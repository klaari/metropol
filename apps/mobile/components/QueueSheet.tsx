import { useAuth } from "@clerk/clerk-expo";
import { memo, useCallback, useMemo, useState } from "react";
import {
  FlatList,
  type ListRenderItemInfo,
  Modal,
  Pressable as RNPressable,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { type QueueItem, usePlayerStore } from "../store/player";
import PlaylistPickerSheet from "./PlaylistPickerSheet";
import {
  ActionSheet,
  type ActionItem,
  HStack,
  IconButton,
  MiniTile,
  Pressable,
  Text,
  VStack,
  palette,
  radius,
  space,
} from "./ui";

type RowState = "playing" | "queued" | "history";

const LONG_PRESS_MS = 480;

function formatTime(secs: number | null | undefined): string {
  const safe = Math.max(0, Math.round(secs ?? 0));
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function totalDuration(items: QueueItem[]): number {
  return items.reduce((acc, it) => acc + (it.track.duration ?? 0), 0);
}

interface QueueRowProps {
  item: QueueItem;
  idx: number;
  state: RowState;
  onTap: (idx: number, isCurrent: boolean) => void;
  onLongPress: (item: QueueItem, idx: number) => void;
  // Only meaningful when state === "playing".
  playing?: boolean;
  onTogglePlayPause?: () => void;
}

const QueueRow = memo(function QueueRow({
  item,
  idx,
  state,
  onTap,
  onLongPress,
  playing,
  onTogglePlayPause,
}: QueueRowProps) {
  const isPlaying = state === "playing";
  const isHistory = state === "history";
  const titleColor = isPlaying
    ? palette.cobalt
    : isHistory
      ? palette.inkMuted
      : palette.ink;
  const subColor = isHistory ? palette.inkFaint : palette.inkMuted;

  const bpm = item.track.originalBpm;
  const duration = item.track.duration ?? 0;

  return (
    <Pressable
      onPress={() => onTap(idx, isPlaying)}
      onLongPress={() => onLongPress(item, idx)}
      delayLongPress={LONG_PRESS_MS}
      accessibilityLabel={`${item.track.title}${item.track.artist ? `, ${item.track.artist}` : ""}`}
      accessibilityRole="button"
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: space.md,
        paddingVertical: space.md,
        paddingHorizontal: space.base,
        backgroundColor: isPlaying ? "rgba(74,85,160,0.06)" : palette.transparent,
        position: "relative",
      }}
    >
      {isPlaying ? (
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            bottom: 0,
            width: 2,
            backgroundColor: palette.cobalt,
          }}
        />
      ) : null}
      <MiniTile title={item.track.title} size={36} />

      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <Text
          variant="bodyStrong"
          numberOfLines={1}
          style={{
            color: titleColor,
            fontWeight: isPlaying ? "700" : "600",
          }}
        >
          {item.track.artist ? `${item.track.artist}  ·  ` : ""}
          {item.track.title}
        </Text>
        {bpm != null || duration > 0 ? (
          <Text
            variant="caption"
            numberOfLines={1}
            style={{ color: subColor }}
          >
            {[
              bpm != null ? `${Math.round(bpm)} BPM` : null,
              duration > 0 ? formatTime(duration) : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </Text>
        ) : null}
      </View>

      {isPlaying && onTogglePlayPause ? (
        <IconButton
          icon={playing ? "pause" : "play"}
          size={20}
          color={palette.cobalt}
          accessibilityLabel={playing ? "Pause" : "Play"}
          onPress={onTogglePlayPause}
        />
      ) : null}
    </Pressable>
  );
});

interface SectionHeaderProps {
  label: string;
  meta?: string;
}

const SectionHeader = memo(function SectionHeader({
  label,
  meta,
}: SectionHeaderProps) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "baseline",
        justifyContent: "space-between",
        paddingTop: space.xs,
        paddingBottom: space.none,
        paddingHorizontal: space.base,
        gap: space.sm,
      }}
    >
      <View
        style={{ flexDirection: "row", alignItems: "baseline", gap: space.sm }}
      >
        <Text variant="eyebrow">{label}</Text>
        {meta ? (
          <Text variant="numeric" tone="muted" style={{ fontSize: 11 }}>
            {meta}
          </Text>
        ) : null}
      </View>
    </View>
  );
});

// Heterogeneous FlatList entries — sections + rows + spacers in one stream
// so the list can virtualise the whole tail (Up Next + Recently Played).
type ListEntry =
  | { kind: "header"; key: string; label: string; meta: string }
  | { kind: "spacer"; key: string; height: number }
  | { kind: "row"; key: string; item: QueueItem; idx: number; state: RowState };

function NowPlayingHeader() {
  // Re-renders ~5×/s while playing, isolated from the FlatList so the
  // virtualised list below it doesn't rebuild on every position tick.
  const position = usePlayerStore((s) => s.position);
  const duration = usePlayerStore((s) => s.duration);
  return (
    <SectionHeader
      label="Now Playing"
      meta={`${formatTime(position)} / ${formatTime(duration)}`}
    />
  );
}

export default function QueueSheet() {
  const { userId } = useAuth();
  const visible = usePlayerStore((s) => s.queueSheetVisible);
  const queue = usePlayerStore((s) => s.queue);
  const currentIndex = usePlayerStore((s) => s.currentIndex);
  const playing = usePlayerStore((s) => s.playing);
  const setQueueSheetVisible = usePlayerStore((s) => s.setQueueSheetVisible);
  const skipToIndex = usePlayerStore((s) => s.skipToIndex);
  const removeAt = usePlayerStore((s) => s.removeAt);
  const playNext = usePlayerStore((s) => s.playNext);
  const togglePlayPause = usePlayerStore((s) => s.togglePlayPause);

  const [contextTrack, setContextTrack] = useState<{
    trackId: string;
    title: string;
    artist: string | null;
    queueIndex: number;
  } | null>(null);
  const [pickerTrack, setPickerTrack] = useState<{ id: string; title: string } | null>(null);

  const handleClose = useCallback(
    () => setQueueSheetVisible(false),
    [setQueueSheetVisible],
  );

  const sections = useMemo(() => {
    if (currentIndex < 0) {
      return {
        history: [] as Array<{ item: QueueItem; idx: number }>,
        nowPlaying: null as { item: QueueItem; idx: number } | null,
        upNext: queue.map((item, idx) => ({ item, idx })),
      };
    }
    const history = queue
      .slice(0, currentIndex)
      .map((item, i) => ({ item, idx: i }));
    const nowPlaying = queue[currentIndex]
      ? { item: queue[currentIndex]!, idx: currentIndex }
      : null;
    const upNext = queue
      .slice(currentIndex + 1)
      .map((item, i) => ({ item, idx: currentIndex + 1 + i }));
    return { history, nowPlaying, upNext };
  }, [queue, currentIndex]);

  const listData = useMemo<ListEntry[]>(() => {
    const out: ListEntry[] = [];
    if (sections.upNext.length > 0) {
      out.push({
        kind: "header",
        key: "upNext-header",
        label: "Up Next",
        meta: `${sections.upNext.length} tracks · ${formatTime(totalDuration(sections.upNext.map((s) => s.item)))}`,
      });
      for (const e of sections.upNext) {
        out.push({
          kind: "row",
          key: `q-${e.item.trackId}-${e.idx}`,
          item: e.item,
          idx: e.idx,
          state: "queued",
        });
      }
    }
    if (sections.history.length > 0) {
      out.push({ kind: "spacer", key: "history-spacer", height: space.sm });
      out.push({
        kind: "header",
        key: "history-header",
        label: "Recently Played",
        meta: `${sections.history.length} tracks`,
      });
      for (const e of sections.history) {
        out.push({
          kind: "row",
          key: `h-${e.item.trackId}-${e.idx}`,
          item: e.item,
          idx: e.idx,
          state: "history",
        });
      }
    }
    return out;
  }, [sections]);

  const handleTap = useCallback(
    (idx: number, isCurrent: boolean) => {
      if (!userId) return;
      if (isCurrent) {
        handleClose();
        return;
      }
      skipToIndex(idx, userId);
      handleClose();
    },
    [userId, skipToIndex, handleClose],
  );

  const handleLongPress = useCallback((item: QueueItem, idx: number) => {
    setContextTrack({
      trackId: item.trackId,
      title: item.track.title,
      artist: item.track.artist ?? null,
      queueIndex: idx,
    });
  }, []);

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<ListEntry>) => {
      if (item.kind === "header") {
        return <SectionHeader label={item.label} meta={item.meta} />;
      }
      if (item.kind === "spacer") {
        return <View style={{ height: item.height }} />;
      }
      return (
        <QueueRow
          item={item.item}
          idx={item.idx}
          state={item.state}
          onTap={handleTap}
          onLongPress={handleLongPress}
        />
      );
    },
    [handleTap, handleLongPress],
  );

  const keyExtractor = useCallback((item: ListEntry) => item.key, []);

  const contextActions = useMemo<ActionItem[]>(() => {
    if (!contextTrack || !userId) return [];
    const isCurrent = contextTrack.queueIndex === currentIndex;
    return [
      {
        icon: "play-skip-forward",
        label: "Play next",
        onPress: () => playNext(contextTrack.trackId, userId),
      },
      {
        icon: "list-outline",
        label: "Add to playlist",
        onPress: () =>
          setPickerTrack({ id: contextTrack.trackId, title: contextTrack.title }),
      },
      {
        icon: "close",
        label: isCurrent ? "Remove (skips to next)" : "Remove from queue",
        destructive: true,
        onPress: () => removeAt(contextTrack.queueIndex, userId),
      },
    ];
  }, [contextTrack, userId, currentIndex, playNext, removeAt]);

  return (
    <>
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <View style={{ flex: 1 }}>
        <RNPressable
          accessibilityLabel="Dismiss queue"
          style={{ flex: 1, backgroundColor: "rgba(22,19,14,0.45)" }}
          onPress={handleClose}
        />
        <View
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            height: "85%",
            backgroundColor: palette.paper,
            borderTopLeftRadius: radius.xl,
            borderTopRightRadius: radius.xl,
            overflow: "hidden",
          }}
        >
          <SafeAreaView edges={["top"]} style={{ flex: 1 }}>
            <HStack
              align="center"
              padX="base"
              padY="sm"
              style={{ gap: space.sm }}
            >
              <View style={{ width: 40, alignItems: "flex-start" }}>
                <IconButton
                  icon="chevron-down"
                  size={22}
                  accessibilityLabel="Close queue"
                  onPress={handleClose}
                />
              </View>
              <View style={{ flex: 1, alignItems: "center" }}>
                <Text variant="eyebrow" style={{ letterSpacing: 1.4 }}>
                  Queue
                </Text>
              </View>
              <View style={{ width: 40 }} />
            </HStack>

            {sections.nowPlaying ? (
              <>
                <NowPlayingHeader />
                <QueueRow
                  item={sections.nowPlaying.item}
                  idx={sections.nowPlaying.idx}
                  state="playing"
                  playing={playing}
                  onTogglePlayPause={togglePlayPause}
                  onTap={handleTap}
                  onLongPress={handleLongPress}
                />
              </>
            ) : null}

            {listData.length > 0 ? (
              <FlatList
                data={listData}
                renderItem={renderItem}
                keyExtractor={keyExtractor}
                showsVerticalScrollIndicator={false}
                initialNumToRender={10}
                maxToRenderPerBatch={8}
                windowSize={7}
                contentContainerStyle={{ paddingBottom: space["2xl"] }}
              />
            ) : queue.length === 0 ? (
              <VStack padY="xl" align="center">
                <Text variant="caption" tone="muted">
                  Tracks you play will appear here
                </Text>
              </VStack>
            ) : null}
          </SafeAreaView>
        </View>
      </View>
    </Modal>

    <ActionSheet
      visible={contextTrack != null}
      onClose={() => setContextTrack(null)}
      title={contextTrack?.title}
      subtitle={contextTrack?.artist ?? undefined}
      actions={contextActions}
    />

    <PlaylistPickerSheet
      visible={pickerTrack != null}
      track={pickerTrack}
      onClose={() => setPickerTrack(null)}
    />
    </>
  );
}
