import type { DownloadJob } from "@aani/types";
import { useAuth } from "@clerk/clerk-expo";
import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Alert, FlatList, View } from "react-native";
import { DownloadJobItem } from "../../components/DownloadJobItem";
import {
  Button,
  Divider,
  HStack,
  IconButton,
  Input,
  Pressable,
  Screen,
  Surface,
  Text,
  VStack,
  palette,
  space,
} from "../../components/ui";
import { useDownloadWs } from "../../hooks/useDownloadWs";
import { useDownloadsStore } from "../../store/downloads";

const API_URL = process.env.EXPO_PUBLIC_API_URL;
const MAX_RECENT_JOBS = 10;

const YOUTUBE_URL_REGEX =
  /^https?:\/\/(www\.)?(youtube\.com|youtu\.be|music\.youtube\.com)\//i;

function isYouTubeUrl(value: string): boolean {
  return YOUTUBE_URL_REGEX.test(value.trim());
}

export default function DownloadsScreen() {
  const { getToken } = useAuth();
  const router = useRouter();
  const { jobs, fetchJobs, submitDownload, dismissJob, retryJob } =
    useDownloadsStore();
  const [url, setUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [inputVisible, setInputVisible] = useState(false);

  useDownloadWs();

  const tokenRef = useRef<string | null>(null);

  async function ensureToken(): Promise<string | null> {
    if (!tokenRef.current) {
      tokenRef.current = await getToken();
    }
    return tokenRef.current;
  }

  useEffect(() => {
    if (!API_URL) return;
    let mounted = true;
    (async () => {
      const token = await ensureToken();
      if (token && mounted) fetchJobs(token);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const hasActiveJobs = jobs.some(
    (j) =>
      j.status === "queued" ||
      j.status === "downloading" ||
      j.status === "uploading",
  );

  useEffect(() => {
    if (!hasActiveJobs || !API_URL) return;
    const id = setInterval(async () => {
      const token = await ensureToken();
      if (token) fetchJobs(token);
    }, 5000);
    return () => clearInterval(id);
  }, [hasActiveJobs]);

  const sessionExpired = jobs.some((j) =>
    j.error?.includes("YouTube session expired"),
  );

  const recentJobs = jobs.slice(0, MAX_RECENT_JOBS);

  const openInput = async () => {
    let prefill = "";
    try {
      const clip = await Clipboard.getStringAsync();
      if (clip && isYouTubeUrl(clip)) {
        prefill = clip.trim();
      }
    } catch {
      // Clipboard reads can fail on some devices.
    }
    setUrl(prefill);
    setInputVisible(true);
  };

  const closeInput = () => {
    setInputVisible(false);
    setUrl("");
  };

  const handleSubmit = async () => {
    const trimmed = url.trim();
    if (!trimmed) return;

    setSubmitting(true);
    const token = await ensureToken();
    if (!token) {
      Alert.alert("Error", "Not authenticated");
      setSubmitting(false);
      return;
    }

    const { error } = await submitDownload(trimmed, token);
    setSubmitting(false);

    if (error) {
      Alert.alert("Download Error", error);
    } else {
      setUrl("");
      setInputVisible(false);
    }
  };

  const handleRetry = async (job: DownloadJob) => {
    const token = await ensureToken();
    if (!token) return;
    const { error } = await retryJob(job, token);
    if (error) Alert.alert("Retry Failed", error);
  };

  const handleDismiss = async (job: DownloadJob) => {
    const token = await ensureToken();
    if (!token) return;
    const { error } = await dismissJob(job.id, token);
    if (error) Alert.alert("Error", error);
  };

  const footer = inputVisible ? (
    <Surface tone="raised" rounded="none" pad="md" bordered>
      <HStack gap="sm">
        <IconButton
          icon="close"
          accessibilityLabel="Cancel URL entry"
          onPress={closeInput}
          disabled={submitting}
          color={palette.inkMuted}
        />
        <View style={{ flex: 1 }}>
          <Input
            variant="search"
            placeholder="Paste YouTube URL..."
            value={url}
            onChangeText={setUrl}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            returnKeyType="go"
            onSubmitEditing={handleSubmit}
            autoFocus
            selectTextOnFocus
          />
        </View>
        <IconButton
          icon={submitting ? "hourglass-outline" : "arrow-up"}
          accessibilityLabel="Submit URL"
          variant="filled"
          onPress={handleSubmit}
          disabled={submitting || !url.trim()}
        />
      </HStack>
    </Surface>
  ) : (
    <Surface tone="raised" rounded="none" pad="md" bordered>
      <Button
        label="Add URL"
        onPress={openInput}
        block
        leading={<Ionicons name="add" size={20} color={palette.inkInverse} />}
      />
    </Surface>
  );

  const jobCount = recentJobs.length;
  const jobCountLabel = jobCount === 1 ? "1 job" : `${jobCount} jobs`;

  return (
    <Screen scroll={false} footer={footer}>
      <VStack flex gap="lg">
        <VStack gap="xs">
          <Text variant="eyebrow" tone="muted">
            Queue
          </Text>
          <Text variant="titleLg">
            {jobCount > 0 ? jobCountLabel : "Downloads"}
          </Text>
        </VStack>

        {sessionExpired ? (
          <Pressable flat onPress={() => router.push("/(tabs)/settings")}>
            <Surface tone="raised" rounded="md" pad="md" bordered>
              <HStack gap="sm" align="center">
                <Ionicons name="warning-outline" size={18} color={palette.warning} />
                <View style={{ flex: 1 }}>
                  <Text variant="caption" tone="warning">
                    YouTube cookies expired — tap to update in Settings
                  </Text>
                </View>
                <Ionicons
                  name="chevron-forward"
                  size={16}
                  color={palette.warning}
                />
              </HStack>
            </Surface>
          </Pressable>
        ) : null}

        {recentJobs.length > 0 ? (
          <FlatList
            data={recentJobs}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <DownloadJobItem
                job={item}
                onRetry={() => handleRetry(item)}
                onDismiss={() => handleDismiss(item)}
              />
            )}
            ItemSeparatorComponent={() => <Divider indent={64} inset="none" />}
            contentContainerStyle={{ paddingBottom: space.md }}
            showsVerticalScrollIndicator={false}
          />
        ) : (
          <VStack flex justify="center" align="center" gap="sm">
            <Ionicons
              name="cloud-download-outline"
              size={48}
              color={palette.inkFaint}
            />
            <Text variant="title" align="center">
              No downloads yet
            </Text>
            <Text variant="body" tone="muted" align="center">
              Tap Add URL to fetch a YouTube track
            </Text>
          </VStack>
        )}
      </VStack>
    </Screen>
  );
}
