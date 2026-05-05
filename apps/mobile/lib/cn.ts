/**
 * Conditional className concatenation. Lightweight clsx — no dependency.
 *
 * Use inside primitives to compose static + variant + state classes.
 * Outside primitives, screens should not normally hand-write className
 * strings; they compose primitives by passing typed props.
 */
type ClassValue = string | number | false | null | undefined | ClassValue[];

export function cn(...inputs: ClassValue[]): string {
  const out: string[] = [];
  for (const v of inputs) {
    if (!v) continue;
    if (typeof v === "string") out.push(v);
    else if (typeof v === "number") out.push(String(v));
    else if (Array.isArray(v)) {
      const inner = cn(...v);
      if (inner) out.push(inner);
    }
  }
  return out.join(" ");
}
