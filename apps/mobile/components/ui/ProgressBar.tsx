import { View } from "react-native";
import { palette, radius } from "../../design/tokens";

interface ProgressBarProps {
  /** Value in [0, 1]. Clamped. */
  value: number;
  /** Track color override. */
  trackColor?: string;
  /** Fill color override. */
  fillColor?: string;
}

/**
 * Thin, editorial scrubber rail. Default is 2px — anything thicker
 * starts to feel like a Material slider. Pair with timestamps below it.
 */
export function ProgressBar({
  value,
  trackColor = palette.paperEdge,
  fillColor = palette.ink,
}: ProgressBarProps) {
  const clamped = Math.max(0, Math.min(1, value));
  return (
    <View
      style={{
        height: 2,
        borderRadius: radius.full,
        backgroundColor: trackColor,
        overflow: "hidden",
      }}
    >
      <View
        style={{
          width: `${clamped * 100}%`,
          height: "100%",
          backgroundColor: fillColor,
        }}
      />
    </View>
  );
}
