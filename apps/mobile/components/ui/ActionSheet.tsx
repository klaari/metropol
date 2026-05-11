import { Ionicons } from "@expo/vector-icons";
import { type ComponentProps } from "react";
import { Modal, Pressable as RNPressable, View } from "react-native";
import { palette, radius, space } from "../../design/tokens";
import { Pressable } from "./Pressable";
import { Text } from "./Text";

type IconName = ComponentProps<typeof Ionicons>["name"];

export interface ActionItem {
  icon: IconName;
  label: string;
  onPress: () => void;
  /** Renders the row in critical (red) — for delete / remove actions. */
  destructive?: boolean;
}

interface ActionSheetProps {
  visible: boolean;
  onClose: () => void;
  /** Optional header title (e.g. row title for a context menu). */
  title?: string;
  /** Optional header subtitle (e.g. artist). */
  subtitle?: string;
  actions: ActionItem[];
}

/**
 * Bottom-sheet context menu — drag-handle pill, optional title/subtitle
 * header with a hairline beneath, then a list of icon+label actions.
 * Tapping any action runs its handler and closes the sheet. Tapping the
 * dimmed backdrop also closes.
 */
export function ActionSheet({
  visible,
  onClose,
  title,
  subtitle,
  actions,
}: ActionSheetProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={{ flex: 1 }}>
        <RNPressable
          accessibilityLabel="Close sheet"
          onPress={onClose}
          style={{
            flex: 1,
            backgroundColor: "rgba(22,19,14,0.32)",
          }}
        />
        <View
          style={{
            backgroundColor: palette.paper,
            borderTopLeftRadius: radius.xl,
            borderTopRightRadius: radius.xl,
            paddingTop: space.lg,
            paddingHorizontal: space.base,
            paddingBottom: space.xl,
          }}
        >
          <View
            style={{
              alignSelf: "center",
              width: space.xl + space.xs,
              height: space.xs,
              borderRadius: radius.full,
              backgroundColor: palette.paperEdge,
              marginBottom: space.md,
            }}
          />

          {(title || subtitle) && (
            <View
              style={{
                paddingBottom: space.sm,
                marginBottom: space.sm,
                borderBottomWidth: 1,
                borderBottomColor: palette.paperEdge,
                gap: 2,
              }}
            >
              {title ? (
                <Text variant="bodyStrong" numberOfLines={1}>
                  {title}
                </Text>
              ) : null}
              {subtitle ? (
                <Text variant="caption" tone="muted" numberOfLines={1}>
                  {subtitle}
                </Text>
              ) : null}
            </View>
          )}

          {actions.map((a, i) => (
            <Pressable
              key={i}
              accessibilityLabel={a.label}
              accessibilityRole="button"
              onPress={() => {
                a.onPress();
                onClose();
              }}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: space.md,
                paddingVertical: space.md,
                paddingHorizontal: space.sm,
              }}
            >
              <Ionicons
                name={a.icon}
                size={20}
                color={a.destructive ? palette.critical : palette.ink}
              />
              <Text
                variant="body"
                tone={a.destructive ? "critical" : "primary"}
                style={{ fontWeight: "500" }}
              >
                {a.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>
    </Modal>
  );
}
