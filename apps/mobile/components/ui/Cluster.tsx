import { View, type ViewProps } from "react-native";
import { space, type SpaceKey } from "../../design/tokens";

interface ClusterProps extends ViewProps {
  /** Gap between items, both horizontal and vertical when wrapping. Defaults to `sm`. */
  gap?: SpaceKey;
  /** Cross-axis alignment within a row. */
  align?: "start" | "center" | "end" | "baseline";
  /** Main-axis distribution. */
  justify?: "start" | "center" | "end" | "between";
}

const alignMap = {
  start: "flex-start",
  center: "center",
  end: "flex-end",
  baseline: "baseline",
} as const;

const justifyMap = {
  start: "flex-start",
  center: "center",
  end: "flex-end",
  between: "space-between",
} as const;

/**
 * Wrap-friendly horizontal layout. Use for chip rows, tag groups, filter
 * pills — any horizontal collection that should reflow to a new line when
 * it runs out of space. For non-wrapping rows, use HStack instead.
 */
export function Cluster({
  gap = "sm",
  align = "center",
  justify = "start",
  children,
  style,
  ...rest
}: ClusterProps) {
  return (
    <View
      {...rest}
      style={[
        {
          flexDirection: "row",
          flexWrap: "wrap",
          alignItems: alignMap[align],
          justifyContent: justifyMap[justify],
          gap: space[gap],
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}
