import { View } from "react-native";
import { palette, radius, space } from "../../design/tokens";
import { Pressable } from "./Pressable";
import { Text } from "./Text";

interface PlaylistCardProps {
  name: string;
  trackCount: number;
  /** Card dimension in px — square. Default 72 (library strip). */
  size?: number;
  onPress?: () => void;
}

// Curated accent rotation. Cobalt + ink + an editorial trio span the
// palette so the strip reads as a hand-picked set rather than a random one.
const ACCENTS: string[] = [
  palette.ink,
  palette.cobalt,
  palette.critical,
  palette.positive,
  palette.cobaltDeep,
  palette.warning,
];

function hashIndex(str: string, mod: number): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h * 31 + str.charCodeAt(i)) >>> 0;
  }
  return h % mod;
}

/**
 * A square playlist tile for horizontal-scroll strips. Filled with a
 * deterministic accent derived from the name, with a faint diagonal hatch
 * overlay so the tile reads as printed paper rather than a flat swatch.
 */
export function PlaylistCard({
  name,
  trackCount,
  size = 72,
  onPress,
}: PlaylistCardProps) {
  const bg = ACCENTS[hashIndex(name, ACCENTS.length)]!;
  return (
    <Pressable
      accessibilityLabel={`${name}, ${trackCount} tracks`}
      accessibilityRole="button"
      onPress={onPress}
      style={{
        width: size,
        height: size,
        borderRadius: radius.sm,
        backgroundColor: bg,
        padding: space.sm,
        justifyContent: "space-between",
        overflow: "hidden",
      }}
    >
      <View />
      <View>
        <Text
          variant="bodyStrong"
          numberOfLines={2}
          style={{
            color: palette.inkInverse,
            fontSize: 12,
            lineHeight: 14,
          }}
        >
          {name}
        </Text>
        <Text
          variant="numeric"
          numberOfLines={1}
          style={{
            color: "rgba(255,255,255,0.55)",
            fontSize: 9,
            lineHeight: 11,
          }}
        >
          {trackCount} {trackCount === 1 ? "track" : "tracks"}
        </Text>
      </View>
    </Pressable>
  );
}
