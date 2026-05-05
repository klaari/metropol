import { Children, Fragment, type ReactElement, type ReactNode } from "react";
import { View } from "react-native";
import { Divider } from "./Divider";
import { Text } from "./Text";
import { VStack } from "./Stack";

interface ListSectionProps {
  /** Optional eyebrow header above the rows. */
  eyebrow?: string;
  /** Optional title above the rows (use `eyebrow` for short labels). */
  title?: string;
  /** ListRow children. Dividers are inserted automatically between them. */
  children: ReactNode;
  /** Indent of the inter-row hairline. Defaults to 64 (clears 40px artwork). */
  dividerIndent?: number;
  /** Set false to suppress the inter-row dividers. */
  dividers?: boolean;
}

/**
 * A vertical list of rows under an optional eyebrow/title. Hairline dividers
 * are interleaved automatically — children are still individual ListRows
 * (not rendered through a FlatList). For long, virtualised lists, pass a
 * FlatList directly inside a PageSection instead.
 */
export function ListSection({
  eyebrow,
  title,
  children,
  dividerIndent = 64,
  dividers = true,
}: ListSectionProps) {
  const items = Children.toArray(children).filter(Boolean) as ReactElement[];

  return (
    <VStack gap={eyebrow || title ? "sm" : undefined}>
      {eyebrow ? (
        <View style={{ paddingHorizontal: 24 }}>
          <Text variant="eyebrow" tone="muted">
            {eyebrow}
          </Text>
        </View>
      ) : null}
      {title ? (
        <View style={{ paddingHorizontal: 24 }}>
          <Text variant="title" tone="primary">
            {title}
          </Text>
        </View>
      ) : null}
      <View>
        {items.map((child, i) => (
          <Fragment key={child.key ?? i}>
            {child}
            {dividers && i < items.length - 1 ? (
              <Divider inset="none" indent={dividerIndent} />
            ) : null}
          </Fragment>
        ))}
      </View>
    </VStack>
  );
}
