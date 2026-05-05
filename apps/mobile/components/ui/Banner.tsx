import type { ReactNode } from "react";
import { View } from "react-native";
import { palette, radius, space } from "../../design/tokens";
import { IconButton } from "./IconButton";
import { Surface } from "./Surface";
import { HStack, VStack } from "./Stack";
import { Text } from "./Text";

type BannerTone = "info" | "success" | "warning" | "critical";

interface BannerProps {
  title: string;
  message?: string;
  tone?: BannerTone;
  onDismiss?: () => void;
  children?: ReactNode;
}

const accent = {
  info: palette.cobalt,
  success: palette.positive,
  warning: palette.warning,
  critical: palette.critical,
} as const;

/** Pinned notification surface for status banners and toasts. */
export function Banner({
  title,
  message,
  tone = "info",
  onDismiss,
  children,
}: BannerProps) {
  return (
    <Surface tone="raised" lift="sheet" rounded="lg" pad="base" bordered>
      <HStack gap="md" align="stretch">
        <View
          style={{
            width: space.xs,
            borderRadius: radius.full,
            backgroundColor: accent[tone],
          }}
        />
        <VStack gap="xs" flex>
          <Text variant="bodyStrong" tone="primary">
            {title}
          </Text>
          {message ? (
            <Text variant="caption" tone="muted">
              {message}
            </Text>
          ) : null}
          {children}
        </VStack>
        {onDismiss ? (
          <IconButton
            icon="close"
            accessibilityLabel="Dismiss"
            onPress={onDismiss}
            color={palette.inkMuted}
          />
        ) : null}
      </HStack>
    </Surface>
  );
}

export const Toast = Banner;
