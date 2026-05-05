import type { ReactNode } from "react";
import { ScrollView, View, type ViewStyle } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { layout, palette } from "../../design/tokens";

interface ScreenProps {
  children: ReactNode;
  /** Defaults to true. Disable when the screen has a sticky bottom bar. */
  scroll?: boolean;
  /** Apply the canonical screen edge inset. Defaults to true. */
  inset?: boolean;
  /** Override the surface tint — use sparingly (e.g. ink-themed sheets). */
  surface?: "paper" | "paperRaised" | "ink";
  /** Bottom-edge content (sticky). */
  footer?: ReactNode;
}

const surfaceColor = {
  paper: palette.paper,
  paperRaised: palette.paperRaised,
  ink: palette.ink,
} as const;

/**
 * The screen wrapper. Owns safe-area insets, page padding, and surface
 * tint. Every route renders inside one of these — that is what gives
 * the app its consistent rhythm.
 */
export function Screen({
  children,
  scroll = true,
  inset = true,
  surface = "paper",
  footer,
}: ScreenProps) {
  const bg = surfaceColor[surface];
  const padStyle: ViewStyle = inset
    ? { paddingHorizontal: layout.screenInset }
    : {};

  const body = scroll ? (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={[{ paddingBottom: layout.sectionGap }, padStyle]}
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[{ flex: 1 }, padStyle]}>{children}</View>
  );

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: bg }}
      edges={["top", "left", "right"]}
    >
      {body}
      {footer ? (
        <SafeAreaView edges={["bottom"]} style={{ backgroundColor: bg }}>
          {footer}
        </SafeAreaView>
      ) : null}
    </SafeAreaView>
  );
}
