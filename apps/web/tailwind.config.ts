import type { Config } from "tailwindcss";
import { createRequire } from "node:module";

// Tailwind 4 loads this config as ESM, so we can't use a bare `require`.
// raw.js is CommonJS (shared with mobile via apps/web/design/raw.js, which
// re-exports apps/mobile/design/raw.js).
const requireCjs = createRequire(import.meta.url);
const raw = requireCjs("./design/raw.js") as {
  palette: Record<string, string>;
  space: Record<string, number>;
  radius: Record<string, number>;
  fontSize: Record<string, number>;
  lineHeight: Record<string, number>;
  letterSpacing: Record<string, number>;
  fontWeight: Record<string, string>;
};

const px = (n: number | string) =>
  typeof n === "number" ? `${n}px` : n;
const mapPx = (obj: Record<string, number>): Record<string, string> =>
  Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, px(v)]));

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./design/**/*.{js,ts}",
  ],
  theme: {
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
      sans: [
        "-apple-system",
        "BlinkMacSystemFont",
        "Segoe UI",
        "Roboto",
        "sans-serif",
      ],
      mono: ["Menlo", "monospace"],
    },
    fontSize: Object.fromEntries(
      Object.entries(raw.fontSize).map(([k, size]) => {
        const meta: { lineHeight: string; letterSpacing?: string } = {
          lineHeight: px(raw.lineHeight[k] as number),
        };
        const ls = raw.letterSpacing[k];
        if (ls !== undefined && ls !== 0) meta.letterSpacing = `${ls}px`;
        return [k, [px(size), meta]];
      }),
    ),
    fontWeight: raw.fontWeight,
    // Note: max-w-* lives on the `--container-*` scale in Tailwind 4 and is
    // restored to its standard values via @theme in app/globals.css. JS
    // config can't override it cleanly here.
    extend: {
      letterSpacing: {
        eyebrow: `${raw.letterSpacing.eyebrow}px`,
      },
    },
  },
  plugins: [],
};

export default config;
