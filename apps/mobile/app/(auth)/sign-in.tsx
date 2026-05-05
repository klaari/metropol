import { isClerkAPIResponseError, useSignIn } from "@clerk/clerk-expo";
import { Link, useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, View } from "react-native";
import {
  Button,
  Field,
  Input,
  Pressable,
  Screen,
  Text,
  VStack,
  palette,
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
        <VStack flex justify="center" gap="xl">
          <VStack gap="xs" align="center">
            <Text variant="display" align="center">
              Aani
            </Text>
            <Text variant="body" tone="muted" align="center">
              Sign in to continue
            </Text>
          </VStack>

          <VStack gap="md">
            {error ? (
              <Text variant="caption" tone="critical" align="center">
                {error}
              </Text>
            ) : null}

            <Field label="Email">
              <Input
                placeholder="Email"
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
                placeholder="Password"
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

          <Link href="/(auth)/sign-up" asChild>
            <Pressable flat>
              <View style={{ alignItems: "center" }}>
                <Text variant="body" tone="muted" align="center">
                  Don't have an account?{" "}
                  <Text variant="bodyStrong">Sign up</Text>
                </Text>
              </View>
            </Pressable>
          </Link>
        </VStack>
      </KeyboardAvoidingView>
    </Screen>
  );
}
