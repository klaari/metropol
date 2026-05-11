import { useEffect, useRef } from "react";
import { Animated, View } from "react-native";
import { palette } from "../../design/tokens";

interface EqProps {
  /** Bar fill colour. Defaults to cobalt — the queue's playing-row accent. */
  color?: string;
  /** When false, bars freeze at their static heights (no animation). */
  playing?: boolean;
  /** Container height in px. Bars scale within this. Default 14. */
  size?: number;
}

const BAR_WIDTH = 2.5;
const BAR_GAP = 2;
const BAR_COUNT = 3;

// Each bar gets its own loop period + height range, so the trio reads as a
// real eq rather than three synced lines. Phase offsets are introduced via
// staggered start delays in the effect.
const RANGES: Array<[number, number]> = [
  [0.3, 0.9],
  [0.8, 0.25],
  [0.55, 1.0],
];

const PERIOD_MS = 900;
const STAGGER_MS = 120;

/**
 * 3-bar mini equalizer. Used in the queue row's trailing slot to indicate
 * the playing track. Animates on the JS thread (height interpolation isn't
 * native-driver compatible) — the surface is small enough that this is
 * imperceptible on real devices.
 */
export function Eq({ color = palette.cobalt, playing = true, size = 14 }: EqProps) {
  const values = useRef(RANGES.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    if (!playing) {
      values.forEach((v) => v.stopAnimation());
      return;
    }
    const loops = values.map((v, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(v, {
            toValue: 1,
            duration: PERIOD_MS / 2,
            useNativeDriver: false,
          }),
          Animated.timing(v, {
            toValue: 0,
            duration: PERIOD_MS / 2,
            useNativeDriver: false,
          }),
        ]),
      ),
    );
    const timeouts = loops.map((loop, i) =>
      setTimeout(() => loop.start(), i * STAGGER_MS),
    );
    return () => {
      timeouts.forEach(clearTimeout);
      loops.forEach((l) => l.stop());
    };
  }, [playing, values]);

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "flex-end",
        gap: BAR_GAP,
        height: size,
        width: BAR_COUNT * BAR_WIDTH + (BAR_COUNT - 1) * BAR_GAP + 2,
      }}
    >
      {values.map((v, i) => {
        const [from, to] = RANGES[i]!;
        const height = v.interpolate({
          inputRange: [0, 1],
          outputRange: [size * from, size * to],
        });
        return (
          <Animated.View
            key={i}
            style={{
              width: BAR_WIDTH,
              height: playing ? height : size * 0.4,
              borderRadius: 1,
              backgroundColor: color,
            }}
          />
        );
      })}
    </View>
  );
}
