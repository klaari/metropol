/**
 * Aani design tokens — TypeScript surface.
 *
 * Color, spacing, radius, and type live in `raw.js` (consumed by Tailwind too).
 * Motion, elevation, layout, icon, and z live here — they are RN-shaped and
 * not expressible as NativeWind classes.
 *
 * Philosophy: see UI_RULES.md. Architecture: see UI_ARCHITECTURE.md.
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

// ---------------------------------------------------------------------------
// Color — keys re-exported in camelCase for ergonomic TS usage.
// ---------------------------------------------------------------------------

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

  white: "#FFFFFF",
  black: "#000000",
  transparent: "transparent",
} as const;

// ---------------------------------------------------------------------------
// Spacing — closed t-shirt scale. Authored in raw.js.
// ---------------------------------------------------------------------------

export const space = raw.space as {
  none: 0; hair: 1; xs: 4; sm: 8; md: 12; base: 16;
  lg: 24; xl: 32; "2xl": 48; "3xl": 64; "4xl": 96;
};

export type SpaceKey = keyof typeof space;

// ---------------------------------------------------------------------------
// Type — recipes (size + line-height + tracking + weight) so callers never
// hand-assemble. Sizes are deliberately uneven; do not normalise the ladder.
// ---------------------------------------------------------------------------

export const fontFamily = {
  sans: "System",
  mono: "Menlo",
} as const;

export const fontWeight = raw.fontWeight as {
  regular: "400"; medium: "500"; semibold: "600"; bold: "700";
};

export const type = {
  eyebrow: {
    fontSize: raw.fontSize.eyebrow,
    lineHeight: raw.lineHeight.eyebrow,
    letterSpacing: raw.letterSpacing.eyebrow,
    fontWeight: fontWeight.semibold,
    textTransform: "uppercase" as const,
  },
  caption: {
    fontSize: raw.fontSize.caption,
    lineHeight: raw.lineHeight.caption,
    letterSpacing: raw.letterSpacing.body,
    fontWeight: fontWeight.regular,
  },
  body: {
    fontSize: raw.fontSize.body,
    lineHeight: raw.lineHeight.body,
    letterSpacing: raw.letterSpacing.body,
    fontWeight: fontWeight.regular,
  },
  bodyStrong: {
    fontSize: raw.fontSize.body,
    lineHeight: raw.lineHeight.body,
    letterSpacing: raw.letterSpacing.body,
    fontWeight: fontWeight.semibold,
  },
  bodyLg: {
    fontSize: raw.fontSize["body-lg"],
    lineHeight: raw.lineHeight["body-lg"],
    letterSpacing: raw.letterSpacing["body-lg"],
    fontWeight: fontWeight.regular,
  },
  title: {
    fontSize: raw.fontSize.title,
    lineHeight: raw.lineHeight.title,
    letterSpacing: raw.letterSpacing.title,
    fontWeight: fontWeight.semibold,
  },
  titleLg: {
    fontSize: raw.fontSize["title-lg"],
    lineHeight: raw.lineHeight["title-lg"],
    letterSpacing: raw.letterSpacing["title-lg"],
    fontWeight: fontWeight.bold,
  },
  display: {
    fontSize: raw.fontSize.display,
    lineHeight: raw.lineHeight.display,
    letterSpacing: raw.letterSpacing.display,
    fontWeight: fontWeight.bold,
  },
  numeric: {
    fontSize: raw.fontSize.caption,
    lineHeight: raw.lineHeight.caption,
    letterSpacing: raw.letterSpacing.body,
    fontWeight: fontWeight.medium,
  },
} as const;

export type TypeVariant = keyof typeof type;

// ---------------------------------------------------------------------------
// Radius / border. Most surfaces are `md` or `lg`. `full` is for pills only.
// ---------------------------------------------------------------------------

export const radius = raw.radius as {
  none: 0; sm: 4; md: 8; lg: 12; xl: 20; full: 9999;
};

export const border = {
  hair: 1,    // dividers, surfaces
  thick: 2,   // focus rings, active selection only
} as const;

// ---------------------------------------------------------------------------
// Elevation — encoded as RN shadow props. Paper does not float; only sheets
// and popovers lift.
// ---------------------------------------------------------------------------

export const elevation = {
  none: {
    shadowColor: palette.transparent,
    shadowOpacity: 0,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 0 },
    elevation: 0,
  },
  sheet: {
    shadowColor: palette.ink,
    shadowOpacity: 0.08,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  popover: {
    shadowColor: palette.ink,
    shadowOpacity: 0.12,
    shadowRadius: 32,
    shadowOffset: { width: 0, height: 12 },
    elevation: 12,
  },
} as const;

// ---------------------------------------------------------------------------
// Motion — calm, critically damped. No bounce, no overshoot.
// Spring targets Reanimated; duration targets RN Animated/timing.
// ---------------------------------------------------------------------------

export const motion = {
  duration: {
    instant: 80,
    fast: 160,
    base: 240,
    slow: 360,
    deliberate: 520,
  },
  easing: {
    standard: [0.2, 0.0, 0.0, 1.0] as const,
    accelerate: [0.4, 0.0, 1.0, 1.0] as const,
    decelerate: [0.0, 0.0, 0.2, 1.0] as const,
  },
  spring: {
    soft: { damping: 22, stiffness: 180, mass: 1 },
    snappy: { damping: 24, stiffness: 260, mass: 0.9 },
  },
  press: {
    scale: 0.98,
    opacity: 0.85,
  },
} as const;

// ---------------------------------------------------------------------------
// Layout — global rhythm constants. Screens compose around these.
// ---------------------------------------------------------------------------

export const layout = {
  screenInset: space.lg,        // 24 — horizontal page margin
  sectionGap: space.xl,          // 32 — between unrelated blocks
  blockGap: space.lg,            // 24 — between related blocks
  rowHeight: 56,                 // standard list row
  controlHeight: 48,             // primary tappable control
  controlHeightSm: 36,
  hitSlop: 12,
  maxContentWidth: 560,          // tablet/landscape ceiling
} as const;

// ---------------------------------------------------------------------------
// Iconography — line first, single weight, one filled exception per screen.
// ---------------------------------------------------------------------------

export const icon = {
  size: { sm: 16, base: 20, md: 24, lg: 28, xl: 36 },
  strokeWidth: 1.75,
} as const;

// ---------------------------------------------------------------------------
// Z-index — flat by default. Only enumerate layers we actually have.
// ---------------------------------------------------------------------------

export const z = {
  base: 0,
  sticky: 10,
  overlay: 100,
  sheet: 200,
  modal: 300,
  toast: 400,
} as const;

export const tokens = {
  palette, space, fontFamily, fontWeight, type,
  radius, border, elevation, motion, layout, icon, z,
} as const;

export type Tokens = typeof tokens;
