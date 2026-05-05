import type { LibraryTrack } from "@aani/types";
import { memo } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";

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

function TrackItem({ track, onPress, onLongPress }: TrackItemProps) {
  const thumb = track.discogsThumbUrl ?? track.discogsCoverUrl;
  const dotColor = track.inDiscogsCollection
    ? "#4cd964"
    : track.inDiscogsWantlist
      ? "#ff4d6d"
      : null;
  return (
    <Pressable
      style={({ pressed }) => [styles.container, pressed && styles.pressed]}
      onPress={onPress}
      onLongPress={onLongPress}
      android_ripple={{ color: "rgba(255,255,255,0.08)" }}
    >
      <View style={styles.artwork}>
        {thumb ? (
          <Image source={{ uri: thumb }} style={styles.artworkImage} />
        ) : (
          <Text style={styles.artworkIcon}>♫</Text>
        )}
        {dotColor ? (
          <View style={[styles.dot, { backgroundColor: dotColor }]} />
        ) : null}
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

export default memo(TrackItem);

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
  artworkImage: {
    width: "100%",
    height: "100%",
    borderRadius: 8,
  },
  artworkIcon: {
    fontSize: 20,
    color: "#555",
  },
  dot: {
    position: "absolute",
    bottom: -2,
    right: -2,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: "#000",
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
