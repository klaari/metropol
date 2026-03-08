import type { Track } from "@metropol/types";
import { Pressable, StyleSheet, Text, View } from "react-native";

function formatDuration(seconds: number | null): string {
  if (seconds == null) return "--:--";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

interface TrackItemProps {
  track: Track;
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
    >
      <View style={styles.info}>
        <Text style={styles.title} numberOfLines={1}>
          {track.title}
        </Text>
        {track.artist ? (
          <Text style={styles.artist} numberOfLines={1}>
            {track.artist}
          </Text>
        ) : null}
      </View>
      <View style={styles.meta}>
        {track.originalBpm != null ? (
          <Text style={styles.bpm}>{track.originalBpm} BPM</Text>
        ) : null}
        <Text style={styles.duration}>{formatDuration(track.duration)}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#222",
  },
  pressed: {
    backgroundColor: "#111",
  },
  info: {
    flex: 1,
    marginRight: 12,
  },
  title: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "500",
  },
  artist: {
    color: "#888",
    fontSize: 14,
    marginTop: 2,
  },
  meta: {
    alignItems: "flex-end",
  },
  bpm: {
    color: "#888",
    fontSize: 13,
  },
  duration: {
    color: "#666",
    fontSize: 13,
    marginTop: 2,
  },
});
