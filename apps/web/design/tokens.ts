/**
 * Web design tokens — TypeScript surface for code that can't (or
 * shouldn't) reach for className strings, e.g. inline SVG fills,
 * dynamic style props, status indicators.
 *
 * Mirrors the structure of apps/mobile/design/tokens.ts but only
 * exports what web actually needs (no motion/elevation primitives —
 * web uses CSS transitions and Tailwind shadow utilities).
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const raw = require("./raw.js") as RawShape;

interface RawShape {
  palette: Record<string, string>;
  space: Record<string, number>;
  radius: Record<string, number>;
  fontSize: Record<string, number>;
  lineHeight: Record<string, number>;
  letterSpacing: Record<string, number>;
  fontWeight: Record<string, string>;
}

export const palette = {
  paper: raw.palette.paper,
  paperRaised: raw.palette["paper-raised"],
  paperSunken: raw.palette["paper-sunken"],
  paperEdge: raw.palette["paper-edge"],

  ink: raw.palette.ink,
  inkSoft: raw.palette["ink-soft"],
  inkMuted: raw.palette["ink-muted"],
  inkFaint: raw.palette["ink-faint"],
  inkInverse: raw.palette["ink-inverse"],

  cobalt: raw.palette.cobalt,
  cobaltDeep: raw.palette["cobalt-deep"],
  cobaltSoft: raw.palette["cobalt-soft"],

  positive: raw.palette.positive,
  warning: raw.palette.warning,
  critical: raw.palette.critical,
} as const;

export const space = raw.space;
export const radius = raw.radius;
