import { type ReactNode } from "react";
import { VStack } from "./Stack";
import type { SpaceKey } from "../../design/tokens";

interface ContentBlockProps {
  children: ReactNode;
  /** Vertical rhythm between this block's children. Defaults to `base`. */
  gap?: SpaceKey;
  /** Optional padding inside the block. Defaults to none — most blocks
   * inherit padding from the surrounding Screen / Surface. */
  pad?: SpaceKey;
}

/**
 * A semantic vertical block within a PageSection — one cohesive idea
 * (a paragraph, a control cluster, a metadata table). Use this in JSX
 * where structure benefits from being self-documenting; reach for plain
 * VStack when the grouping is incidental.
 *
 * ContentBlock owns its inner gap; it never reaches outside its bounds.
 */
export function ContentBlock({
  children,
  gap = "base",
  pad,
}: ContentBlockProps) {
  return <VStack gap={gap} pad={pad}>{children}</VStack>;
}
