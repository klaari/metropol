import { Ionicons } from "@expo/vector-icons";
import { type ComponentProps } from "react";
import { layout, palette, radius } from "../../design/tokens";
import { Pressable } from "./Pressable";

type IconName = ComponentProps<typeof Ionicons>["name"];
type Variant = "plain" | "filled";

interface IconButtonProps {
  icon: IconName;
  onPress?: () => void;
  /** Defaults to "plain" — bare icon, no surface. Use "filled" once per screen for the primary action. */
  variant?: Variant;
  /** Pixel size of the glyph. Defaults to 24 (icon.md). */
  size?: number;
  /** Override icon color. Defaults to ink (or paper on filled). */
  color?: string;
  accessibilityLabel: string;
  disabled?: boolean;
}

/**
 * Icon-only button. The "filled" variant is the editorial accent — there
 * should be at most one per screen (the play button on the player). Every
 * other interactive icon uses "plain".
 */
export function IconButton({
  icon,
  onPress,
  variant = "plain",
  size = 24,
  color,
  accessibilityLabel,
  disabled,
}: IconButtonProps) {
  const isFilled = variant === "filled";
  const dimension = isFilled ? layout.controlHeight : layout.controlHeightSm;
  const tint =
    color ?? (isFilled ? palette.inkInverse : palette.ink);

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      flat={!isFilled}
      style={{
        width: dimension,
        height: dimension,
        borderRadius: isFilled ? radius.full : radius.md,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: isFilled ? palette.ink : palette.transparent,
        opacity: disabled ? 0.35 : 1,
      }}
    >
      <Ionicons name={icon} size={size} color={tint} />
    </Pressable>
  );
}
