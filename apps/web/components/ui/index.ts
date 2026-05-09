/**
 * Aani web UI primitives — HTML/Tailwind equivalents of the mobile
 * primitives at apps/mobile/components/ui. Both consume the same
 * design tokens (apps/mobile/design/raw.js, re-exported by web at
 * apps/web/design/raw.js), so colors, spacing, type, and radius
 * are unified across platforms.
 *
 * Reach for these instead of writing inline Tailwind. If a primitive
 * is missing, add it here rather than reaching for raw <div> with
 * one-off classes.
 */

export { Text } from "./Text";
export { HStack, VStack } from "./Stack";
export { Inline } from "./Inline";
export { Surface } from "./Surface";
export { Button } from "./Button";
export { IconButton } from "./IconButton";
export { Input } from "./Input";
export { Field } from "./Field";
export { ListRow } from "./ListRow";
export { StatusDot } from "./StatusDot";
export { PageSection } from "./PageSection";
export { HeroSection } from "./HeroSection";
export { Divider } from "./Divider";
export { palette, space, radius } from "../../design/tokens";
