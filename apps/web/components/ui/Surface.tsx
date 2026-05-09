import { type ReactNode } from "react";

type Tone = "paper" | "raised" | "sunken" | "ink";
type Pad = "none" | "xs" | "sm" | "md" | "base" | "lg" | "xl" | "2xl";
type Rounded = "none" | "sm" | "md" | "lg" | "xl" | "full";
type Lift = "none" | "sheet" | "popover";

const toneClass: Record<Tone, string> = {
  paper: "bg-paper",
  raised: "bg-paper-raised",
  sunken: "bg-paper-sunken",
  ink: "bg-ink text-ink-inverse",
};

const padClass: Record<Pad, string> = {
  none: "",
  xs: "p-xs",
  sm: "p-sm",
  md: "p-md",
  base: "p-base",
  lg: "p-lg",
  xl: "p-xl",
  "2xl": "p-2xl",
};

const roundedClass: Record<Rounded, string> = {
  none: "rounded-none",
  sm: "rounded-sm",
  md: "rounded-md",
  lg: "rounded-lg",
  xl: "rounded-xl",
  full: "rounded-full",
};

const liftClass: Record<Lift, string> = {
  none: "",
  sheet: "shadow-[0_8px_24px_rgba(22,19,14,0.08)]",
  popover: "shadow-[0_12px_32px_rgba(22,19,14,0.12)]",
};

interface SurfaceProps {
  children: ReactNode;
  tone?: Tone;
  pad?: Pad;
  rounded?: Rounded;
  lift?: Lift;
  bordered?: boolean;
  className?: string;
}

export function Surface({
  children,
  tone = "paper",
  pad = "base",
  rounded = "lg",
  lift = "none",
  bordered,
  className,
}: SurfaceProps) {
  const parts = [
    toneClass[tone],
    padClass[pad],
    roundedClass[rounded],
    liftClass[lift],
  ];
  if (bordered) parts.push("border-hair border-paper-edge");
  if (className) parts.push(className);
  return <div className={parts.filter(Boolean).join(" ")}>{children}</div>;
}
