import { type ReactNode } from "react";
import { View } from "react-native";
import { layout, palette, space } from "../../design/tokens";
import { IconButton } from "./IconButton";
import { Text } from "./Text";

interface AppBarProps {
  title?: string;
  /**
   * Quieter centered label — rendered in caption + ink-soft. Use when
   * the centered text is contextual (e.g. an album name on the player)
   * rather than the screen's own title.
   */
  subtitle?: string;
  /** Show a back chevron. Triggers `onBack`. */
  onBack?: () => void;
  /** Optional trailing slot — a single icon button. Keep it to one. */
  trailing?: ReactNode;
}

/**
 * The 3-slot top bar: leading icon | centered title | trailing slot.
 * Title is rendered in the body voice, not display — the screen's
 * own hero carries the headline. Use `subtitle` instead of `title`
 * when the centered text is supporting context, not the screen's name.
 */
export function AppBar({ title, subtitle, onBack, trailing }: AppBarProps) {
  return (
    <View
      style={{
        height: layout.controlHeight,
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: space.xs,
      }}
    >
      <View style={{ width: 40, alignItems: "flex-start" }}>
        {onBack ? (
          <IconButton
            icon="chevron-back"
            onPress={onBack}
            accessibilityLabel="Back"
            size={26}
          />
        ) : null}
      </View>
      <View style={{ flex: 1, alignItems: "center" }}>
        {subtitle ? (
          <Text variant="caption" tone="secondary" numberOfLines={1}>
            {subtitle}
          </Text>
        ) : title ? (
          <Text variant="bodyStrong" tone="primary" numberOfLines={1}>
            {title}
          </Text>
        ) : null}
      </View>
      <View style={{ width: 40, alignItems: "flex-end" }}>{trailing}</View>
    </View>
  );
}

/** Subtle hairline that sits beneath an AppBar when content scrolls under it. */
export function AppBarHairline() {
  return (
    <View
      style={{ height: 1, backgroundColor: palette.paperEdge, opacity: 0.7 }}
    />
  );
}
