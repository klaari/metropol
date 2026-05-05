import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import {
  TextInput,
  View,
  type TextInputProps,
  type ViewStyle,
} from "react-native";
import {
  border,
  icon,
  layout,
  palette,
  radius,
  space,
  type,
} from "../../design/tokens";
import { IconButton } from "./IconButton";

type InputVariant = "default" | "password" | "search";

interface InputProps extends Omit<TextInputProps, "style" | "secureTextEntry"> {
  variant?: InputVariant;
}

const containerBase: ViewStyle = {
  minHeight: layout.controlHeight,
  borderRadius: radius.md,
  backgroundColor: palette.paperSunken,
  borderColor: palette.paperEdge,
  borderWidth: border.hair,
  paddingHorizontal: space.md,
  flexDirection: "row",
  alignItems: "center",
  gap: space.sm,
};

/** Single-line text field with owned focus ring, cursor, and placeholder tones. */
export function Input({
  variant = "default",
  value,
  onChangeText,
  editable = true,
  placeholderTextColor,
  ...props
}: InputProps) {
  const [focused, setFocused] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const isPassword = variant === "password";
  const isSearch = variant === "search";
  const textValue = typeof value === "string" ? value : "";
  const canClear = isSearch && textValue.length > 0 && onChangeText;

  return (
    <View
      style={[
        containerBase,
        focused
          ? { borderColor: palette.cobalt, borderWidth: border.thick }
          : null,
        editable ? null : { opacity: 0.45 },
      ]}
    >
      {isSearch ? (
        <Ionicons name="search-outline" size={icon.size.base} color={palette.inkMuted} />
      ) : null}
      <TextInput
        {...props}
        value={value}
        onChangeText={onChangeText}
        editable={editable}
        secureTextEntry={isPassword && !revealed}
        placeholderTextColor={placeholderTextColor ?? palette.inkMuted}
        cursorColor={palette.ink}
        selectionColor={palette.cobaltSoft}
        onFocus={(event) => {
          setFocused(true);
          props.onFocus?.(event);
        }}
        onBlur={(event) => {
          setFocused(false);
          props.onBlur?.(event);
        }}
        style={{
          flex: 1,
          color: palette.ink,
          paddingVertical: 0,
          ...type.body,
        }}
      />
      {canClear ? (
        <IconButton
          icon="close-circle"
          accessibilityLabel="Clear search"
          color={palette.inkMuted}
          size={icon.size.base}
          onPress={() => onChangeText("")}
        />
      ) : null}
      {isPassword ? (
        <IconButton
          icon={revealed ? "eye-off-outline" : "eye-outline"}
          accessibilityLabel={revealed ? "Hide password" : "Show password"}
          color={palette.inkMuted}
          size={icon.size.base}
          onPress={() => setRevealed((current) => !current)}
        />
      ) : null}
    </View>
  );
}
