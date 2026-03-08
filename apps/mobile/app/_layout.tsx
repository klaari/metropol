import "react-native-get-random-values";
import { ClerkProvider, useAuth } from "@clerk/clerk-expo";
import { tokenCache } from "@clerk/clerk-expo/token-cache";
import { ErrorBoundary } from "expo-router";
import { Slot } from "expo-router";
import React, { useEffect } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { registerPlaybackService, setupPlayer } from "../lib/trackPlayer";
import { useDownloadWs } from "../hooks/useDownloadWs";
import { useAppResumeFetch } from "../hooks/useAppResumeFetch";

const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;

if (!publishableKey) {
  throw new Error("EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY is not set");
}

function AuthenticatedHooks() {
  useDownloadWs();
  useAppResumeFetch();
  return null;
}

function ClerkGate() {
  const { isLoaded, isSignedIn } = useAuth();

  if (!isLoaded) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#000" }}>
        <ActivityIndicator color="#fff" size="large" />
        <Text style={{ color: "#888", marginTop: 16 }}>Loading auth...</Text>
      </View>
    );
  }

  return (
    <>
      {isSignedIn && <AuthenticatedHooks />}
      <Slot />
    </>
  );
}

export { ErrorBoundary };

export default function RootLayout() {
  useEffect(() => {
    // Register and set up audio player after mount — not at module level
    // to avoid native module initialization crashes on startup
    registerPlaybackService();
    setupPlayer();
  }, []);

  return (
    <ClerkProvider publishableKey={publishableKey} tokenCache={tokenCache}>
      <ClerkGate />
    </ClerkProvider>
  );
}
