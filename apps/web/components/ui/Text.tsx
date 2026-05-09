import { type CSSProperties, type ElementType, type ReactNode } from "react";

type Variant =
  | "eyebrow"
  | "caption"
  | "body"
  | "bodyStrong"
  | "bodyLg"
  | "title"
  | "titleLg"
  | "display"
  | "numeric";

type Tone =
  | "primary"
  | "secondary"
  | "muted"
  | "faint"
  | "inverse"
  | "accent"
  | "positive"
  | "warning"
  | "critical";

const variantClass: Record<Variant, string> = {
  eyebrow:
    "text-eyebrow font-semibold uppercase tracking-eyebrow",
  caption: "text-caption font-regular",
  body: "text-body font-regular",
  bodyStrong: "text-body font-semibold",
  bodyLg: "text-body-lg font-regular",
  title: "text-title font-semibold",
  titleLg: "text-title-lg font-bold",
  display: "text-display font-bold",
  numeric: "text-caption font-medium tabular-nums",
};

const toneClass: Record<Tone, string> = {
  primary: "text-ink",
  secondary: "text-ink-soft",
  muted: "text-ink-muted",
  faint: "text-ink-faint",
  inverse: "text-ink-inverse",
  accent: "text-cobalt",
  positive: "text-positive",
  warning: "text-warning",
  critical: "text-critical",
};

interface TextProps {
  children: ReactNode;
  variant?: Variant;
  tone?: Tone;
  align?: "left" | "center" | "right";
  numeric?: boolean;
  italic?: boolean;
  className?: string;
  style?: CSSProperties;
  as?: ElementType;
  numberOfLines?: number;
  title?: string;
}

const alignClass = {
  left: "text-left",
  center: "text-center",
  right: "text-right",
} as const;

const defaultElement: Record<Variant, ElementType> = {
  eyebrow: "p",
  caption: "p",
  body: "p",
  bodyStrong: "p",
  bodyLg: "p",
  title: "h2",
  titleLg: "h1",
  display: "h1",
  numeric: "span",
};

export function Text({
  children,
  variant = "body",
  tone = "primary",
  align,
  numeric,
  italic,
  className,
  style,
  as,
  numberOfLines,
  title,
}: TextProps) {
  const Element = as ?? defaultElement[variant];
  const truncateStyle: CSSProperties | undefined = numberOfLines
    ? numberOfLines === 1
      ? {
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }
      : {
          display: "-webkit-box",
          WebkitLineClamp: numberOfLines,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
        }
    : undefined;

  const numericClass =
    numeric && variant !== "numeric" ? " tabular-nums" : "";
  const italicClass = italic ? " italic" : "";

  return (
    <Element
      title={title}
      className={`${variantClass[variant]} ${toneClass[tone]}${
        align ? ` ${alignClass[align]}` : ""
      }${numericClass}${italicClass}${className ? ` ${className}` : ""}`}
      style={{ ...truncateStyle, ...style }}
    >
      {children}
    </Element>
  );
}
