import { type ReactNode } from "react";
import { VStack } from "./Stack";
import { Text } from "./Text";
import type { SpaceKey } from "../../design/tokens";

interface PageSectionProps {
  children: ReactNode;
  /** Optional eyebrow label rendered above the title (UPPERCASE, tracked). */
  eyebrow?: string;
  /** Optional section title in `title` voice. */
  title?: string;
  /** Trailing slot rendered to the right of the title (e.g. a "See all" link). */
  trailing?: ReactNode;
  /** Gap between the header (eyebrow/title) and the section body. Defaults to `base`. */
  headerGap?: SpaceKey;
  /** Gap between section children. Defaults to `lg`. */
  gap?: SpaceKey;
}

/**
 * A top-level section inside a Screen. Owns:
 *   - section header (eyebrow + title + trailing slot, all optional)
 *   - the rhythm between its children (`gap`)
 *
 * Use one PageSection per logical chunk of a screen. Sections are
 * separated by the parent's `gap="xl"` (set by the Screen / outer VStack).
 * Do NOT add margin to a PageSection — outer rhythm is the parent's job.
 */
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
            <VStack
              gap="none"
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              {title ? (
                <Text variant="title" tone="primary">
                  {title}
                </Text>
              ) : null}
              {trailing ? trailing : null}
            </VStack>
          ) : null}
        </VStack>
      ) : null}
      <VStack gap={gap}>{children}</VStack>
    </VStack>
  );
}
