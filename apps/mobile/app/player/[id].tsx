import { tracks } from "@markku/db";
import { useAuth } from "@clerk/clerk-expo";
import { useLocalSearchParams, useRouter } from "expo-router";
import { eq } from "drizzle-orm";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  type LayoutChangeEvent,
  Pressable,
  type GestureResponderEvent,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { db } from "../../lib/db";
import { isNativeModuleAvailable, getTrackPlayer } from "../../lib/trackPlayer";
import { usePlayerStore } from "../../store/player";

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function PlayerScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { userId } = useAuth();
  const router = useRouter();

  // Polling-based replacements for useProgress / useIsPlaying
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const tp = getTrackPlayer();
    if (!tp) return;

    const interval = setInterval(async () => {
      try {
        const progress = await tp.getProgress();
        setPosition(progress.position);
        setDuration(progress.duration);

        const state = await tp.getPlaybackState();
        // state.state is a string like "playing", "paused", etc.
        setPlaying(state.state === "playing");
      } catch {
        // Player may not be ready yet
      }
    }, 200);

    return () => clearInterval(interval);
  }, []);

  const { currentTrack, playbackRate, loadTrack, setRate, savePosition } =
    usePlayerStore();

  const [loading, setLoading] = useState(true);
  const [editingBpm, setEditingBpm] = useState(false);
  const [bpmInput, setBpmInput] = useState("");
  const seekBarWidth = useRef(0);

  useEffect(() => {
    if (!id || !userId) return;
    setLoading(true);
    loadTrack(id, userId).finally(() => setLoading(false));

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

  async function togglePlayPause() {
    const tp = getTrackPlayer();
    if (!tp) return;
    if (playing) {
      await tp.pause();
      if (userId) savePosition(userId);
    } else {
      await tp.play();
    }
  }

  function startBpmEdit() {
    setBpmInput(originalBpm != null ? String(originalBpm) : "");
    setEditingBpm(true);
  }

  async function saveBpm() {
    setEditingBpm(false);
    if (!currentTrack) return;

    const parsed = bpmInput.trim() ? parseFloat(bpmInput.trim()) : null;
    if (parsed != null && (isNaN(parsed) || parsed <= 0)) return;

    await db
      .update(tracks)
      .set({ originalBpm: parsed })
      .where(eq(tracks.id, currentTrack.id));

    usePlayerStore.setState({
      currentTrack: { ...currentTrack, originalBpm: parsed },
    });
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
      </View>

      {/* Track Info */}
      <View style={styles.trackInfo}>
        <Text style={styles.title}>{currentTrack.title}</Text>
        {currentTrack.artist ? (
          <Text style={styles.artist}>{currentTrack.artist}</Text>
        ) : null}
      </View>

      {/* Seek Bar */}
      <View style={styles.seekSection}>
        <Pressable
          onLayout={(e: LayoutChangeEvent) => {
            seekBarWidth.current = e.nativeEvent.layout.width;
          }}
          onPress={(e: GestureResponderEvent) => {
            if (duration > 0 && seekBarWidth.current > 0) {
              const ratio = e.nativeEvent.locationX / seekBarWidth.current;
              handleSeek(ratio * duration);
            }
          }}
        >
          <View style={styles.seekBarBg}>
            <View
              style={[
                styles.seekBarFill,
                {
                  width:
                    duration > 0
                      ? `${(position / duration) * 100}%`
                      : "0%",
                },
              ]}
            />
          </View>
        </Pressable>
        <View style={styles.timeRow}>
          <Text style={styles.time}>{formatTime(position)}</Text>
          <Text style={styles.time}>{formatTime(duration)}</Text>
        </View>
      </View>

      {/* Transport Controls */}
      <View style={styles.transport}>
        <Pressable
          onPress={() => getTrackPlayer()?.skipToPrevious().catch(() => {})}
          hitSlop={12}
        >
          <Text style={styles.transportBtn}>⏮</Text>
        </Pressable>

        <Pressable
          style={styles.playBtn}
          onPress={togglePlayPause}
          hitSlop={12}
        >
          <Text style={styles.playBtnText}>{playing ? "⏸" : "▶"}</Text>
        </Pressable>

        <Pressable
          onPress={() => getTrackPlayer()?.skipToNext().catch(() => {})}
          hitSlop={12}
        >
          <Text style={styles.transportBtn}>⏭</Text>
        </Pressable>
      </View>

      {/* Rate Control */}
      <View style={styles.rateSection}>
        <Text style={styles.sectionLabel}>Speed</Text>
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
        <View style={styles.bpmRow}>
          <Text style={styles.bpmLabel}>Original BPM</Text>
          {editingBpm ? (
            <View style={styles.bpmEditRow}>
              <TextInput
                style={styles.bpmInput}
                value={bpmInput}
                onChangeText={setBpmInput}
                keyboardType="decimal-pad"
                autoFocus
                onSubmitEditing={saveBpm}
                onBlur={saveBpm}
              />
            </View>
          ) : (
            <Pressable onPress={startBpmEdit}>
              <Text style={styles.bpmValue}>
                {originalBpm != null ? String(originalBpm) : "—"}
              </Text>
            </Pressable>
          )}
        </View>
        <View style={styles.bpmRow}>
          <Text style={styles.bpmLabel}>Current BPM</Text>
          <Text style={styles.bpmValue}>
            {currentBpm != null ? currentBpm.toFixed(1) : "—"}
          </Text>
        </View>
      </View>
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
  seekBarBg: {
    height: 4,
    backgroundColor: "#333",
    borderRadius: 2,
    overflow: "hidden",
  },
  seekBarFill: {
    height: 4,
    backgroundColor: "#fff",
    borderRadius: 2,
  },
  timeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
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
  sectionLabel: {
    color: "#888",
    fontSize: 13,
    marginBottom: 12,
    textTransform: "uppercase",
    letterSpacing: 1,
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
  bpmLabel: {
    color: "#888",
    fontSize: 14,
  },
  bpmValue: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  bpmEditRow: {
    flexDirection: "row",
    alignItems: "center",
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
