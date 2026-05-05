import { useRef } from "react";
import {
  Animated,
  Pressable as RNPressable,
  type PressableProps as RNPressableProps,
  type ViewStyle,
} from "react-native";
import { motion } from "../../design/tokens";

interface PressableProps extends RNPressableProps {
  /** Disable the press-scale animation (for full-bleed list rows etc.). */
  flat?: boolean;
  style?: ViewStyle | ViewStyle[];
}

/**
 * The interaction primitive. Wraps RN's Pressable with the canonical
 * press feedback: subtle scale + opacity, never a color flash. Use this
 * for every tappable control — never bare RNPressable.
 */
export function Pressable({
  flat,
  style,
  onPressIn,
  onPressOut,
  children,
  hitSlop = motion.press.scale ? 8 : undefined,
  ...rest
}: PressableProps) {
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(1)).current;

  const animateIn = () => {
    if (flat) return;
    Animated.parallel([
      Animated.timing(scale, {
        toValue: motion.press.scale,
        duration: motion.duration.instant,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: motion.press.opacity,
        duration: motion.duration.instant,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const animateOut = () => {
    if (flat) return;
    Animated.parallel([
      Animated.timing(scale, {
        toValue: 1,
        duration: motion.duration.fast,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: motion.duration.fast,
        useNativeDriver: true,
      }),
    ]).start();
  };

  return (
    <Animated.View style={{ transform: [{ scale }], opacity }}>
      <RNPressable
        {...rest}
        hitSlop={hitSlop}
        onPressIn={(e) => {
          animateIn();
          onPressIn?.(e);
        }}
        onPressOut={(e) => {
          animateOut();
          onPressOut?.(e);
        }}
        style={style}
      >
        {children}
      </RNPressable>
    </Animated.View>
  );
}
