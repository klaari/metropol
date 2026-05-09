import { type ButtonHTMLAttributes, type ReactNode } from "react";

type Variant = "plain" | "filled";

interface IconButtonProps
  extends Omit<
    ButtonHTMLAttributes<HTMLButtonElement>,
    "type" | "children" | "style"
  > {
  /** Aria label is required — icon-only buttons need a name. */
  "aria-label": string;
  children: ReactNode;
  variant?: Variant;
  type?: "button" | "submit" | "reset";
}

export function IconButton({
  variant = "plain",
  className,
  children,
  type = "button",
  disabled,
  ...rest
}: IconButtonProps) {
  const isFilled = variant === "filled";
  const parts = [
    "inline-flex items-center justify-center transition-colors",
    isFilled
      ? "w-12 h-12 rounded-full bg-ink text-ink-inverse hover:opacity-90"
      : "w-9 h-9 rounded-md text-ink hover:bg-paper-sunken",
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
      {children}
    </button>
  );
}
