import { type ReactNode } from "react";
import { HStack } from "./Stack";
import type { SpaceKey } from "../../design/tokens";

interface InlineProps {
  children: ReactNode;
  /** Gap between siblings. Defaults to `sm`. */
  gap?: SpaceKey;
  /** Defaults to space-between — the canonical "label · value" layout. */
  justify?: "start" | "between" | "center" | "end";
  /** Cross-axis alignment. Defaults to centre, matching HStack. */
  align?: "start" | "center" | "end" | "baseline";
  padY?: SpaceKey;
}

/**
 * A non-wrapping horizontal row. Defaults to `justify="between"` — the
 * canonical "label on the left, value/chevron on the right" pattern used in
 * settings, metadata tables, and inline statistics.
 *
 * Reach for HStack when you need explicit alignment control or when the
 * row is decorative (icon clusters, transport controls). Reach for Cluster
 * when items should wrap.
 */
export function Inline({
  children,
  gap = "sm",
  justify = "between",
  align = "center",
  padY,
}: InlineProps) {
  return (
    <HStack gap={gap} justify={justify} align={align} padY={padY}>
      {children}
    </HStack>
  );
}
