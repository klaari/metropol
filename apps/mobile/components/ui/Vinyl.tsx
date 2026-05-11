import { useEffect, useRef } from "react";
import { Animated, Easing, View } from "react-native";
import { palette, radius, space } from "../../design/tokens";
import { Text } from "./Text";

interface VinylProps {
  /** Diameter in px. Default 280 — matches the player hero. */
  size?: number;
  /** When true, the disc rotates once every 6s. Pauses when false. */
  playing?: boolean;
  /** Optional accent override. Defaults to cobalt. */
  accent?: string;
  /** Disable rotation entirely (e.g. reduced-motion contexts). */
  spin?: boolean;
}

const GROOVES = [0.94, 0.84, 0.72, 0.58] as const;
const LABEL_PCT = 0.42;
const ROTATION_MS = 6000;

/**
 * The vinyl record artwork — flat fill, hairline grooves, paper label
 * disc, ink spindle hole. One full rotation per 6s while playing, frozen
 * otherwise. This is the only sanctioned continuous motion on the surface
 * (see UI_RULES §7).
 */
export function Vinyl({
  size = 280,
  playing = false,
  accent = palette.cobalt,
  spin = true,
}: VinylProps) {
  const rotation = useRef(new Animated.Value(0)).current;
  const animationRef = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    if (!playing || !spin) {
      animationRef.current?.stop();
      animationRef.current = null;
      return;
    }
    const loop = Animated.loop(
      Animated.timing(rotation, {
        toValue: 1,
        duration: ROTATION_MS,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    animationRef.current = loop;
    loop.start();
    return () => {
      loop.stop();
    };
  }, [playing, spin, rotation]);

  const spinTransform = rotation.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  const labelSize = size * LABEL_PCT;

  return (
    <Animated.View
      style={{
        width: size,
        height: size,
        borderRadius: radius.full,
        backgroundColor: accent,
        alignItems: "center",
        justifyContent: "center",
        transform: [{ rotate: spinTransform }],
      }}
    >
      {GROOVES.map((p) => (
        <View
          key={p}
          pointerEvents="none"
          style={{
            position: "absolute",
            width: size * p,
            height: size * p,
            borderRadius: radius.full,
            borderWidth: 1,
            borderColor: "rgba(248,244,236,0.10)",
          }}
        />
      ))}

      {/* reflective flecks — small rotated highlights on the outer rim */}
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          left: size * 0.74,
          top: size * 0.22,
          width: 16,
          height: 4,
          borderRadius: 1.5,
          backgroundColor: "rgba(248,244,236,0.85)",
          transform: [{ rotate: "38deg" }],
        }}
      />
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          left: size * 0.22,
          top: size * 0.76,
          width: 12,
          height: 4,
          borderRadius: 1.5,
          backgroundColor: "rgba(248,244,236,0.70)",
          transform: [{ rotate: "-22deg" }],
        }}
      />

      {/* paper label disc */}
      <View
        style={{
          width: labelSize,
          height: labelSize,
          borderRadius: radius.full,
          backgroundColor: palette.paperRaised,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text
          variant="eyebrow"
          tone="accent"
          style={{ fontSize: 8.5, letterSpacing: 1.4, color: accent }}
        >
          AANI · SIDE A
        </Text>
        <Text
          variant="bodyStrong"
          style={{ fontSize: 11, marginTop: 2 }}
        >
          1959
        </Text>
        <Text
          variant="eyebrow"
          tone="muted"
          style={{ fontSize: 8.5, letterSpacing: 1.4, marginTop: 2 }}
        >
          33⅓ RPM
        </Text>
      </View>

      {/* ink spindle hole */}
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          width: space.sm + 1,
          height: space.sm + 1,
          borderRadius: radius.full,
          backgroundColor: palette.ink,
        }}
      />
    </Animated.View>
  );
}
