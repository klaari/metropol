import "react-native-get-random-values";
import "../global.css";
import { ClerkProvider, useAuth } from "@clerk/clerk-expo";
import { tokenCache } from "@clerk/clerk-expo/token-cache";
import { ErrorBoundary } from "expo-router";
import { Slot } from "expo-router";
import React, { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import DiscogsMatchBanner from "../components/DiscogsMatchBanner";
import QueueSheet from "../components/QueueSheet";
import { Text, palette, space } from "../components/ui";
import { backfillLocalCache } from "../lib/localAudio";
import { attachQueueListeners, registerPlaybackService, setupPlayer } from "../lib/trackPlayer";
import { useDownloadWs } from "../hooks/useDownloadWs";
import { useAppResumeFetch } from "../hooks/useAppResumeFetch";
import { usePlayerStore } from "../store/player";

const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;

if (!publishableKey) {
  throw new Error("EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY is not set");
}

function AuthenticatedHooks() {
  const { userId } = useAuth();
  const initQueue = usePlayerStore((s) => s.initQueue);
  useDownloadWs();
  useAppResumeFetch();
  useEffect(() => {
    if (!userId) return;
    initQueue(userId);
    backfillLocalCache(userId).catch((e) =>
      console.warn("[localAudio] backfill error:", e?.message ?? e),
    );
  }, [userId, initQueue]);
  return null;
}

function ClerkGate() {
  const { isLoaded, isSignedIn } = useAuth();

  if (!isLoaded) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: palette.paper,
        }}
      >
        <ActivityIndicator color={palette.ink} size="large" />
        <View style={{ marginTop: space.base }}>
          <Text variant="caption" tone="muted">
            Loading auth...
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: palette.paper }}>
      {isSignedIn && <AuthenticatedHooks />}
      <Slot />
      {isSignedIn && <QueueSheet />}
      {isSignedIn && <DiscogsMatchBanner />}
    </View>
  );
}

export { ErrorBoundary };

export default function RootLayout() {
  useEffect(() => {
    registerPlaybackService();
    let detach: (() => void) | undefined;
    setupPlayer().then((ok) => {
      if (ok) detach = attachQueueListeners();
    });
    return () => {
      detach?.();
    };
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: palette.paper }}>
      <ClerkProvider publishableKey={publishableKey} tokenCache={tokenCache}>
        <ClerkGate />
      </ClerkProvider>
    </GestureHandlerRootView>
  );
}
