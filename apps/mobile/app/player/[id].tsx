import { userTracks, type DiscogsMetadata } from "@aani/db";
import { useAuth } from "@clerk/clerk-expo";
import { Ionicons } from "@expo/vector-icons";
import { and, eq } from "drizzle-orm";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Keyboard,
  type LayoutChangeEvent,
  Modal,
  PanResponder,
  View,
} from "react-native";
import DiscogsSheet from "../../components/DiscogsSheet";
import PlaylistPickerSheet from "../../components/PlaylistPickerSheet";
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
  radius,
  space,
} from "../../components/ui";
import { useCurrentTrack } from "../../hooks/useCurrentTrack";
import { apiFetch } from "../../lib/api";
import { getDb } from "../../lib/db";
import { getTrackPlayer, isNativeModuleAvailable } from "../../lib/trackPlayer";
import { useLibraryStore } from "../../store/library";
import { usePlayerStore } from "../../store/player";

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function PlayerScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { userId, getToken } = useAuth();
  const router = useRouter();

  const {
    queue,
    playbackRate,
    playWithQueue,
    skipToIndex,
    setRate,
    savePosition,
    debugInfo,
    playing,
    position,
    duration,
  } = usePlayerStore();
  const currentTrack = useCurrentTrack();

  const [loading, setLoading] = useState(false);
  const [editingBpm, setEditingBpm] = useState(false);
  const [bpmInput, setBpmInput] = useState("");
  const [pickerTrack, setPickerTrack] = useState<{ id: string; title: string } | null>(null);
  const [discogsOpen, setDiscogsOpen] = useState(false);
  const [discogsMeta, setDiscogsMeta] = useState<DiscogsMetadata | null>(null);
  const [discogsInCollection, setDiscogsInCollection] = useState(false);
  const [discogsInWantlist, setDiscogsInWantlist] = useState(false);
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

  const seekBarWidth = useRef(0);
  const seekBarX = useRef(0);
  const [dragSeconds, setDragSeconds] = useState<number | null>(null);
  const dragSecondsRef = useRef<number | null>(null);
  const durationRef = useRef(0);

  useEffect(() => {
    durationRef.current = duration;
  }, [duration]);

  useEffect(() => {
    setDiscogsMeta(null);
    setDiscogsInCollection(false);
    setDiscogsInWantlist(false);
    if (!currentTrack?.id) return;
    let cancelled = false;
    (async () => {
      const token = await getToken();
      if (!token || cancelled) return;
      const { data } = await apiFetch<{
        metadata: DiscogsMetadata | null;
        inCollection: boolean;
        inWantlist: boolean;
      }>(`/discogs/track/${currentTrack.id}`, token);
      if (cancelled || !data) return;
      setDiscogsMeta(data.metadata);
      setDiscogsInCollection(data.inCollection);
      setDiscogsInWantlist(data.inWantlist);
    })();
    return () => {
      cancelled = true;
    };
  }, [currentTrack?.id, getToken]);

  useEffect(() => {
    if (!id || !userId) return;
    if (currentTrack?.id === id) return;

    const idxInQueue = queue.findIndex((q) => q.trackId === id);
    if (idxInQueue >= 0) {
      skipToIndex(idxInQueue, userId);
      return;
    }

    const cached = useLibraryStore.getState().tracks.find((t) => t.id === id);
    if (!cached) return;

    setLoading(true);
    playWithQueue([cached], 0, userId).finally(() => setLoading(false));

    return () => {
      if (userId) savePosition(userId);
    };
  }, [id, userId]);

  const adjustRate = useCallback(
    (delta: number) => {
      if (!userId) return;
      const newRate = Math.round((playbackRate + delta) * 1000) / 1000;
      const clamped = Math.max(0.92, Math.min(1.08, newRate));
      setRate(clamped, userId);
    },
    [playbackRate, userId, setRate],
  );

  const ratePercent = Math.round((playbackRate - 1) * 1000) / 10;
  const rateDisplay =
    ratePercent === 0
      ? "0%"
      : ratePercent > 0
        ? `+${ratePercent.toFixed(1)}%`
        : `${ratePercent.toFixed(1)}%`;

  const originalBpm = currentTrack?.originalBpm;
  const currentBpm =
    originalBpm != null
      ? Math.round(originalBpm * playbackRate * 10) / 10
      : null;

  async function handleSeek(value: number) {
    const tp = getTrackPlayer();
    if (tp) await tp.seekTo(value);
  }

  function setDrag(seconds: number | null) {
    dragSecondsRef.current = seconds;
    setDragSeconds(seconds);
  }

  function ratioFromPageX(pageX: number): number {
    const w = seekBarWidth.current;
    if (w <= 0) return 0;
    return Math.max(0, Math.min(1, (pageX - seekBarX.current) / w));
  }

  const seekPan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (e) => {
        const ratio = ratioFromPageX(e.nativeEvent.pageX);
        setDrag(ratio * durationRef.current);
      },
      onPanResponderMove: (e) => {
        const ratio = ratioFromPageX(e.nativeEvent.pageX);
        setDrag(ratio * durationRef.current);
      },
      onPanResponderRelease: () => {
        const target = dragSecondsRef.current;
        if (target != null) handleSeek(target);
        setDrag(null);
      },
      onPanResponderTerminate: () => setDrag(null),
    }),
  ).current;

  const [playDebug, setPlayDebug] = useState("");
  const togglePlayPause = usePlayerStore((s) => s.togglePlayPause);

  async function handleTogglePlayPause() {
    const wasPlaying = usePlayerStore.getState().playing;
    await togglePlayPause();
    setPlayDebug(wasPlaying ? "pause requested" : "play requested");
    if (wasPlaying && userId) savePosition(userId);
  }

  const handleDiscogsClose = useCallback(() => setDiscogsOpen(false), []);

  const handleDiscogsEnrichmentChange = useCallback(
    (d: { metadata: DiscogsMetadata | null; inCollection: boolean; inWantlist: boolean }) => {
      setDiscogsMeta(d.metadata);
      setDiscogsInCollection(d.inCollection);
      setDiscogsInWantlist(d.inWantlist);
    },
    [],
  );

  function startBpmEdit() {
    setBpmInput(originalBpm != null ? String(originalBpm) : "");
    setEditingBpm(true);
  }

  async function persistBpm(value: number | null) {
    if (!currentTrack || !userId) return;
    const trackId = currentTrack.id;
    await getDb()
      .update(userTracks)
      .set({ originalBpm: value })
      .where(
        and(eq(userTracks.userId, userId), eq(userTracks.trackId, trackId)),
      );
    usePlayerStore.setState((s) => ({
      queue: s.queue.map((q) =>
        q.trackId === trackId
          ? { ...q, track: { ...q.track, originalBpm: value } }
          : q,
      ),
    }));
  }

  async function saveBpm() {
    setEditingBpm(false);
    const parsed = bpmInput.trim() ? parseFloat(bpmInput.trim()) : null;
    if (parsed != null && (isNaN(parsed) || parsed <= 0)) return;
    await persistBpm(parsed);
  }

  function setBpmScale(factor: number) {
    const cur = parseFloat(bpmInput);
    if (!isFinite(cur) || cur <= 0) return;
    setBpmInput(String(Math.round(cur * factor * 10) / 10));
  }

  if (!isNativeModuleAvailable()) {
    return (
      <Screen scroll={false}>
        <VStack flex justify="center" align="center" gap="md">
          <Text variant="title" align="center">
            Audio playback not available
          </Text>
          <Text variant="body" tone="muted" align="center">
            Requires a dev build — not supported in Expo Go
          </Text>
          <Button label="Go back" variant="secondary" onPress={() => router.back()} />
        </VStack>
      </Screen>
    );
  }

  if (loading) {
    return (
      <Screen scroll={false}>
        <VStack flex justify="center" align="center">
          <ActivityIndicator color={palette.ink} size="large" />
        </VStack>
      </Screen>
    );
  }

  if (!currentTrack) {
    return (
      <Screen scroll={false}>
        <VStack flex justify="center" align="center" gap="md">
          <Text variant="title">Track not found</Text>
          <Button label="Go back" variant="secondary" onPress={() => router.back()} />
        </VStack>
      </Screen>
    );
  }

  const shownSeconds = dragSeconds != null ? dragSeconds : position;
  const seekPct = duration > 0 ? Math.max(0, Math.min(100, (shownSeconds / duration) * 100)) : 0;
  const discogsDot = discogsInCollection
    ? palette.positive
    : discogsInWantlist
      ? palette.critical
      : null;

  return (
    <Screen>
      <VStack gap="xl">
        <AppBar
          onBack={() => router.back()}
          trailing={
            <IconButton
              icon="list"
              accessibilityLabel="Open queue"
              onPress={() => usePlayerStore.getState().setQueueSheetVisible(true)}
            />
          }
        />

        <HStack justify="center" gap="lg">
          <View>
            <IconButton
              icon={discogsMeta ? "disc" : "disc-outline"}
              accessibilityLabel="Open Discogs"
              onPress={() => setDiscogsOpen(true)}
            />
            {discogsDot ? (
              <View
                style={{
                  position: "absolute",
                  top: space.xs,
                  right: space.xs,
                  width: space.sm,
                  height: space.sm,
                  borderRadius: radius.full,
                  borderWidth: 1.5,
                  borderColor: palette.paper,
                  backgroundColor: discogsDot,
                }}
              />
            ) : null}
          </View>
          <IconButton
            icon="add-circle-outline"
            accessibilityLabel="Add to playlist"
            onPress={() => setPickerTrack({ id: currentTrack.id, title: currentTrack.title })}
          />
        </HStack>

        <VStack gap="lg" align="center">
          {discogsMeta?.coverUrl ? (
            <Image
              source={{ uri: discogsMeta.coverUrl }}
              resizeMode="cover"
              style={{
                width: 240,
                height: 240,
                borderRadius: radius.lg,
                backgroundColor: palette.paperSunken,
              }}
            />
          ) : (
            <Surface tone="sunken" rounded="xl" pad="xl">
              <View
                style={{
                  width: 176,
                  height: 176,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text variant="display" tone="faint">
                  ♫
                </Text>
              </View>
            </Surface>
          )}
          <VStack gap="xs" align="center">
            <Text variant="display" align="center">
              {currentTrack.title}
            </Text>
            {currentTrack.artist ? (
              <Text variant="bodyLg" tone="muted" align="center">
                {currentTrack.artist}
              </Text>
            ) : null}
            {discogsMeta ? (
              <Text variant="caption" tone="muted" align="center" numberOfLines={2}>
                {[
                  discogsMeta.year ? String(discogsMeta.year) : null,
                  discogsMeta.label,
                  discogsMeta.catalogNumber,
                  (discogsMeta.styles ?? discogsMeta.genres ?? [])
                    .slice(0, 2)
                    .join(", ") || null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </Text>
            ) : null}
          </VStack>
        </VStack>

        <VStack gap="xs">
          <View
            onLayout={(e: LayoutChangeEvent) => {
              seekBarWidth.current = e.nativeEvent.layout.width;
              (e.target as any)?.measure?.(
                (_x: number, _y: number, _w: number, _h: number, pageX: number) => {
                  if (typeof pageX === "number") seekBarX.current = pageX;
                },
              );
            }}
            style={{ height: 32, justifyContent: "center" }}
            {...seekPan.panHandlers}
          >
            <View
              style={{
                height: 6,
                backgroundColor: palette.paperEdge,
                borderRadius: radius.full,
                justifyContent: "center",
              }}
            >
              <View
                style={{
                  position: "absolute",
                  left: 0,
                  top: 0,
                  bottom: 0,
                  width: `${seekPct}%`,
                  backgroundColor: palette.ink,
                  borderRadius: radius.full,
                }}
              />
              <View
                style={{
                  position: "absolute",
                  width: dragSeconds != null ? 18 : 14,
                  height: dragSeconds != null ? 18 : 14,
                  borderRadius: radius.full,
                  backgroundColor: palette.ink,
                  top: dragSeconds != null ? -6 : -4,
                  left: `${seekPct}%`,
                  marginLeft: dragSeconds != null ? -9 : -7,
                }}
              />
            </View>
          </View>
          <HStack justify="between">
            <Text variant="numeric" tone="muted">
              {formatTime(shownSeconds)}
            </Text>
            <Text variant="numeric" tone="muted">
              {formatTime(duration)}
            </Text>
          </HStack>
        </VStack>

        <HStack justify="center" gap="xl">
          <IconButton
            icon="play-skip-back"
            accessibilityLabel="Previous track"
            onPress={() => getTrackPlayer()?.skipToPrevious().catch(() => {})}
            size={36}
          />
          <IconButton
            icon={playing ? "pause" : "play"}
            accessibilityLabel={playing ? "Pause" : "Play"}
            variant="filled"
            onPress={handleTogglePlayPause}
            size={36}
          />
          <IconButton
            icon="play-skip-forward"
            accessibilityLabel="Next track"
            onPress={() => getTrackPlayer()?.skipToNext().catch(() => {})}
            size={36}
          />
        </HStack>

        <VStack gap="md" align="center">
          <HStack gap="md">
            <Text variant="eyebrow" tone="muted">
              Speed
            </Text>
            {playbackRate !== 1 ? (
              <Button
                label="Reset"
                size="sm"
                variant="secondary"
                onPress={() => userId && setRate(1.0, userId)}
                leading={<Ionicons name="refresh" size={14} color={palette.ink} />}
              />
            ) : null}
          </HStack>
          <HStack gap="base">
            <Button label="-0.5%" variant="secondary" onPress={() => adjustRate(-0.005)} />
            <Text variant="title" numeric align="center">
              {rateDisplay}
            </Text>
            <Button label="+0.5%" variant="secondary" onPress={() => adjustRate(0.005)} />
          </HStack>
        </VStack>

        <Surface tone="raised" rounded="lg" pad="base" bordered>
          <Pressable flat onPress={startBpmEdit}>
            <HStack justify="between">
              <Text variant="body" tone="muted">
                BPM
              </Text>
              <Text variant="title" numeric>
                {currentBpm != null ? currentBpm.toFixed(1) : "—"}
              </Text>
            </HStack>
          </Pressable>
          {playbackRate !== 1 && originalBpm != null ? (
            <>
              <Divider inset="md" />
              <HStack justify="between">
                <Text variant="caption" tone="muted">
                  Original
                </Text>
                <Text variant="numeric" tone="muted">
                  {originalBpm}
                </Text>
              </HStack>
            </>
          ) : null}
        </Surface>

        <Surface tone="sunken" rounded="md" pad="sm">
          <Text variant="caption" tone="warning">
            {debugInfo || "(no load debug)"}
          </Text>
          {playDebug ? (
            <Text variant="caption" tone="positive">
              play: {playDebug}
            </Text>
          ) : null}
        </Surface>

        <Modal
          visible={editingBpm}
          transparent
          animationType="fade"
          onRequestClose={() => setEditingBpm(false)}
        >
          <Pressable
            flat
            style={{ flex: 1, backgroundColor: "rgba(22,19,14,0.45)" }}
            onPress={() => setEditingBpm(false)}
          />
          <View
            pointerEvents="box-none"
            style={{
              position: "absolute",
              left: space.lg,
              right: space.lg,
              top: 0,
              bottom: kbHeight,
              justifyContent: "center",
            }}
          >
            <Surface tone="raised" lift="popover" rounded="xl" pad="lg" bordered>
              <VStack gap="md">
                <Text variant="title" align="center">
                  Set BPM
                </Text>
                <Input
                  value={bpmInput}
                  onChangeText={setBpmInput}
                  keyboardType="decimal-pad"
                  autoFocus
                  selectTextOnFocus
                  placeholder="128"
                  onSubmitEditing={saveBpm}
                  returnKeyType="done"
                />
                <HStack justify="center" gap="md">
                  <Button label="÷2" variant="secondary" onPress={() => setBpmScale(0.5)} />
                  <Button label="×2" variant="secondary" onPress={() => setBpmScale(2)} />
                </HStack>
                <HStack justify="end" gap="sm">
                  <Button
                    label="Cancel"
                    variant="ghost"
                    onPress={() => setEditingBpm(false)}
                  />
                  <Button label="Save" onPress={saveBpm} />
                </HStack>
              </VStack>
            </Surface>
          </View>
        </Modal>

        <PlaylistPickerSheet
          visible={pickerTrack != null}
          track={pickerTrack}
          onClose={() => setPickerTrack(null)}
        />

        <DiscogsSheet
          visible={discogsOpen}
          trackId={currentTrack.id}
          defaultQuery={`${currentTrack.artist ?? ""} ${currentTrack.title}`.trim()}
          onClose={handleDiscogsClose}
          onEnrichmentChange={handleDiscogsEnrichmentChange}
        />
      </VStack>
    </Screen>
  );
}
