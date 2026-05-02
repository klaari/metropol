import { useAuth } from "@clerk/clerk-expo";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { usePlayerStore } from "../store/player";

const TEMPO_AUTO_CLOSE_MS = 3500;

export default function MiniPlayer() {
  const router = useRouter();
  const { userId } = useAuth();
  const currentTrack = usePlayerStore((s) => s.currentTrack);
  const playing = usePlayerStore((s) => s.playing);
  const position = usePlayerStore((s) => s.position);
  const duration = usePlayerStore((s) => s.duration);
  const playbackRate = usePlayerStore((s) => s.playbackRate);
  const togglePlayPause = usePlayerStore((s) => s.togglePlayPause);
  const setRate = usePlayerStore((s) => s.setRate);

  const [tempoOpen, setTempoOpen] = useState(false);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const armCloseTimer = useCallback(() => {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    closeTimerRef.current = setTimeout(() => setTempoOpen(false), TEMPO_AUTO_CLOSE_MS);
  }, []);

  useEffect(() => {
    if (tempoOpen) armCloseTimer();
    else if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    return () => {
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    };
  }, [tempoOpen, armCloseTimer]);

  const adjustRate = useCallback(
    (delta: number) => {
      if (!userId) return;
      const next = Math.round((playbackRate + delta) * 1000) / 1000;
      const clamped = Math.max(0.92, Math.min(1.08, next));
      setRate(clamped, userId);
      armCloseTimer();
    },
    [userId, playbackRate, setRate, armCloseTimer],
  );

  const resetRate = useCallback(() => {
    if (!userId) return;
    setRate(1.0, userId);
  }, [userId, setRate]);

  if (!currentTrack) return null;

  const progress = duration > 0 ? Math.min(1, position / duration) : 0;
  const originalBpm = currentTrack.originalBpm;
  const currentBpm =
    originalBpm != null
      ? Math.round(originalBpm * playbackRate * 10) / 10
      : null;
  const ratePercent = Math.round((playbackRate - 1) * 1000) / 10;
  const rateDisplay =
    ratePercent === 0
      ? "0%"
      : ratePercent > 0
        ? `+${ratePercent.toFixed(1)}%`
        : `${ratePercent.toFixed(1)}%`;

  return (
    <View style={styles.wrapper}>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
      </View>
      <Pressable
        style={({ pressed }) => [styles.row, pressed && styles.pressed]}
        onPress={() => router.push(`/player/${currentTrack.id}`)}
        android_ripple={{ color: "rgba(255,255,255,0.08)" }}
      >
        <View style={styles.artwork}>
          <Text style={styles.artworkIcon}>♫</Text>
        </View>
        <View style={styles.info}>
          <Text style={styles.title} numberOfLines={1}>
            {currentTrack.title}
          </Text>
          {currentTrack.artist ? (
            <Text style={styles.artist} numberOfLines={1}>
              {currentTrack.artist}
            </Text>
          ) : null}
        </View>
        <Pressable
          onPress={resetRate}
          onLongPress={() => setTempoOpen(true)}
          delayLongPress={250}
          hitSlop={6}
          style={styles.bpmBadge}
          android_ripple={{ color: "rgba(255,255,255,0.08)", borderless: true }}
        >
          <Text style={styles.bpmValue}>
            {currentBpm != null ? currentBpm.toFixed(1) : "—"}
          </Text>
          {playbackRate !== 1 && originalBpm != null ? (
            <Text style={[styles.bpmLabel, styles.bpmLabelAltered]}>
              {originalBpm}
            </Text>
          ) : (
            <Text style={styles.bpmLabel}>BPM</Text>
          )}
        </Pressable>
        <Pressable
          onPress={togglePlayPause}
          hitSlop={12}
          style={styles.playBtn}
          android_ripple={{ color: "rgba(255,255,255,0.15)", borderless: true }}
        >
          <Ionicons name={playing ? "pause" : "play"} size={22} color="#fff" />
        </Pressable>
        <Pressable
          onPress={() => usePlayerStore.getState().setQueueSheetVisible(true)}
          hitSlop={12}
          style={styles.queueBtn}
          android_ripple={{ color: "rgba(255,255,255,0.15)", borderless: true }}
        >
          <Ionicons name="list" size={22} color="#fff" />
        </Pressable>
      </Pressable>

      <Modal
        visible={tempoOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setTempoOpen(false)}
      >
        <Pressable
          style={styles.tempoBackdrop}
          onPress={() => setTempoOpen(false)}
        />
        <View style={styles.tempoPopover}>
          <Pressable
            style={styles.tempoBtn}
            onPress={() => adjustRate(-0.005)}
            hitSlop={6}
          >
            <Text style={styles.tempoBtnText}>−0.5%</Text>
          </Pressable>
          <View style={styles.tempoCenter}>
            <Text style={styles.tempoRate}>{rateDisplay}</Text>
            {currentBpm != null ? (
              <Text style={styles.tempoBpm}>{currentBpm.toFixed(1)} BPM</Text>
            ) : null}
          </View>
          <Pressable
            style={styles.tempoBtn}
            onPress={() => adjustRate(0.005)}
            hitSlop={6}
          >
            <Text style={styles.tempoBtnText}>+0.5%</Text>
          </Pressable>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: "#0a0a0a",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#222",
  },
  progressTrack: {
    height: 2,
    backgroundColor: "#1a1a1a",
  },
  progressFill: {
    height: "100%",
    backgroundColor: "#fff",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 12,
    gap: 12,
  },
  pressed: {
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  artwork: {
    width: 40,
    height: 40,
    borderRadius: 6,
    backgroundColor: "#1a1a1a",
    justifyContent: "center",
    alignItems: "center",
  },
  artworkIcon: {
    fontSize: 18,
    color: "#555",
  },
  info: {
    flex: 1,
    gap: 2,
  },
  title: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  artist: {
    color: "#888",
    fontSize: 12,
  },
  playBtn: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  queueBtn: {
    width: 36,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  bpmBadge: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
    paddingVertical: 4,
    minWidth: 52,
    borderRadius: 6,
  },
  bpmValue: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
  },
  bpmLabel: {
    color: "#666",
    fontSize: 9,
    fontWeight: "600",
    letterSpacing: 0.6,
    marginTop: -1,
  },
  bpmLabelAltered: {
    color: "#f5a623",
    fontSize: 11,
    fontVariant: ["tabular-nums"],
    letterSpacing: 0,
  },
  tempoBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  tempoPopover: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 110,
    backgroundColor: "#161616",
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#2a2a2a",
  },
  tempoBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: "#222",
    borderRadius: 8,
    minWidth: 60,
    alignItems: "center",
  },
  tempoBtnText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  tempoCenter: {
    flex: 1,
    alignItems: "center",
  },
  tempoRate: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
  tempoBpm: {
    color: "#888",
    fontSize: 11,
    marginTop: 2,
    fontVariant: ["tabular-nums"],
  },
});
