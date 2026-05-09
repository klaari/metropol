import { type ReactNode } from "react";
import { Text } from "./Text";
import { VStack } from "./Stack";

interface FieldProps {
  label: string;
  children: ReactNode;
  helper?: string;
  error?: string;
}

export function Field({ label, children, helper, error }: FieldProps) {
  return (
    <VStack gap="xs">
      <Text variant="eyebrow" tone={error ? "critical" : "muted"}>
        {label}
      </Text>
      {children}
      {error ? (
        <Text variant="caption" tone="critical">
          {error}
        </Text>
      ) : helper ? (
        <Text variant="caption" tone="muted">
          {helper}
        </Text>
      ) : null}
    </VStack>
  );
}
