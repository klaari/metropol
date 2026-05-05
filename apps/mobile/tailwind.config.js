/**
 * NativeWind theme — derived from apps/mobile/design/raw.js.
 *
 * Both this file and design/tokens.ts read raw.js, so the className surface
 * and the TS API cannot drift. Anything not declared here cannot be
 * expressed as a NativeWind class — that's intentional.
 */

const raw = require("./design/raw.js");

const px = (n) => (typeof n === "number" ? `${n}px` : n);
const mapPx = (obj) =>
  Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, px(v)]));

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    // Override (not extend) so the generic Tailwind ramps disappear. Only
    // our editorial scale is reachable from class names.
    colors: {
      transparent: "transparent",
      white: "#FFFFFF",
      black: "#000000",
      ...raw.palette,
    },
    spacing: mapPx(raw.space),
    borderRadius: {
      ...mapPx(raw.radius),
      full: "9999px",
    },
    borderWidth: {
      DEFAULT: "1px",
      0: "0",
      hair: "1px",
      thick: "2px",
    },
    fontFamily: {
      sans: ["System"],
      mono: ["Menlo"],
    },
    fontSize: Object.fromEntries(
      Object.entries(raw.fontSize).map(([k, size]) => {
        const meta = { lineHeight: px(raw.lineHeight[k]) };
        const ls = raw.letterSpacing[k];
        if (ls !== undefined && ls !== 0) meta.letterSpacing = `${ls}px`;
        return [k, [px(size), meta]];
      }),
    ),
    fontWeight: raw.fontWeight,
    extend: {
      letterSpacing: {
        eyebrow: `${raw.letterSpacing.eyebrow}px`,
        tight: `${raw.letterSpacing.title}px`,
        tighter: `${raw.letterSpacing["title-lg"]}px`,
        display: `${raw.letterSpacing.display}px`,
      },
    },
  },
  plugins: [],
};
