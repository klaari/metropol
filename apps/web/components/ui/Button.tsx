import { type ButtonHTMLAttributes, type ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost" | "destructive";
type Size = "sm" | "md";

const variantClass: Record<Variant, string> = {
  primary:
    "bg-ink text-ink-inverse hover:opacity-90 active:opacity-80 transition-opacity",
  secondary:
    "bg-paper text-ink border-hair border-ink hover:bg-paper-sunken transition-colors",
  ghost:
    "bg-transparent text-ink hover:bg-paper-sunken transition-colors",
  destructive:
    "bg-critical text-ink-inverse hover:opacity-90 active:opacity-80 transition-opacity",
};

const sizeClass: Record<Size, string> = {
  sm: "h-9 px-md text-caption",
  md: "h-12 px-lg text-body font-semibold",
};

interface ButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "type" | "style"> {
  label: string;
  variant?: Variant;
  size?: Size;
  block?: boolean;
  leading?: ReactNode;
  type?: "button" | "submit" | "reset";
}

export function Button({
  label,
  variant = "primary",
  size = "md",
  block,
  leading,
  className,
  type = "button",
  disabled,
  ...rest
}: ButtonProps) {
  const parts = [
    "inline-flex items-center justify-center gap-sm rounded-full font-semibold",
    variantClass[variant],
    sizeClass[size],
    block ? "w-full" : "self-start",
    disabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer",
  ];
  if (className) parts.push(className);
  return (
    <button
      type={type}
      disabled={disabled}
      className={parts.join(" ")}
      {...rest}
    >
      {leading ? <span className="flex items-center">{leading}</span> : null}
      <span>{label}</span>
    </button>
  );
}
