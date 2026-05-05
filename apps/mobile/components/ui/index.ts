/**
 * Aani UI primitives — composable building blocks for every screen.
 *
 * Rule of thumb: if you reach for a bare react-native primitive
 * (Text, View, Pressable, ScrollView), check this barrel first. The
 * primitives here encode our spacing, type, and motion discipline so
 * screens stay consistent without per-screen styling decisions.
 *
 * For composition guidance, see UI_RULES.md and UI_ARCHITECTURE.md.
 */

// Atoms / interaction
export { Pressable } from "./Pressable";
export { Text } from "./Text";
export { Divider } from "./Divider";
export { ProgressBar } from "./ProgressBar";

// Surfaces
export { Surface } from "./Surface";
export { Screen } from "./Screen";

// Layout primitives — flex containers
export { HStack, Spacer, VStack } from "./Stack";
export { Cluster } from "./Cluster";
export { Inline } from "./Inline";

// Layout primitives — semantic blocks
export { ContentBlock } from "./ContentBlock";
export { PageSection } from "./PageSection";
export { HeroSection } from "./HeroSection";
export { ListSection } from "./ListSection";

// Composed components
export { AppBar, AppBarHairline } from "./AppBar";
export { Button } from "./Button";
export { IconButton } from "./IconButton";
export { ListRow } from "./ListRow";

// Token re-exports — for the rare case a primitive consumer needs a literal.
// Prefer typed props on primitives over reaching for these.
export {
  border,
  elevation,
  fontFamily,
  fontWeight,
  icon,
  layout,
  motion,
  palette,
  radius,
  space,
  tokens,
  type as typeScale,
  z,
} from "../../design/tokens";
