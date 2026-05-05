import { type ReactNode } from "react";
import { VStack } from "./Stack";
import { Text } from "./Text";
import type { SpaceKey } from "../../design/tokens";

interface HeroSectionProps {
  /** The dominant visual — artwork, illustration, or large numeric. */
  visual?: ReactNode;
  /** Hero headline. Rendered in `display` if `large`, otherwise `titleLg`. */
  title: string;
  /** Optional supporting line (artist, subtitle, byline). */
  subtitle?: string;
  /** Action cluster placed below the subtitle (e.g. play + queue + share). */
  actions?: ReactNode;
  /** Use `display` voice and ceremonial spacing. At most once per screen. */
  large?: boolean;
  /** Gap between the visual and the text. Defaults to `lg`. */
  visualGap?: SpaceKey;
}

/**
 * The one ceremonial moment per screen. Centered visual, headline, optional
 * subtitle, optional action cluster. Everything else on the screen is
 * supporting matter — smaller, dimmer.
 *
 * Reserves vertical breathing room above and below; do NOT wrap in extra
 * padding. If a screen has no hero, omit this primitive entirely.
 */
export function HeroSection({
  visual,
  title,
  subtitle,
  actions,
  large,
  visualGap = "lg",
}: HeroSectionProps) {
  return (
    <VStack gap={visualGap} align="center" padY="xl">
      {visual ? visual : null}
      <VStack gap="xs" align="center">
        <Text
          variant={large ? "display" : "titleLg"}
          tone="primary"
          align="center"
        >
          {title}
        </Text>
        {subtitle ? (
          <Text variant="caption" tone="muted" align="center">
            {subtitle}
          </Text>
        ) : null}
      </VStack>
      {actions ? <VStack padY="md">{actions}</VStack> : null}
    </VStack>
  );
}
