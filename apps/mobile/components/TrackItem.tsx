import type { LibraryTrack } from "@metropol/types";
import { Pressable, StyleSheet, Text, View } from "react-native";

function formatDuration(seconds: number | null): string {
  if (seconds == null) return "--:--";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

interface TrackItemProps {
  track: LibraryTrack;
  onPress: () => void;
  onLongPress: () => void;
}

export default function TrackItem({
  track,
  onPress,
  onLongPress,
}: TrackItemProps) {
  return (
    <Pressable
      style={({ pressed }) => [styles.container, pressed && styles.pressed]}
      onPress={onPress}
      onLongPress={onLongPress}
      android_ripple={{ color: "rgba(255,255,255,0.08)" }}
    >
      <View style={styles.artwork}>
        <Text style={styles.artworkIcon}>♫</Text>
      </View>
      <View style={styles.info}>
        <Text style={styles.title} numberOfLines={1}>
          {track.title}
        </Text>
        <Text style={styles.subtitle} numberOfLines={1}>
          {track.artist || "Unknown artist"}
          {track.originalBpm != null ? `  ·  ${track.originalBpm} BPM` : ""}
        </Text>
      </View>
      <Text style={styles.duration}>{formatDuration(track.duration)}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 14,
  },
  pressed: {
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  artwork: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: "#1a1a1a",
    justifyContent: "center",
    alignItems: "center",
  },
  artworkIcon: {
    fontSize: 20,
    color: "#555",
  },
  info: {
    flex: 1,
    gap: 3,
  },
  title: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  subtitle: {
    color: "#777",
    fontSize: 13,
  },
  duration: {
    color: "#555",
    fontSize: 12,
    fontVariant: ["tabular-nums"],
  },
});
