import "react-native-get-random-values";
import { ClerkProvider, useAuth } from "@clerk/clerk-expo";
import { tokenCache } from "@clerk/clerk-expo/token-cache";
import { ErrorBoundary } from "expo-router";
import { Slot } from "expo-router";
import React, { useEffect } from "react";
import { ActivityIndicator, LogBox, ScrollView, Text, View } from "react-native";
import { registerPlaybackService, setupPlayer } from "../lib/trackPlayer";

// Log all unhandled JS errors to the terminal
const origHandler = ErrorUtils.getGlobalHandler();
ErrorUtils.setGlobalHandler((error, isFatal) => {
  console.error("[CRASH]", isFatal ? "FATAL:" : "", error?.message ?? error);
  console.error("[CRASH] stack:", error?.stack ?? "no stack");
  origHandler(error, isFatal);
});

const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;

if (!publishableKey) {
  throw new Error("EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY is not set");
}

registerPlaybackService();

function ClerkGate() {
  const { isLoaded } = useAuth();

  if (!isLoaded) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#000" }}>
        <ActivityIndicator color="#fff" size="large" />
        <Text style={{ color: "#888", marginTop: 16 }}>Loading auth...</Text>
      </View>
    );
  }

  return <Slot />;
}

export { ErrorBoundary };

export default function RootLayout() {
  useEffect(() => {
    setupPlayer();
  }, []);

  return (
    <ClerkProvider publishableKey={publishableKey} tokenCache={tokenCache}>
      <ClerkGate />
    </ClerkProvider>
  );
}
