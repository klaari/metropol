import { Switch as RNSwitch, type SwitchProps as RNSwitchProps } from "react-native";
import { palette } from "../../design/tokens";

type SwitchProps = Pick<
  RNSwitchProps,
  "value" | "onValueChange" | "disabled" | "accessibilityLabel"
>;

/** Palette-bound wrapper around RN Switch. */
export function Switch(props: SwitchProps) {
  return (
    <RNSwitch
      {...props}
      trackColor={{ false: palette.paperEdge, true: palette.cobalt }}
      thumbColor={palette.inkInverse}
      ios_backgroundColor={palette.paperEdge}
    />
  );
}
