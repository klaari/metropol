import { Redirect } from "expo-router";
import { useState } from "react";
import {
  AppBar,
  Banner,
  Button,
  Cluster,
  ContentBlock,
  Divider,
  Field,
  HStack,
  HeroSection,
  IconButton,
  Inline,
  Input,
  ListRow,
  ListSection,
  PageSection,
  Pressable,
  ProgressBar,
  Screen,
  SettingsRow,
  Spacer,
  Surface,
  Switch,
  Text,
  VStack,
} from "../components/ui";

export default function DesignSystemSmokeScreen() {
  const [enabled, setEnabled] = useState(true);
  const [query, setQuery] = useState("Kind of Blue");
  const [secret, setSecret] = useState("aani");

  if (process.env.NODE_ENV === "production") {
    return <Redirect href="/" />;
  }

  return (
    <Screen>
      <VStack gap="xl">
        <AppBar title="Design System" />

        <HeroSection
          visual={
            <Surface tone="sunken" rounded="xl" pad="xl" bordered>
              <Text variant="display" tone="accent" align="center">
                Aa
              </Text>
            </Surface>
          }
          title="Warm paper primitives"
          subtitle="Ink type, cobalt accent, hairline rhythm."
          actions={
            <HStack gap="md" justify="center">
              <IconButton
                icon="play"
                variant="filled"
                accessibilityLabel="Primary action"
              />
              <IconButton icon="list-outline" accessibilityLabel="Secondary action" />
            </HStack>
          }
        />

        <PageSection eyebrow="Typography" title="Text ladder">
          <ContentBlock>
            <Text variant="display">Display</Text>
            <Text variant="titleLg">Title large</Text>
            <Text variant="title">Title</Text>
            <Text variant="bodyLg">Body large</Text>
            <Text variant="body">Body copy</Text>
            <Text variant="bodyStrong">Body strong</Text>
            <Text variant="caption" tone="muted">
              Caption muted
            </Text>
            <Text variant="numeric" numeric>
              128 BPM · 03:42
            </Text>
          </ContentBlock>
        </PageSection>

        <PageSection eyebrow="Controls" title="Inputs and actions">
          <ContentBlock>
            <Field label="Search" helper="Search variant owns leading and clear affordances.">
              <Input variant="search" value={query} onChangeText={setQuery} />
            </Field>
            <Field label="Password">
              <Input variant="password" value={secret} onChangeText={setSecret} />
            </Field>
            <Cluster>
              <Button label="Primary" />
              <Button label="Secondary" variant="secondary" />
              <Button label="Ghost" variant="ghost" />
              <Button label="Destructive" variant="destructive" />
            </Cluster>
            <Inline>
              <Text variant="bodyStrong">Wrapped switch</Text>
              <Switch
                value={enabled}
                onValueChange={setEnabled}
                accessibilityLabel="Toggle sample"
              />
            </Inline>
          </ContentBlock>
        </PageSection>

        <PageSection eyebrow="Surfaces" title="Paper stack">
          <VStack gap="md">
            <Surface tone="paper" bordered>
              <Text>Paper surface</Text>
            </Surface>
            <Surface tone="raised" lift="sheet" bordered>
              <Text>Raised sheet surface</Text>
            </Surface>
            <Banner
              title="Discogs match ready"
              message="Banner and Toast share this notification primitive."
              onDismiss={() => undefined}
            />
          </VStack>
        </PageSection>

        <ListSection eyebrow="Rows">
          <ListRow
            title="So What"
            subtitle="Miles Davis"
            leading={
              <Surface tone="sunken" rounded="md" pad="sm">
                <Text variant="caption" tone="accent">
                  01
                </Text>
              </Surface>
            }
            trailing={<Text variant="numeric">9:22</Text>}
          />
          <SettingsRow
            title="Sync library"
            subtitle="SettingsRow owns toggle, value, chevron, and icon affordances."
            trailing={{ type: "switch", value: enabled, onValueChange: setEnabled }}
          />
          <SettingsRow
            title="Storage"
            trailing={{ type: "value", value: "2.4 GB" }}
            tone="informational"
          />
          <SettingsRow
            title="Clear cache"
            tone="destructive"
            trailing={{ type: "chevron" }}
          />
        </ListSection>

        <PageSection eyebrow="Atoms" title="Press and progress">
          <ContentBlock>
            <Pressable>
              <Surface tone="sunken" bordered>
                <Text variant="bodyStrong">Pressable feedback surface</Text>
              </Surface>
            </Pressable>
            <ProgressBar value={0.62} />
            <Divider inset="sm" />
            <HStack gap="sm" align="center">
              <Text>Spacer</Text>
              <Spacer size="lg" />
              <Text tone="muted">gap check</Text>
            </HStack>
          </ContentBlock>
        </PageSection>
      </VStack>
    </Screen>
  );
}
