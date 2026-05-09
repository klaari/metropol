import { type ReactNode } from "react";
import { HStack } from "./Stack";

type Space = "none" | "xs" | "sm" | "md" | "base" | "lg";
type Justify = "start" | "between" | "center" | "end";
type Align = "start" | "center" | "end" | "baseline";

interface InlineProps {
  children: ReactNode;
  gap?: Space;
  justify?: Justify;
  align?: Align;
}

export function Inline({
  children,
  gap = "sm",
  justify = "between",
  align = "center",
}: InlineProps) {
  return (
    <HStack gap={gap} justify={justify} align={align}>
      {children}
    </HStack>
  );
}
