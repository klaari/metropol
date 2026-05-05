import { type ReactNode } from "react";
import { View } from "react-native";
import { layout, palette, space } from "../../design/tokens";
import { Pressable } from "./Pressable";
import { Text } from "./Text";

interface ListRowProps {
  title: string;
  subtitle?: string;
  /** Leading slot — typically artwork (40x40) or an icon. */
  leading?: ReactNode;
  /** Trailing slot — counter, chevron, or single icon button. */
  trailing?: ReactNode;
  onPress?: () => void;
  onLongPress?: () => void;
}

/**
 * The canonical list row. 56px tall, 24px horizontal inset, leading
 * and trailing slots flank a two-line title/subtitle. Use this for
 * tracks, playlists, settings — anything browseable.
 */
export function ListRow({
  title,
  subtitle,
  leading,
  trailing,
  onPress,
  onLongPress,
}: ListRowProps) {
  const Body = (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        minHeight: layout.rowHeight,
        paddingHorizontal: layout.screenInset,
        gap: space.md,
      }}
    >
      {leading ? <View>{leading}</View> : null}
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="bodyStrong" tone="primary" numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text variant="caption" tone="muted" numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {trailing ? <View>{trailing}</View> : null}
    </View>
  );

  if (!onPress && !onLongPress) return Body;

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      flat
      android_ripple={{ color: palette.paperSunken }}
    >
      {Body}
    </Pressable>
  );
}
