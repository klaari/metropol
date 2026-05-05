import { useAuth } from "@clerk/clerk-expo";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Modal, View } from "react-native";
import { useCurrentTrack } from "../hooks/useCurrentTrack";
import { usePlayerStore } from "../store/player";
import {
  HStack,
  IconButton,
  Pressable,
  ProgressBar,
  Surface,
  Text,
  VStack,
  palette,
  radius,
  space,
} from "./ui";

const TEMPO_AUTO_CLOSE_MS = 3500;

export default function MiniPlayer() {
  const router = useRouter();
  const { userId } = useAuth();
  const currentTrack = useCurrentTrack();
  const playing = usePlayerStore((s) => s.playing);
  const position = usePlayerStore((s) => s.position);
  const duration = usePlayerStore((s) => s.duration);
  const playbackRate = usePlayerStore((s) => s.playbackRate);
  const togglePlayPause = usePlayerStore((s) => s.togglePlayPause);
  const setRate = usePlayerStore((s) => s.setRate);

  const [tempoOpen, setTempoOpen] = useState(false);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const armCloseTimer = useCallback(() => {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    closeTimerRef.current = setTimeout(() => setTempoOpen(false), TEMPO_AUTO_CLOSE_MS);
  }, []);

  useEffect(() => {
    if (tempoOpen) armCloseTimer();
    else if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    return () => {
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    };
  }, [tempoOpen, armCloseTimer]);

  const adjustRate = useCallback(
    (delta: number) => {
      if (!userId) return;
      const next = Math.round((playbackRate + delta) * 1000) / 1000;
      const clamped = Math.max(0.92, Math.min(1.08, next));
      setRate(clamped, userId);
      armCloseTimer();
    },
    [userId, playbackRate, setRate, armCloseTimer],
  );

  const resetRate = useCallback(() => {
    if (!userId) return;
    setRate(1.0, userId);
  }, [userId, setRate]);

  if (!currentTrack) return null;

  const progress = duration > 0 ? Math.min(1, position / duration) : 0;
  const originalBpm = currentTrack.originalBpm;
  const currentBpm =
    originalBpm != null
      ? Math.round(originalBpm * playbackRate * 10) / 10
      : null;
  const ratePercent = Math.round((playbackRate - 1) * 1000) / 10;
  const rateDisplay =
    ratePercent === 0
      ? "0%"
      : ratePercent > 0
        ? `+${ratePercent.toFixed(1)}%`
        : `${ratePercent.toFixed(1)}%`;
  const isAlteredRate = playbackRate !== 1 && originalBpm != null;

  return (
    <Surface tone="raised" rounded="none" pad="none" bordered>
      <ProgressBar value={progress} />
      <Pressable
        flat
        onPress={() => router.push(`/player/${currentTrack.id}`)}
        android_ripple={{ color: palette.paperSunken }}
      >
        <HStack gap="md" padX="md" padY="sm">
          <Surface tone="sunken" rounded="md" pad="none">
            <View
              style={{
                width: 40,
                height: 40,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text variant="title" tone="faint">
                ♫
              </Text>
            </View>
          </Surface>
          <VStack gap="xs" flex>
            <Text variant="bodyStrong" numberOfLines={1}>
              {currentTrack.title}
            </Text>
            {currentTrack.artist ? (
              <Text variant="caption" tone="muted" numberOfLines={1}>
                {currentTrack.artist}
              </Text>
            ) : null}
          </VStack>
          <Pressable
            flat
            onPress={resetRate}
            onLongPress={() => setTempoOpen(true)}
            delayLongPress={250}
            hitSlop={space.sm}
            android_ripple={{ color: palette.paperSunken, borderless: true }}
            style={{
              alignItems: "center",
              justifyContent: "center",
              minWidth: 52,
              paddingHorizontal: space.sm,
              paddingVertical: space.xs,
              borderRadius: radius.md,
              backgroundColor: isAlteredRate
                ? palette.cobalt
                : palette.transparent,
            }}
          >
            <Text
              variant="numeric"
              tone={isAlteredRate ? "inverse" : "primary"}
              numeric
            >
              {currentBpm != null ? currentBpm.toFixed(1) : "—"}
            </Text>
            <Text
              variant="eyebrow"
              tone={isAlteredRate ? "inverse" : "muted"}
              numeric={isAlteredRate}
            >
              {isAlteredRate ? originalBpm : "BPM"}
            </Text>
          </Pressable>
          <IconButton
            icon={playing ? "pause" : "play"}
            accessibilityLabel={playing ? "Pause" : "Play"}
            onPress={togglePlayPause}
          />
          <IconButton
            icon="list"
            accessibilityLabel="Open queue"
            onPress={() => usePlayerStore.getState().setQueueSheetVisible(true)}
          />
        </HStack>
      </Pressable>

      <Modal
        visible={tempoOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setTempoOpen(false)}
      >
        <Pressable
          flat
          style={{ flex: 1, backgroundColor: "rgba(22,19,14,0.45)" }}
          onPress={() => setTempoOpen(false)}
        />
        <Surface
          tone="raised"
          lift="popover"
          rounded="lg"
          pad="md"
          bordered
          style={{
            position: "absolute",
            left: space.base,
            right: space.base,
            bottom: 110,
          }}
        >
          <HStack gap="md" justify="between">
            <Pressable
              onPress={() => adjustRate(-0.005)}
              hitSlop={space.sm}
              style={{
                minWidth: 64,
                alignItems: "center",
                paddingVertical: space.sm,
                paddingHorizontal: space.md,
                borderRadius: radius.md,
                backgroundColor: palette.paperSunken,
              }}
            >
              <Text variant="bodyStrong">-0.5%</Text>
            </Pressable>
            <VStack gap="xs" align="center" flex>
              <Text variant="title" numeric>
                {rateDisplay}
              </Text>
              {currentBpm != null ? (
                <Text variant="numeric" tone="muted">
                  {currentBpm.toFixed(1)} BPM
                </Text>
              ) : null}
            </VStack>
            <Pressable
              onPress={() => adjustRate(0.005)}
              hitSlop={space.sm}
              style={{
                minWidth: 64,
                alignItems: "center",
                paddingVertical: space.sm,
                paddingHorizontal: space.md,
                borderRadius: radius.md,
                backgroundColor: palette.paperSunken,
              }}
            >
              <Text variant="bodyStrong">+0.5%</Text>
            </Pressable>
          </HStack>
        </Surface>
      </Modal>
    </Surface>
  );
}
