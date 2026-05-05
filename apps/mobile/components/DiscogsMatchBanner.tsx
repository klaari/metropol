import { useRouter } from "expo-router";
import { View } from "react-native";
import {
  Button,
  HStack,
  Surface,
  Text,
  VStack,
  palette,
  space,
  z,
} from "./ui";
import { IconButton } from "./ui/IconButton";
import { useDiscogsMatchStore } from "../store/discogsMatch";

export default function DiscogsMatchBanner() {
  const router = useRouter();
  const prompt = useDiscogsMatchStore((s) => s.prompt);
  const dismiss = useDiscogsMatchStore((s) => s.dismissPrompt);
  const undo = useDiscogsMatchStore((s) => s.undoMatch);

  if (!prompt) return null;

  const tone =
    prompt.kind === "matched" && prompt.type === "wantlist"
      ? palette.critical
      : palette.positive;

  function openTrack() {
    if (!prompt) return;
    router.push(`/player/${prompt.trackId}`);
    dismiss();
  }

  return (
    <View
      pointerEvents="box-none"
      style={{
        position: "absolute",
        top: space.lg,
        left: space.md,
        right: space.md,
        zIndex: z.toast,
      }}
    >
      <Surface tone="raised" lift="sheet" rounded="lg" pad="base" bordered>
        <HStack gap="md" align="stretch">
          <View
            style={{
              width: space.xs,
              borderRadius: space.xs,
              backgroundColor: tone,
            }}
          />
          <VStack gap="xs" flex>
            <Text variant="bodyStrong" numberOfLines={1}>
              {prompt.kind === "matched"
                ? `Matched ${prompt.trackTitle}`
                : `${prompt.candidates.length} possible Discogs match${
                    prompt.candidates.length === 1 ? "" : "es"
                  }`}
            </Text>
            <Text variant="caption" tone="muted" numberOfLines={1}>
              {prompt.kind === "matched"
                ? `${prompt.label} · ${
                    prompt.type === "collection" ? "in collection" : "in wantlist"
                  }`
                : prompt.trackTitle}
            </Text>
          </VStack>
          {prompt.kind === "matched" ? (
            <Button
              label="Undo"
              size="sm"
              variant="secondary"
              onPress={() => undo(prompt.trackId)}
            />
          ) : (
            <Button label="Pick" size="sm" variant="secondary" onPress={openTrack} />
          )}
          <IconButton
            icon="close"
            accessibilityLabel="Dismiss Discogs match"
            onPress={dismiss}
            color={palette.inkMuted}
          />
        </HStack>
      </Surface>
    </View>
  );
}
