import { isClerkAPIResponseError, useSignUp } from "@clerk/clerk-expo";
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

export default function SignUpScreen() {
  const { signUp, setActive, isLoaded } = useSignUp();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [pendingVerification, setPendingVerification] = useState(false);

  async function handleSignUp() {
    if (!isLoaded) return;

    setError("");
    setLoading(true);

    try {
      await signUp.create({ emailAddress: email, password });
      await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
      setPendingVerification(true);
    } catch (err) {
      if (isClerkAPIResponseError(err)) {
        setError(err.errors[0]?.longMessage ?? "Sign up failed");
      } else {
        setError("Something went wrong");
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleVerify() {
    if (!isLoaded) return;

    setError("");
    setLoading(true);

    try {
      const result = await signUp.attemptEmailAddressVerification({ code });

      if (result.status === "complete" && result.createdSessionId) {
        await setActive({ session: result.createdSessionId });
        router.replace("/(tabs)/library");
      }
    } catch (err) {
      if (isClerkAPIResponseError(err)) {
        setError(err.errors[0]?.longMessage ?? "Verification failed");
      } else {
        setError("Something went wrong");
      }
    } finally {
      setLoading(false);
    }
  }

  const title = pendingVerification ? "Verify Email" : "Aani";
  const subtitle = pendingVerification
    ? `Enter the code sent to ${email}`
    : "Create your account";

  return (
    <Screen scroll={false}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <VStack flex justify="center" gap="xl">
          <VStack gap="xs" align="center">
            <Text
              variant={pendingVerification ? "titleLg" : "display"}
              align="center"
            >
              {title}
            </Text>
            <Text variant="body" tone="muted" align="center">
              {subtitle}
            </Text>
          </VStack>

          <VStack gap="md">
            {error ? (
              <Text variant="caption" tone="critical" align="center">
                {error}
              </Text>
            ) : null}

            {pendingVerification ? (
              <Field label="Verification code">
                <Input
                  placeholder="Verification code"
                  keyboardType="number-pad"
                  autoComplete="one-time-code"
                  value={code}
                  onChangeText={setCode}
                />
              </Field>
            ) : (
              <>
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
                    autoComplete="new-password"
                    value={password}
                    onChangeText={setPassword}
                  />
                </Field>
              </>
            )}

            <Button
              label={
                loading
                  ? pendingVerification
                    ? "Verifying"
                    : "Creating"
                  : pendingVerification
                    ? "Verify"
                    : "Sign Up"
              }
              onPress={pendingVerification ? handleVerify : handleSignUp}
              disabled={loading}
              block
              leading={loading ? <ActivityIndicator color={palette.inkInverse} /> : null}
            />
          </VStack>

          {pendingVerification ? (
            <Pressable flat onPress={() => setPendingVerification(false)}>
              <View style={{ alignItems: "center" }}>
                <Text variant="body" tone="muted" align="center">
                  Back to sign up
                </Text>
              </View>
            </Pressable>
          ) : (
            <Link href="/(auth)/sign-in" asChild>
              <Pressable flat>
                <View style={{ alignItems: "center" }}>
                  <Text variant="body" tone="muted" align="center">
                    Already have an account?{" "}
                    <Text variant="bodyStrong">Sign in</Text>
                  </Text>
                </View>
              </Pressable>
            </Link>
          )}
        </VStack>
      </KeyboardAvoidingView>
    </Screen>
  );
}
