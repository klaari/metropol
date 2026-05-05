/**
 * Raw design values — the single source for Tailwind config and tokens.ts.
 *
 * CommonJS so tailwind.config.js can `require` it. Do not import directly
 * from app code — go through `design/tokens` (TS) instead.
 */

const palette = {
  paper: "#F4EFE7",
  "paper-raised": "#FBF7F0",
  "paper-sunken": "#EAE4DA",
  "paper-edge": "#DCD5C7",

  ink: "#16130E",
  "ink-soft": "#3A352D",
  "ink-muted": "#7A7368",
  "ink-faint": "#B5AFA2",
  "ink-inverse": "#F8F4EC",

  cobalt: "#4A55A0",
  "cobalt-deep": "#3A4485",
  "cobalt-soft": "#7A85C4",

  positive: "#5A6E48",
  warning: "#B0793A",
  critical: "#A8412C",
};

const space = {
  none: 0,
  hair: 1,
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 24,
  xl: 32,
  "2xl": 48,
  "3xl": 64,
  "4xl": 96,
};

const radius = {
  none: 0,
  sm: 4,
  md: 8,
  lg: 12,
  xl: 20,
  full: 9999,
};

const fontSize = {
  eyebrow: 11,
  caption: 13,
  body: 15,
  "body-lg": 17,
  title: 22,
  "title-lg": 28,
  display: 36,
};

const lineHeight = {
  eyebrow: 14,
  caption: 18,
  body: 22,
  "body-lg": 24,
  title: 26,
  "title-lg": 32,
  display: 38,
};

const letterSpacing = {
  eyebrow: 1.2,
  body: 0,
  "body-lg": -0.1,
  title: -0.3,
  "title-lg": -0.5,
  display: -0.8,
};

const fontWeight = {
  regular: "400",
  medium: "500",
  semibold: "600",
  bold: "700",
};

module.exports = {
  palette,
  space,
  radius,
  fontSize,
  lineHeight,
  letterSpacing,
  fontWeight,
};
