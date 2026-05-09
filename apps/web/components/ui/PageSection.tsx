import { type ReactNode } from "react";
import { Text } from "./Text";
import { VStack } from "./Stack";

type Space =
  | "none"
  | "xs"
  | "sm"
  | "md"
  | "base"
  | "lg"
  | "xl"
  | "2xl";

interface PageSectionProps {
  children: ReactNode;
  eyebrow?: string;
  title?: string;
  trailing?: ReactNode;
  headerGap?: Space;
  gap?: Space;
}

export function PageSection({
  children,
  eyebrow,
  title,
  trailing,
  headerGap = "base",
  gap = "lg",
}: PageSectionProps) {
  const hasHeader = eyebrow || title || trailing;
  return (
    <VStack gap={hasHeader ? headerGap : undefined}>
      {hasHeader ? (
        <VStack gap="xs">
          {eyebrow ? (
            <Text variant="eyebrow" tone="muted">
              {eyebrow}
            </Text>
          ) : null}
          {title || trailing ? (
            <div className="flex items-center justify-between">
              {title ? (
                <Text variant="title" tone="primary">
                  {title}
                </Text>
              ) : (
                <span />
              )}
              {trailing ? <div>{trailing}</div> : null}
            </div>
          ) : null}
        </VStack>
      ) : null}
      <VStack gap={gap}>{children}</VStack>
    </VStack>
  );
}
