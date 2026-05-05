import { type ReactNode } from "react";
import { View, type ViewStyle } from "react-native";
import {
  elevation,
  palette,
  radius,
  space,
  type SpaceKey,
} from "../../design/tokens";

interface SurfaceProps {
  children: ReactNode;
  /** Visual surface tint. Defaults to paper (i.e. inherit from screen). */
  tone?: "paper" | "raised" | "sunken" | "ink";
  /** Padding inside the surface. */
  pad?: SpaceKey;
  /** Border-radius level. Defaults to `lg`. */
  rounded?: keyof typeof radius;
  /** Drop-shadow level. Defaults to none. */
  lift?: "none" | "sheet" | "popover";
  /** 1px hairline border. */
  bordered?: boolean;
  style?: ViewStyle;
}

const toneColor = {
  paper: palette.paper,
  raised: palette.paperRaised,
  sunken: palette.paperSunken,
  ink: palette.ink,
} as const;

/**
 * A grouping container. Use for cards, sheets, callouts. Most surfaces
 * are flat — `lift` is for popovers and modals only.
 */
export function Surface({
  children,
  tone = "paper",
  pad = "base",
  rounded = "lg",
  lift = "none",
  bordered,
  style,
}: SurfaceProps) {
  return (
    <View
      style={[
        {
          backgroundColor: toneColor[tone],
          borderRadius: radius[rounded],
          padding: space[pad],
          ...(bordered
            ? { borderWidth: 1, borderColor: palette.paperEdge }
            : null),
          ...elevation[lift],
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}
