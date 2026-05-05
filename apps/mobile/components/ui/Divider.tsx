import { View } from "react-native";
import { palette, space, type SpaceKey } from "../../design/tokens";

interface DividerProps {
  /** Vertical breathing room above and below the line. Defaults to `lg` (24). */
  inset?: SpaceKey;
  /** Indent from the left — used inside list rows so the line aligns past leading content. */
  indent?: number;
}

/** A 1px hairline. Never thicker — paper aesthetic. */
export function Divider({ inset = "lg", indent = 0 }: DividerProps) {
  return (
    <View style={{ paddingVertical: space[inset] / 2, paddingLeft: indent }}>
      <View style={{ height: 1, backgroundColor: palette.paperEdge }} />
    </View>
  );
}
