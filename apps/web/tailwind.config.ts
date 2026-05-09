import type { Config } from "tailwindcss";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const raw = require("./design/raw.js") as {
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
    extend: {
      letterSpacing: {
        eyebrow: `${raw.letterSpacing.eyebrow}px`,
      },
    },
  },
  plugins: [],
};

export default config;
