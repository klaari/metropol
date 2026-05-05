import { Text as RNText, type TextProps as RNTextProps, type TextStyle } from "react-native";
import { palette, type, type TypeVariant } from "../../design/tokens";

type Tone =
  | "primary"     // ink
  | "secondary"   // ink-soft
  | "muted"       // ink-muted
  | "faint"       // ink-faint
  | "inverse"     // ink-inverse
  | "accent"      // cobalt
  | "positive"
  | "warning"
  | "critical";

const toneToColor: Record<Tone, string> = {
  primary: palette.ink,
  secondary: palette.inkSoft,
  muted: palette.inkMuted,
  faint: palette.inkFaint,
  inverse: palette.inkInverse,
  accent: palette.cobalt,
  positive: palette.positive,
  warning: palette.warning,
  critical: palette.critical,
};

export interface TextProps extends RNTextProps {
  /** Type variant — pulls a complete recipe (size + line-height + tracking + weight). */
  variant?: TypeVariant;
  /** Semantic color tone. Defaults to `primary`. */
  tone?: Tone;
  /** Override alignment. */
  align?: TextStyle["textAlign"];
  /** Tabular numerics for time/percent/BPM. */
  numeric?: boolean;
  /** Italicize — rare; reserved for credits/attribution. */
  italic?: boolean;
}

/**
 * The only text primitive. Never use bare <Text> from react-native — it
 * lets the type ladder drift. If you need a variant we don't have, add it
 * to `type` in tokens.ts first.
 */
export function Text({
  variant = "body",
  tone = "primary",
  align,
  numeric,
  italic,
  style,
  ...rest
}: TextProps) {
  const recipe = type[variant];
  const composed: TextStyle = {
    ...recipe,
    color: toneToColor[tone],
    ...(align ? { textAlign: align } : null),
    ...(italic ? { fontStyle: "italic" } : null),
    ...(numeric || variant === "numeric"
      ? { fontVariant: ["tabular-nums"] }
      : null),
  };
  return <RNText {...rest} style={[composed, style]} />;
}
