import type { LibraryTrack } from "@aani/types";
import { memo } from "react";
import { Image, View } from "react-native";
import {
  ListRow,
  Surface,
  Text,
  palette,
  radius,
  space,
} from "./ui";

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

function TrackArtwork({ track }: { track: LibraryTrack }) {
  const thumb = track.discogsThumbUrl ?? track.discogsCoverUrl;
  const dotColor = track.inDiscogsCollection
    ? palette.positive
    : track.inDiscogsWantlist
      ? palette.critical
      : null;

  return (
    <View>
      <Surface tone="sunken" rounded="md" pad="none">
        <View
          style={{
            width: 48,
            height: 48,
            borderRadius: radius.md,
            overflow: "hidden",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {thumb ? (
            <Image source={{ uri: thumb }} style={{ width: "100%", height: "100%" }} />
          ) : (
            <Text variant="title" tone="faint">
              ♫
            </Text>
          )}
        </View>
      </Surface>
      {dotColor ? (
        <View
          style={{
            position: "absolute",
            bottom: -space.xs / 2,
            right: -space.xs / 2,
            width: space.md,
            height: space.md,
            borderRadius: radius.full,
            borderWidth: space.xs / 2,
            borderColor: palette.paper,
            backgroundColor: dotColor,
          }}
        />
      ) : null}
    </View>
  );
}

function TrackItem({ track, onPress, onLongPress }: TrackItemProps) {
  const subtitle = `${track.artist || "Unknown artist"}${
    track.originalBpm != null ? ` · ${track.originalBpm} BPM` : ""
  }`;

  return (
    <ListRow
      title={track.title}
      subtitle={subtitle}
      leading={<TrackArtwork track={track} />}
      trailing={
        <Text variant="numeric" tone="muted">
          {formatDuration(track.duration)}
        </Text>
      }
      onPress={onPress}
      onLongPress={onLongPress}
    />
  );
}

export default memo(TrackItem);
