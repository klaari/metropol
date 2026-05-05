import { Ionicons } from "@expo/vector-icons";
import type { ComponentProps } from "react";
import { View } from "react-native";
import { icon, layout, palette, space } from "../../design/tokens";
import { IconButton } from "./IconButton";
import { Pressable } from "./Pressable";
import { Switch } from "./Switch";
import { Text } from "./Text";

type IconName = ComponentProps<typeof Ionicons>["name"];

type Trailing =
  | { type: "switch"; value: boolean; onValueChange: (value: boolean) => void; disabled?: boolean }
  | { type: "chevron" }
  | { type: "value"; value: string }
  | { type: "icon"; icon: IconName; onPress: () => void; accessibilityLabel: string };

interface SettingsRowProps {
  title: string;
  subtitle?: string;
  onPress?: () => void;
  trailing?: Trailing;
  tone?: "default" | "destructive" | "informational";
}

function renderTrailing(trailing?: Trailing) {
  if (!trailing) return null;
  switch (trailing.type) {
    case "switch":
      return (
        <Switch
          value={trailing.value}
          onValueChange={trailing.onValueChange}
          disabled={trailing.disabled}
          accessibilityLabel="Toggle setting"
        />
      );
    case "chevron":
      return <Ionicons name="chevron-forward" size={icon.size.base} color={palette.inkMuted} />;
    case "value":
      return (
        <Text variant="numeric" tone="muted" numberOfLines={1}>
          {trailing.value}
        </Text>
      );
    case "icon":
      return (
        <IconButton
          icon={trailing.icon}
          onPress={trailing.onPress}
          accessibilityLabel={trailing.accessibilityLabel}
        />
      );
  }
}

/** Settings-specific row with fixed trailing affordance variants. */
export function SettingsRow({
  title,
  subtitle,
  onPress,
  trailing,
  tone = "default",
}: SettingsRowProps) {
  const body = (
    <View
      style={{
        minHeight: layout.rowHeight,
        paddingVertical: space.sm,
        flexDirection: "row",
        alignItems: "center",
        gap: space.md,
      }}
    >
      <View style={{ flex: 1, gap: space.xs }}>
        <Text
          variant="bodyStrong"
          tone={tone === "destructive" ? "critical" : "primary"}
          numberOfLines={1}
        >
          {title}
        </Text>
        {subtitle ? (
          <Text variant="caption" tone="muted" numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {renderTrailing(trailing)}
    </View>
  );

  if (!onPress || tone === "informational") return body;

  return (
    <Pressable
      onPress={onPress}
      flat
      android_ripple={{ color: palette.paperSunken }}
    >
      {body}
    </Pressable>
  );
}
