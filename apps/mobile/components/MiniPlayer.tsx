import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { getTrackPlayer } from "../lib/trackPlayer";
import { usePlayerStore } from "../store/player";

export default function MiniPlayer() {
  const router = useRouter();
  const currentTrack = usePlayerStore((s) => s.currentTrack);
  const playing = usePlayerStore((s) => s.playing);
  const position = usePlayerStore((s) => s.position);
  const duration = usePlayerStore((s) => s.duration);
  const playbackRate = usePlayerStore((s) => s.playbackRate);

  if (!currentTrack) return null;

  const progress = duration > 0 ? Math.min(1, position / duration) : 0;
  const originalBpm = currentTrack.originalBpm;
  const currentBpm =
    originalBpm != null
      ? Math.round(originalBpm * playbackRate * 10) / 10
      : null;

  async function togglePlayPause() {
    const tp = getTrackPlayer();
    if (!tp) return;
    if (playing) await tp.pause();
    else await tp.play();
  }

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
        <View style={styles.bpmBadge}>
          <Text style={styles.bpmValue}>
            {currentBpm != null ? currentBpm.toFixed(1) : "—"}
          </Text>
          <Text style={styles.bpmLabel}>BPM</Text>
        </View>
        <Pressable
          onPress={togglePlayPause}
          hitSlop={12}
          style={styles.playBtn}
          android_ripple={{ color: "rgba(255,255,255,0.15)", borderless: true }}
        >
          <Ionicons name={playing ? "pause" : "play"} size={22} color="#fff" />
        </Pressable>
      </Pressable>
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
  bpmBadge: {
    alignItems: "center",
    paddingHorizontal: 6,
    minWidth: 48,
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
});
