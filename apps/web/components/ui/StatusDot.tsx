type Tone = "positive" | "warning" | "critical" | "muted" | "accent";

const toneClass: Record<Tone, string> = {
  positive: "bg-positive",
  warning: "bg-warning",
  critical: "bg-critical",
  muted: "bg-ink-faint",
  accent: "bg-cobalt",
};

export function StatusDot({ tone = "muted" }: { tone?: Tone }) {
  return (
    <span
      aria-hidden
      className={`inline-block w-[8px] h-[8px] rounded-full ${toneClass[tone]}`}
    />
  );
}
