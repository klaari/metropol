import { View } from "react-native";
import { palette, radius } from "../../design/tokens";
import { Text } from "./Text";

interface MiniTileProps {
  /** Source string used to derive the tile colour and the monogram letters. */
  title: string;
  /** Tile diameter in px. Default 36 (queue comfortable density). */
  size?: number;
}

const TILE_PALETTE: Array<{ bg: string; fg: string }> = [
  { bg: palette.cobalt, fg: palette.inkInverse },
  { bg: palette.cobaltDeep, fg: palette.inkInverse },
  { bg: palette.positive, fg: palette.inkInverse },
  { bg: palette.critical, fg: palette.inkInverse },
  { bg: palette.ink, fg: palette.inkInverse },
  { bg: palette.paperEdge, fg: palette.ink },
];

function hashIndex(str: string, mod: number): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h * 31 + str.charCodeAt(i)) >>> 0;
  }
  return h % mod;
}

// Skips whitespace, punctuation, symbols, and quotes — anything that isn't
// a letter or digit (across scripts) is treated as decoration around a word.
const LETTER_RE = /\p{L}|\p{N}/u;

function initials(title: string): string {
  const letters: string[] = [];
  for (const word of title.split(/\s+/)) {
    const m = word.match(LETTER_RE);
    if (m) letters.push(m[0]);
    if (letters.length === 2) break;
  }
  return letters.join("").toUpperCase() || "·";
}

/**
 * Square monogram tile. Background colour is deterministically chosen from
 * a 6-swatch palette via a stable hash of `title`, so the same track always
 * gets the same tile and the queue/library reads as a curated set.
 */
export function MiniTile({ title, size = 36 }: MiniTileProps) {
  const swatch = TILE_PALETTE[hashIndex(title, TILE_PALETTE.length)]!;
  const fontSize = size <= 32 ? 11 : 13;
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: radius.sm,
        backgroundColor: swatch.bg,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text
        variant="bodyStrong"
        style={{
          fontSize,
          letterSpacing: 0.5,
          color: swatch.fg,
        }}
      >
        {initials(title)}
      </Text>
    </View>
  );
}
