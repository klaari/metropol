import { type ComponentPropsWithRef } from "react";

type Variant = "default" | "search" | "password";

type NativeInputProps = Omit<ComponentPropsWithRef<"input">, "size" | "style">;

interface InputProps extends NativeInputProps {
  variant?: Variant;
}

export function Input({ variant = "default", className, type, ...rest }: InputProps) {
  const resolvedType =
    type ?? (variant === "password" ? "password" : variant === "search" ? "search" : "text");

  const base =
    "w-full h-12 px-base rounded-lg bg-paper-raised text-ink placeholder:text-ink-faint border-hair border-paper-edge focus:outline-none focus:border-ink transition-colors text-body";

  return (
    <input
      type={resolvedType}
      className={`${base}${className ? ` ${className}` : ""}`}
      // Cast: workspace has duplicate @types/react versions (19.1 from
      // mobile, 19.2 from web) which produces a spurious ref-type
      // mismatch on a clean spread. Functionally fine.
      {...(rest as React.InputHTMLAttributes<HTMLInputElement>)}
    />
  );
}
