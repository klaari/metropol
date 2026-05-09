import { type ReactNode } from "react";
import { Text } from "./Text";
import { VStack } from "./Stack";

interface HeroSectionProps {
  visual?: ReactNode;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  large?: boolean;
}

export function HeroSection({
  visual,
  title,
  subtitle,
  actions,
  large,
}: HeroSectionProps) {
  return (
    <VStack gap="lg" align="center" padY="xl">
      {visual ? <div>{visual}</div> : null}
      <VStack gap="xs" align="center">
        <Text variant={large ? "display" : "titleLg"} align="center">
          {title}
        </Text>
        {subtitle ? (
          <Text variant="caption" tone="muted" align="center">
            {subtitle}
          </Text>
        ) : null}
      </VStack>
      {actions ? <div className="pt-md">{actions}</div> : null}
    </VStack>
  );
}
