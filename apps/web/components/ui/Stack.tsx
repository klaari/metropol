import { type ReactNode } from "react";

type Space =
  | "none"
  | "hair"
  | "xs"
  | "sm"
  | "md"
  | "base"
  | "lg"
  | "xl"
  | "2xl"
  | "3xl"
  | "4xl";

type Align = "start" | "center" | "end" | "stretch" | "baseline";
type Justify = "start" | "center" | "end" | "between" | "around" | "evenly";

const gapClass: Record<Space, string> = {
  none: "gap-0",
  hair: "gap-hair",
  xs: "gap-xs",
  sm: "gap-sm",
  md: "gap-md",
  base: "gap-base",
  lg: "gap-lg",
  xl: "gap-xl",
  "2xl": "gap-2xl",
  "3xl": "gap-3xl",
  "4xl": "gap-4xl",
};

const padClass: Record<Space, string> = {
  none: "p-0",
  hair: "p-hair",
  xs: "p-xs",
  sm: "p-sm",
  md: "p-md",
  base: "p-base",
  lg: "p-lg",
  xl: "p-xl",
  "2xl": "p-2xl",
  "3xl": "p-3xl",
  "4xl": "p-4xl",
};

const padXClass: Record<Space, string> = {
  none: "px-0",
  hair: "px-hair",
  xs: "px-xs",
  sm: "px-sm",
  md: "px-md",
  base: "px-base",
  lg: "px-lg",
  xl: "px-xl",
  "2xl": "px-2xl",
  "3xl": "px-3xl",
  "4xl": "px-4xl",
};

const padYClass: Record<Space, string> = {
  none: "py-0",
  hair: "py-hair",
  xs: "py-xs",
  sm: "py-sm",
  md: "py-md",
  base: "py-base",
  lg: "py-lg",
  xl: "py-xl",
  "2xl": "py-2xl",
  "3xl": "py-3xl",
  "4xl": "py-4xl",
};

const alignClass: Record<Align, string> = {
  start: "items-start",
  center: "items-center",
  end: "items-end",
  stretch: "items-stretch",
  baseline: "items-baseline",
};

const justifyClass: Record<Justify, string> = {
  start: "justify-start",
  center: "justify-center",
  end: "justify-end",
  between: "justify-between",
  around: "justify-around",
  evenly: "justify-evenly",
};

interface StackProps {
  children: ReactNode;
  gap?: Space;
  align?: Align;
  justify?: Justify;
  pad?: Space;
  padX?: Space;
  padY?: Space;
  flex?: boolean;
  className?: string;
}

function buildClass(
  direction: "row" | "col",
  { gap, align, justify, pad, padX, padY, flex, className }: StackProps,
): string {
  const parts: string[] = [direction === "row" ? "flex" : "flex flex-col"];
  if (flex) parts.push("flex-1");
  if (gap !== undefined) parts.push(gapClass[gap]);
  if (align) parts.push(alignClass[align]);
  if (justify) parts.push(justifyClass[justify]);
  if (pad) parts.push(padClass[pad]);
  if (padX) parts.push(padXClass[padX]);
  if (padY) parts.push(padYClass[padY]);
  if (className) parts.push(className);
  return parts.join(" ");
}

export function VStack(props: StackProps) {
  return <div className={buildClass("col", props)}>{props.children}</div>;
}

export function HStack(props: StackProps) {
  const { align } = props;
  const className = buildClass("row", {
    ...props,
    align: align ?? "center",
  });
  return <div className={className}>{props.children}</div>;
}
