import type { DiscogsMetadata } from "@aani/db";
import { useAuth } from "@clerk/clerk-expo";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import PlaylistPickerSheet from "../../components/PlaylistPickerSheet";
import {
  AppBar,
  Button,
  HStack,
  IconButton,
  Pressable,
  Screen,
  TempoCluster,
  Text,
  VStack,
  Vinyl,
  WaveformScrubber,
  palette,
  radius,
  space,
} from "../../components/ui";
import { useCurrentTrack } from "../../hooks/useCurrentTrack";
import { apiFetch } from "../../lib/api";
import {
  getTrackPlayer,
  isNativeModuleAvailable,
} from "../../lib/trackPlayer";
import { useLibraryStore } from "../../store/library";
import { usePlayerStore } from "../../store/player";

const PLAY_BUTTON_SIZE = 64;
const TRANSPORT_BUTTON_SIZE = 48;
const SECONDARY_BUTTON_SIZE = 36;

function formatTime(secs: number): string {
  const safe = Math.max(0, Math.round(secs));
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function PlayerScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { userId, getToken } = useAuth();
  const router = useRouter();

  const playing = usePlayerStore((s) => s.playing);
  const position = usePlayerStore((s) => s.position);
  const duration = usePlayerStore((s) => s.duration);
  const playbackRate = usePlayerStore((s) => s.playbackRate);
  const queue = usePlayerStore((s) => s.queue);
  const playWithQueue = usePlayerStore((s) => s.playWithQueue);
  const skipToIndex = usePlayerStore((s) => s.skipToIndex);
  const setRate = usePlayerStore((s) => s.setRate);
  const togglePlayPause = usePlayerStore((s) => s.togglePlayPause);
  const savePosition = usePlayerStore((s) => s.savePosition);
  const setQueueSheetVisible = usePlayerStore((s) => s.setQueueSheetVisible);

  const currentTrack = useCurrentTrack();

  const [loading, setLoading] = useState(false);
  const [pickerTrack, setPickerTrack] = useState<{ id: string; title: string } | null>(null);
  const [albumSubtitle, setAlbumSubtitle] = useState<string>("");

  useEffect(() => {
    if (!id || !userId) return;
    if (currentTrack?.id === id) return;

    const idxInQueue = queue.findIndex((q) => q.trackId === id);
    if (idxInQueue >= 0) {
      skipToIndex(idxInQueue, userId);
      return;
    }

    const cached = useLibraryStore.getState().tracks.find((t) => t.id === id);
    if (!cached) return;

    setLoading(true);
    playWithQueue([cached], 0, userId).finally(() => setLoading(false));

    return () => {
      if (userId) savePosition(userId);
    };
  }, [id, userId]);

  useEffect(() => {
    setAlbumSubtitle("");
    if (!currentTrack?.id) return;
    let cancelled = false;
    (async () => {
      const token = await getToken();
      if (!token || cancelled) return;
      const { data } = await apiFetch<{ metadata: DiscogsMetadata | null }>(
        `/discogs/track/${currentTrack.id}`,
        token,
      );
      if (cancelled || !data?.metadata?.title) return;
      setAlbumSubtitle(data.metadata.title);
    })();
    return () => {
      cancelled = true;
    };
  }, [currentTrack?.id, getToken]);

  const adjustRate = useCallback(
    (delta: number) => {
      if (!userId) return;
      const next = Math.round((playbackRate + delta) * 1000) / 1000;
      const clamped = Math.max(0.92, Math.min(1.08, next));
      setRate(clamped, userId);
    },
    [playbackRate, userId, setRate],
  );

  function handleSeek(ratio: number) {
    if (duration <= 0) return;
    const target = ratio * duration;
    getTrackPlayer()?.seekTo(target).catch(() => {});
  }

  async function handleTogglePlayPause() {
    const wasPlaying = usePlayerStore.getState().playing;
    await togglePlayPause();
    if (wasPlaying && userId) savePosition(userId);
  }

  if (!isNativeModuleAvailable()) {
    return (
      <Screen scroll={false}>
        <VStack flex justify="center" align="center" gap="md">
          <Text variant="title" align="center">
            Audio playback not available
          </Text>
          <Text variant="body" tone="muted" align="center">
            Requires a dev build — not supported in Expo Go
          </Text>
          <Button label="Go back" variant="secondary" onPress={() => router.back()} />
        </VStack>
      </Screen>
    );
  }

  if (loading) {
    return (
      <Screen scroll={false}>
        <VStack flex justify="center" align="center">
          <ActivityIndicator color={palette.ink} size="large" />
        </VStack>
      </Screen>
    );
  }

  if (!currentTrack) {
    return (
      <Screen scroll={false}>
        <VStack flex justify="center" align="center" gap="md">
          <Text variant="title">Track not found</Text>
          <Button label="Go back" variant="secondary" onPress={() => router.back()} />
        </VStack>
      </Screen>
    );
  }

  const remaining = Math.max(0, duration - position);
  const seekValue = duration > 0 ? Math.max(0, Math.min(1, position / duration)) : 0;

  return (
    <Screen scroll={false} inset={false}>
      <VStack flex>
        <AppBar
          subtitle={albumSubtitle}
          onBack={() => router.back()}
          trailing={
            <IconButton
              icon="list-outline"
              size={22}
              accessibilityLabel="Open queue"
              onPress={() => setQueueSheetVisible(true)}
            />
          }
        />

        <View
          style={{
            flex: 1,
            paddingHorizontal: space.lg,
            paddingBottom: space.base,
            gap: space.lg,
          }}
        >
          <View
            style={{
              alignItems: "center",
              paddingTop: space.lg,
              paddingBottom: space.sm,
            }}
          >
            <Vinyl size={280} playing={playing} />
          </View>

          <VStack gap="xs" align="center">
            <Text variant="titleLg" numberOfLines={1} align="center">
              {currentTrack.title}
            </Text>
            {currentTrack.artist ? (
              <Text variant="bodyStrong" tone="secondary" align="center">
                {currentTrack.artist}
              </Text>
            ) : null}
          </VStack>

          <TempoCluster
            originalBpm={currentTrack.originalBpm ?? null}
            rate={playbackRate}
            onAdjust={adjustRate}
            onReset={() => userId && setRate(1.0, userId)}
          />

          <View style={{ flex: 1 }} />

          <VStack gap="xs">
            <WaveformScrubber value={seekValue} onChange={handleSeek} />
            <HStack justify="between" style={{ paddingTop: space.xs }}>
              <Text variant="numeric" tone="muted">
                {formatTime(position)}
              </Text>
              <Text variant="numeric" tone="muted">
                −{formatTime(remaining)}
              </Text>
            </HStack>
          </VStack>

          <HStack justify="center" align="center" gap="xl">
            <Pressable
              onPress={() => getTrackPlayer()?.skipToPrevious().catch(() => {})}
              accessibilityLabel="Previous track"
              accessibilityRole="button"
              style={{
                width: TRANSPORT_BUTTON_SIZE,
                height: TRANSPORT_BUTTON_SIZE,
                borderRadius: radius.full,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons name="play-skip-back" size={28} color={palette.ink} />
            </Pressable>

            <Pressable
              onPress={handleTogglePlayPause}
              accessibilityLabel={playing ? "Pause" : "Play"}
              accessibilityRole="button"
              style={{
                width: PLAY_BUTTON_SIZE,
                height: PLAY_BUTTON_SIZE,
                borderRadius: radius.full,
                backgroundColor: palette.ink,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons
                name={playing ? "pause" : "play"}
                size={28}
                color={palette.inkInverse}
              />
            </Pressable>

            <Pressable
              onPress={() => getTrackPlayer()?.skipToNext().catch(() => {})}
              accessibilityLabel="Next track"
              accessibilityRole="button"
              style={{
                width: TRANSPORT_BUTTON_SIZE,
                height: TRANSPORT_BUTTON_SIZE,
                borderRadius: radius.full,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons
                name="play-skip-forward"
                size={28}
                color={palette.ink}
              />
            </Pressable>
          </HStack>

          <HStack justify="between" align="center" padY="xs">
            <IconButton
              icon="list-outline"
              size={22}
              color={palette.inkSoft}
              accessibilityLabel="Open queue"
              onPress={() => setQueueSheetVisible(true)}
            />
            <View
              style={{ width: SECONDARY_BUTTON_SIZE, height: SECONDARY_BUTTON_SIZE }}
            />
            <IconButton
              icon="add-circle-outline"
              size={22}
              color={palette.inkSoft}
              accessibilityLabel="Add to playlist"
              onPress={() =>
                setPickerTrack({ id: currentTrack.id, title: currentTrack.title })
              }
            />
          </HStack>
        </View>
      </VStack>

      <PlaylistPickerSheet
        visible={pickerTrack != null}
        track={pickerTrack}
        onClose={() => setPickerTrack(null)}
      />
    </Screen>
  );
}
