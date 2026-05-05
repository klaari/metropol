import { View, type ViewStyle } from "react-native";
import { layout, palette, radius, space } from "../../design/tokens";
import { Pressable } from "./Pressable";
import { Text } from "./Text";

type Variant = "primary" | "secondary" | "ghost" | "destructive";
type Size = "sm" | "md";

interface ButtonProps {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  size?: Size;
  disabled?: boolean;
  /** Stretch to fill horizontally. Buttons should not be full-width by default. */
  block?: boolean;
  /** Optional leading element (icon). */
  leading?: React.ReactNode;
}

/**
 * Button. Three variants — primary (ink-on-paper), secondary (paper-on-ink
 * outline), ghost (text-only). Use destructive only for irreversible actions
 * the user might regret.
 */
export function Button({
  label,
  onPress,
  variant = "primary",
  size = "md",
  disabled,
  block,
  leading,
}: ButtonProps) {
  const height = size === "sm" ? layout.controlHeightSm : layout.controlHeight;
  const padX = size === "sm" ? space.md : space.lg;

  const surface: ViewStyle = (() => {
    switch (variant) {
      case "primary":
        return { backgroundColor: palette.ink };
      case "secondary":
        return {
          backgroundColor: palette.paper,
          borderWidth: 1,
          borderColor: palette.ink,
        };
      case "ghost":
        return { backgroundColor: palette.transparent };
      case "destructive":
        return { backgroundColor: palette.critical };
    }
  })();

  const tone =
    variant === "primary" || variant === "destructive"
      ? "inverse"
      : "primary";

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={{
        height,
        paddingHorizontal: padX,
        borderRadius: radius.full,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: space.sm,
        opacity: disabled ? 0.4 : 1,
        alignSelf: block ? "stretch" : "flex-start",
        ...surface,
      }}
    >
      {leading ? <View>{leading}</View> : null}
      <Text variant={size === "sm" ? "caption" : "bodyStrong"} tone={tone}>
        {label}
      </Text>
    </Pressable>
  );
}
