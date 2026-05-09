import { isClerkAPIResponseError, useSignIn } from "@clerk/clerk-expo";
import { Link, useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, View } from "react-native";
import {
  Button,
  Field,
  HeroSection,
  Input,
  Pressable,
  Screen,
  Surface,
  Text,
  VStack,
  palette,
  radius,
} from "../../components/ui";

export default function SignInScreen() {
  const { signIn, setActive, isLoaded } = useSignIn();
  const router = useRouter();

  const devEmail = process.env.EXPO_PUBLIC_DEV_EMAIL ?? "";
  const devPassword = process.env.EXPO_PUBLIC_DEV_PASSWORD ?? "";

  const [email, setEmail] = useState(devEmail);
  const [password, setPassword] = useState(devPassword);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSignIn() {
    if (!isLoaded) return;

    setError("");
    setLoading(true);

    try {
      const result = await signIn.create({
        identifier: email,
        password,
      });

      if (result.status === "complete" && result.createdSessionId) {
        await setActive({ session: result.createdSessionId });
        router.replace("/(tabs)/library");
      } else {
        setError(`Sign in incomplete: status=${result.status}`);
      }
    } catch (err) {
      if (isClerkAPIResponseError(err)) {
        setError(err.errors[0]?.longMessage ?? "Sign in failed");
      } else {
        setError(err instanceof Error ? err.message : "Something went wrong");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen scroll={false}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <VStack flex justify="center" gap="lg">
          <HeroSection
            large
            visual={
              <View
                style={{
                  width: 72,
                  height: 72,
                  borderRadius: radius.full,
                  backgroundColor: palette.ink,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text variant="titleLg" tone="inverse">
                  ♫
                </Text>
              </View>
            }
            title="Aani"
            subtitle="Sign in to continue"
          />

          <Surface tone="raised" rounded="lg" pad="lg" bordered>
            <VStack gap="md">
              {error ? (
                <Text variant="caption" tone="critical" align="center">
                  {error}
                </Text>
              ) : null}

              <Field label="Email">
                <Input
                  placeholder="you@example.com"
                  autoCapitalize="none"
                  autoComplete="email"
                  keyboardType="email-address"
                  value={email}
                  onChangeText={setEmail}
                />
              </Field>

              <Field label="Password">
                <Input
                  variant="password"
                  placeholder="••••••••"
                  autoComplete="password"
                  value={password}
                  onChangeText={setPassword}
                />
              </Field>

              <Button
                label={loading ? "Signing in" : "Sign In"}
                onPress={handleSignIn}
                disabled={loading}
                block
                leading={loading ? <ActivityIndicator color={palette.inkInverse} /> : null}
              />
            </VStack>
          </Surface>

          <Link href="/(auth)/sign-up" asChild>
            <Pressable flat>
              <View style={{ alignItems: "center", paddingVertical: 12 }}>
                <Text variant="body" tone="muted" align="center">
                  Don't have an account?{" "}
                  <Text variant="bodyStrong" tone="primary">Sign up</Text>
                </Text>
              </View>
            </Pressable>
          </Link>
        </VStack>
      </KeyboardAvoidingView>
    </Screen>
  );
}
