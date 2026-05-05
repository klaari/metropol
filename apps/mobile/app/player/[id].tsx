import { userTracks } from "@aani/db";
import type { DiscogsMetadata } from "@aani/db";
import { useAuth } from "@clerk/clerk-expo";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { and, eq } from "drizzle-orm";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Keyboard,
  type LayoutChangeEvent,
  Modal,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import DiscogsSheet from "../../components/DiscogsSheet";
import PlaylistPickerSheet from "../../components/PlaylistPickerSheet";
import { apiFetch } from "../../lib/api";
import { useCurrentTrack } from "../../hooks/useCurrentTrack";
import { getDb } from "../../lib/db";
import { isNativeModuleAvailable, getTrackPlayer } from "../../lib/trackPlayer";
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
    currentIndex,
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
      // Clamp to ±8% (0.92 – 1.08)
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
  const dbgPlay = (msg: string) => {
    console.log("[player.toggle]", msg);
    setPlayDebug(msg);
  };

  const togglePlayPause = usePlayerStore((s) => s.togglePlayPause);

  async function handleTogglePlayPause() {
    const wasPlaying = usePlayerStore.getState().playing;
    await togglePlayPause();
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

  async function scaleBpm(factor: number) {
    if (originalBpm == null) return;
    const next = Math.round(originalBpm * factor * 10) / 10;
    if (next < 30 || next > 300) return;
    await persistBpm(next);
  }

  async function saveBpm() {
    setEditingBpm(false);
    const parsed = bpmInput.trim() ? parseFloat(bpmInput.trim()) : null;
    if (parsed != null && (isNaN(parsed) || parsed <= 0)) return;
    await persistBpm(parsed);
  }

  if (!isNativeModuleAvailable()) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Audio playback not available</Text>
        <Text style={[styles.errorText, { fontSize: 14, color: "#666", marginTop: 8 }]}>
          Requires a dev build — not supported in Expo Go
        </Text>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.backText}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator color="#fff" size="large" />
      </View>
    );
  }

  if (!currentTrack) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Track not found</Text>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.backText}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Text style={styles.backArrow}>‹</Text>
        </Pressable>
        <View style={styles.headerActions}>
          <Pressable
            onPress={() => setDiscogsOpen(true)}
            hitSlop={12}
            style={styles.headerBtn}
          >
            <Ionicons
              name={discogsMeta ? "disc" : "disc-outline"}
              size={26}
              color="#fff"
            />
            {discogsInCollection || discogsInWantlist ? (
              <View
                style={[
                  styles.headerDot,
                  {
                    backgroundColor: discogsInCollection ? "#4cd964" : "#ff4d6d",
                  },
                ]}
              />
            ) : null}
          </Pressable>
          <Pressable
            onPress={() => setPickerTrack({ id: currentTrack.id, title: currentTrack.title })}
            hitSlop={12}
            style={styles.headerBtn}
          >
            <Ionicons name="add-circle-outline" size={26} color="#fff" />
          </Pressable>
          <Pressable
            onPress={() => usePlayerStore.getState().setQueueSheetVisible(true)}
            hitSlop={12}
            style={styles.headerBtn}
          >
            <Ionicons name="list" size={26} color="#fff" />
          </Pressable>
        </View>
      </View>

      {/* Track Info */}
      <View style={styles.trackInfo}>
        {discogsMeta?.coverUrl ? (
          <Image
            source={{ uri: discogsMeta.coverUrl }}
            style={styles.cover}
            resizeMode="cover"
          />
        ) : null}
        <Text style={styles.title}>{currentTrack.title}</Text>
        {currentTrack.artist ? (
          <Text style={styles.artist}>{currentTrack.artist}</Text>
        ) : null}
        {discogsMeta ? (
          <Text style={styles.discogsLine} numberOfLines={2}>
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
      </View>

      {/* Seek Bar */}
      <View style={styles.seekSection}>
        <View
          onLayout={(e: LayoutChangeEvent) => {
            seekBarWidth.current = e.nativeEvent.layout.width;
            (e.target as any)?.measure?.(
              (_x: number, _y: number, _w: number, _h: number, pageX: number) => {
                if (typeof pageX === "number") seekBarX.current = pageX;
              },
            );
          }}
          style={styles.seekHitArea}
          {...seekPan.panHandlers}
        >
          <View style={styles.seekBarBg}>
            {(() => {
              const shown = dragSeconds != null ? dragSeconds : position;
              const pct = duration > 0 ? Math.max(0, Math.min(100, (shown / duration) * 100)) : 0;
              return (
                <>
                  <View style={[styles.seekBarFill, { width: `${pct}%` }]} />
                  <View
                    style={[
                      styles.seekThumb,
                      dragSeconds != null && styles.seekThumbActive,
                      { left: `${pct}%` },
                    ]}
                  />
                </>
              );
            })()}
          </View>
        </View>
        <View style={styles.timeRow}>
          <Text style={styles.time}>
            {formatTime(dragSeconds != null ? dragSeconds : position)}
          </Text>
          <Text style={styles.time}>{formatTime(duration)}</Text>
        </View>
      </View>

      {/* Transport Controls */}
      <View style={styles.transport}>
        <Pressable
          onPress={() => getTrackPlayer()?.skipToPrevious().catch(() => {})}
          hitSlop={12}
        >
          <Ionicons name="play-skip-back" size={36} color="#fff" />
        </Pressable>

        <Pressable
          style={styles.playBtn}
          onPress={handleTogglePlayPause}
          hitSlop={12}
        >
          <Ionicons name={playing ? "pause" : "play"} size={44} color="#000" />
        </Pressable>

        <Pressable
          onPress={() => getTrackPlayer()?.skipToNext().catch(() => {})}
          hitSlop={12}
        >
          <Ionicons name="play-skip-forward" size={36} color="#fff" />
        </Pressable>
      </View>

      {/* Rate Control */}
      <View style={styles.rateSection}>
        <View style={styles.rateHeader}>
          <Text style={styles.sectionLabel}>Speed</Text>
          {playbackRate !== 1 ? (
            <Pressable
              onPress={() => userId && setRate(1.0, userId)}
              hitSlop={6}
              style={styles.resetRateBtn}
            >
              <Ionicons name="refresh" size={14} color="#aaa" />
              <Text style={styles.resetRateText}>Reset</Text>
            </Pressable>
          ) : null}
        </View>
        <View style={styles.rateRow}>
          <Pressable style={styles.rateBtn} onPress={() => adjustRate(-0.005)}>
            <Text style={styles.rateBtnText}>-0.5%</Text>
          </Pressable>
          <Text style={styles.rateValue}>{rateDisplay}</Text>
          <Pressable style={styles.rateBtn} onPress={() => adjustRate(0.005)}>
            <Text style={styles.rateBtnText}>+0.5%</Text>
          </Pressable>
        </View>
      </View>

      {/* BPM Display */}
      <View style={styles.bpmSection}>
        <Pressable onPress={startBpmEdit} hitSlop={6} style={styles.bpmRow}>
          <Text style={styles.bpmLabel}>BPM</Text>
          <Text style={styles.bpmValue}>
            {currentBpm != null ? currentBpm.toFixed(1) : "—"}
          </Text>
        </Pressable>
        {playbackRate !== 1 && originalBpm != null ? (
          <View style={[styles.bpmRow, styles.bpmRowSecondary]}>
            <Text style={styles.bpmLabelSecondary}>Original</Text>
            <Text style={styles.bpmValueSecondary}>{originalBpm}</Text>
          </View>
        ) : null}
      </View>

      {/* Debug overlay */}
      <View style={styles.debugBox}>
        <Text style={styles.debugLoad}>
          {debugInfo || "(no load debug)"}
        </Text>
        {playDebug ? (
          <Text style={styles.debugPlay}>
            play: {playDebug}
          </Text>
        ) : null}
      </View>

      <Modal
        visible={editingBpm}
        transparent
        animationType="fade"
        onRequestClose={() => setEditingBpm(false)}
      >
        <Pressable style={styles.bpmBackdrop} onPress={() => setEditingBpm(false)} />
        <View
          pointerEvents="box-none"
          style={[styles.bpmModalWrapper, { paddingBottom: kbHeight }]}
        >
          <View style={styles.bpmModal}>
            <Text style={styles.bpmModalTitle}>Set BPM</Text>
            <TextInput
              style={styles.bpmModalInput}
              value={bpmInput}
              onChangeText={setBpmInput}
              keyboardType="decimal-pad"
              autoFocus
              selectTextOnFocus
              placeholder="128"
              placeholderTextColor="#444"
              onSubmitEditing={saveBpm}
              returnKeyType="done"
            />
            <View style={styles.bpmScaleRow}>
              <Pressable
                style={styles.bpmScaleBtn}
                onPress={() => {
                  const cur = parseFloat(bpmInput);
                  if (!isFinite(cur) || cur <= 0) return;
                  setBpmInput(String(Math.round(cur * 0.5 * 10) / 10));
                }}
                hitSlop={6}
              >
                <Text style={styles.bpmScaleText}>÷2</Text>
              </Pressable>
              <Pressable
                style={styles.bpmScaleBtn}
                onPress={() => {
                  const cur = parseFloat(bpmInput);
                  if (!isFinite(cur) || cur <= 0) return;
                  setBpmInput(String(Math.round(cur * 2 * 10) / 10));
                }}
                hitSlop={6}
              >
                <Text style={styles.bpmScaleText}>×2</Text>
              </Pressable>
            </View>
            <View style={styles.bpmModalRow}>
              <Pressable
                style={styles.bpmModalCancel}
                onPress={() => setEditingBpm(false)}
                hitSlop={6}
              >
                <Text style={styles.bpmModalCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={styles.bpmModalSave}
                onPress={saveBpm}
                hitSlop={6}
              >
                <Text style={styles.bpmModalSaveText}>Save</Text>
              </Pressable>
            </View>
          </View>
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  header: {
    position: "absolute",
    top: 56,
    left: 16,
    right: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  headerBtn: {
    padding: 4,
  },
  headerDot: {
    position: "absolute",
    top: 2,
    right: 2,
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: "#000",
  },
  discogsLine: {
    color: "#666",
    fontSize: 12,
    marginTop: 6,
    textAlign: "center",
  },
  backArrow: {
    color: "#fff",
    fontSize: 36,
    fontWeight: "300",
  },
  trackInfo: {
    alignItems: "center",
    marginBottom: 40,
  },
  cover: {
    width: 240,
    height: 240,
    borderRadius: 12,
    backgroundColor: "#1a1a1a",
    marginBottom: 20,
  },
  title: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "700",
    textAlign: "center",
  },
  artist: {
    color: "#888",
    fontSize: 16,
    marginTop: 4,
  },
  errorText: {
    color: "#888",
    fontSize: 18,
    textAlign: "center",
  },
  backText: {
    color: "#fff",
    fontSize: 16,
    textAlign: "center",
    marginTop: 16,
  },

  // Seek
  seekSection: {
    marginBottom: 32,
  },
  seekHitArea: {
    height: 32,
    justifyContent: "center",
  },
  seekBarBg: {
    height: 6,
    backgroundColor: "#333",
    borderRadius: 3,
    justifyContent: "center",
  },
  seekBarFill: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: "#fff",
    borderRadius: 3,
  },
  seekThumb: {
    position: "absolute",
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: "#fff",
    top: -4,
    marginLeft: -7,
  },
  seekThumbActive: {
    width: 18,
    height: 18,
    borderRadius: 9,
    top: -6,
    marginLeft: -9,
  },
  timeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 4,
  },
  time: {
    color: "#666",
    fontSize: 13,
  },

  // Transport
  transport: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 40,
    marginBottom: 40,
  },
  transportBtn: {
    fontSize: 28,
    color: "#fff",
  },
  playBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
  },
  playBtnText: {
    fontSize: 24,
    color: "#000",
  },

  // Rate
  rateSection: {
    alignItems: "center",
    marginBottom: 32,
  },
  rateHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 12,
  },
  sectionLabel: {
    color: "#888",
    fontSize: 13,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  resetRateBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: "#1a1a1a",
  },
  resetRateText: {
    color: "#aaa",
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  rateRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  rateBtn: {
    backgroundColor: "#1a1a1a",
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "#333",
  },
  rateBtnText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "500",
  },
  rateValue: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "600",
    minWidth: 70,
    textAlign: "center",
  },

  // BPM
  bpmSection: {
    backgroundColor: "#111",
    borderRadius: 12,
    padding: 16,
    gap: 12,
  },
  bpmRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  bpmRowSecondary: {
    paddingTop: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#222",
    marginTop: -2,
  },
  bpmLabel: {
    color: "#888",
    fontSize: 14,
  },
  bpmValue: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
  },
  bpmLabelSecondary: {
    color: "#666",
    fontSize: 12,
  },
  bpmValueSecondary: {
    color: "#888",
    fontSize: 13,
    fontVariant: ["tabular-nums"],
  },
  bpmEditRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  bpmScaleRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 12,
    marginTop: 8,
    marginBottom: 4,
  },
  bpmScaleBtn: {
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "#222",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#333",
  },
  bpmScaleText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "600",
    minWidth: 28,
    textAlign: "center",
  },
  debugBox: {
    backgroundColor: "#1a0a00",
    borderRadius: 8,
    padding: 10,
    marginTop: 16,
  },
  debugLoad: {
    color: "#f80",
    fontSize: 11,
    fontFamily: "monospace",
  },
  debugPlay: {
    color: "#0f0",
    fontSize: 11,
    fontFamily: "monospace",
    marginTop: 4,
  },
  bpmBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.65)",
  },
  bpmModalWrapper: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 28,
  },
  bpmModal: {
    width: "100%",
    maxWidth: 360,
    backgroundColor: "#161616",
    borderRadius: 16,
    paddingTop: 24,
    paddingBottom: 12,
    paddingHorizontal: 20,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#2a2a2a",
  },
  bpmModalTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "600",
    textAlign: "center",
    marginBottom: 18,
  },
  bpmModalInput: {
    backgroundColor: "transparent",
    borderBottomWidth: 2,
    borderBottomColor: "#fff",
    paddingHorizontal: 0,
    paddingVertical: 6,
    fontSize: 42,
    fontWeight: "300",
    color: "#fff",
    textAlign: "center",
    fontVariant: ["tabular-nums"],
    marginBottom: 8,
  },
  bpmModalRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    gap: 4,
    marginTop: 8,
  },
  bpmModalCancel: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  bpmModalCancelText: {
    color: "#888",
    fontSize: 15,
    fontWeight: "500",
  },
  bpmModalSave: {
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  bpmModalSaveText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
  },
  bpmInput: {
    backgroundColor: "#1a1a1a",
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#444",
    color: "#fff",
    fontSize: 16,
    paddingHorizontal: 10,
    paddingVertical: 6,
    width: 80,
    textAlign: "right",
  },
});
