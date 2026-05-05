import { View, type ViewProps, type ViewStyle } from "react-native";
import { space, type SpaceKey } from "../../design/tokens";

type Align = "start" | "center" | "end" | "stretch" | "baseline";
type Justify = "start" | "center" | "end" | "between" | "around" | "evenly";

const alignMap: Record<Align, ViewStyle["alignItems"]> = {
  start: "flex-start",
  center: "center",
  end: "flex-end",
  stretch: "stretch",
  baseline: "baseline",
};

const justifyMap: Record<Justify, ViewStyle["justifyContent"]> = {
  start: "flex-start",
  center: "center",
  end: "flex-end",
  between: "space-between",
  around: "space-around",
  evenly: "space-evenly",
};

interface StackProps extends ViewProps {
  /** Gap key from the canonical scale. Reject custom numbers. */
  gap?: SpaceKey;
  /** Cross-axis alignment. */
  align?: Align;
  /** Main-axis distribution. */
  justify?: Justify;
  /** Padding on every side. */
  pad?: SpaceKey;
  /** Horizontal padding. */
  padX?: SpaceKey;
  /** Vertical padding. */
  padY?: SpaceKey;
  /** Stretch to fill parent. */
  flex?: boolean;
}

function buildBase(
  direction: "row" | "column",
  { gap, align, justify, pad, padX, padY, flex, style }: StackProps,
): ViewStyle {
  return {
    flexDirection: direction,
    ...(flex ? { flex: 1 } : null),
    ...(gap !== undefined ? { gap: space[gap] } : null),
    ...(align ? { alignItems: alignMap[align] } : null),
    ...(justify ? { justifyContent: justifyMap[justify] } : null),
    ...(pad !== undefined ? { padding: space[pad] } : null),
    ...(padX !== undefined ? { paddingHorizontal: space[padX] } : null),
    ...(padY !== undefined ? { paddingVertical: space[padY] } : null),
    ...((style as ViewStyle) ?? null),
  };
}

/** Vertical stack — the dominant layout primitive on this surface. */
export function VStack({ children, ...props }: StackProps) {
  const { style: _ignored, ...rest } = props;
  return (
    <View {...rest} style={buildBase("column", props)}>
      {children}
    </View>
  );
}

/** Horizontal stack — for icon rows, control clusters, list rows. */
export function HStack({ children, ...props }: StackProps) {
  const { style: _ignored, ...rest } = props;
  const base = buildBase("row", props);
  // Sensible default: vertically center children in a row.
  if (!props.align) base.alignItems = "center";
  return (
    <View {...rest} style={base}>
      {children}
    </View>
  );
}

/** Symmetric horizontal spacer when gap isn't enough. Use sparingly. */
export function Spacer({ size = "base" }: { size?: SpaceKey }) {
  return <View style={{ width: space[size], height: space[size] }} />;
}
