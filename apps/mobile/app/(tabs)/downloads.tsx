import type { DownloadJob, DownloadJobStatus } from "@aani/types";
import { useAuth } from "@clerk/clerk-expo";
import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import { useRouter } from "expo-router";
import { memo, useEffect, useState, type ComponentProps } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  TextInput,
  View,
  type ListRenderItemInfo,
} from "react-native";
import {
  HStack,
  IconButton,
  Pressable,
  Screen,
  Text,
  VStack,
  border,
  icon as iconTokens,
  palette,
  radius,
  space,
  typeScale,
} from "../../components/ui";
import { useDownloadWs } from "../../hooks/useDownloadWs";
import { useDownloadsStore } from "../../store/downloads";

type IconName = ComponentProps<typeof Ionicons>["name"];

const API_URL = process.env.EXPO_PUBLIC_API_URL;
const MAX_RECENT_JOBS = 50;

const YOUTUBE_URL_REGEX =
  /^https?:\/\/(www\.)?(youtube\.com|youtu\.be|music\.youtube\.com)\//i;

function isYouTubeUrl(value: string): boolean {
  return YOUTUBE_URL_REGEX.test(value.trim());
}

function shortUrl(url: string): string {
  return url.replace(/^https?:\/\/(www\.)?/, "").replace(/[?&].*$/, "");
}

interface StatusGlyph {
  icon: IconName;
  color: string;
  spinning?: boolean;
}

const STATUS_GLYPH: Record<DownloadJobStatus, StatusGlyph> = {
  queued: { icon: "ellipse-outline", color: palette.inkFaint },
  downloading: { icon: "ellipsis-horizontal", color: palette.cobalt, spinning: true },
  uploading: { icon: "ellipsis-horizontal", color: palette.warning, spinning: true },
  completed: { icon: "checkmark", color: palette.positive },
  failed: { icon: "close", color: palette.critical },
};

interface DownloadRowProps {
  job: DownloadJob;
  onRetry: () => void;
  onDismiss: () => void;
}

const DownloadRow = memo(function DownloadRow({
  job,
  onRetry,
  onDismiss,
}: DownloadRowProps) {
  const g = STATUS_GLYPH[job.status] ?? STATUS_GLYPH.queued;
  const title = job.title || shortUrl(job.url);
  const isFailed = job.status === "failed";
  const isActive =
    job.status === "downloading" ||
    job.status === "uploading" ||
    job.status === "queued";

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "flex-start",
        gap: space.sm,
        paddingVertical: 6,
        paddingHorizontal: space.base,
      }}
    >
      <View
        style={{
          width: 16,
          paddingTop: 3,
          alignItems: "center",
        }}
      >
        {g.spinning ? (
          <ActivityIndicator size="small" color={g.color} />
        ) : (
          <Ionicons name={g.icon} size={14} color={g.color} />
        )}
      </View>

      <View style={{ flex: 1, minWidth: 0 }}>
        <Text
          variant="caption"
          numberOfLines={1}
          style={{
            color: isActive ? palette.ink : palette.inkSoft,
            fontWeight: isActive ? "500" : "400",
          }}
        >
          {title}
        </Text>
        {isFailed && job.error ? (
          <Text variant="caption" tone="critical" numberOfLines={2} style={{ fontSize: 11 }}>
            {job.error}
          </Text>
        ) : null}
      </View>

      {isFailed ? (
        <HStack gap="xs">
          <IconButton
            icon="refresh"
            accessibilityLabel="Retry"
            color={palette.cobalt}
            size={14}
            onPress={onRetry}
          />
          <IconButton
            icon="close"
            accessibilityLabel="Dismiss"
            color={palette.inkFaint}
            size={14}
            onPress={onDismiss}
          />
        </HStack>
      ) : job.status === "completed" ? (
        <Pressable
          flat
          onPress={onDismiss}
          accessibilityLabel="Dismiss"
          hitSlop={8}
          style={{ padding: 2 }}
        >
          <Ionicons name="close" size={12} color={palette.inkFaint} />
        </Pressable>
      ) : null}
    </View>
  );
});

interface UrlBarProps {
  url: string;
  setUrl: (v: string) => void;
  submitting: boolean;
  onSubmit: () => void;
}

function UrlBar({ url, setUrl, submitting, onSubmit }: UrlBarProps) {
  const [focused, setFocused] = useState(false);
  const valid = url.trim().length > 0 && isYouTubeUrl(url);

  const handlePaste = async () => {
    try {
      const clip = await Clipboard.getStringAsync();
      if (clip) setUrl(clip.trim());
    } catch {
      // ignore
    }
  };

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: space.sm,
        minHeight: 56,
        paddingHorizontal: space.md,
        borderRadius: radius.lg,
        backgroundColor: palette.paperRaised,
        borderWidth: focused ? border.thick : border.hair,
        borderColor: focused ? palette.cobalt : palette.paperEdge,
      }}
    >
      <Ionicons
        name="link-outline"
        size={iconTokens.size.base}
        color={palette.inkMuted}
      />
      <TextInput
        value={url}
        onChangeText={setUrl}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder="Paste a YouTube URL"
        placeholderTextColor={palette.inkMuted}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
        returnKeyType="go"
        onSubmitEditing={onSubmit}
        selectTextOnFocus
        cursorColor={palette.ink}
        selectionColor={palette.cobaltSoft}
        style={{
          flex: 1,
          color: palette.ink,
          paddingVertical: 0,
          ...typeScale.body,
        }}
      />
      {url.length > 0 ? (
        <Pressable
          flat
          onPress={() => setUrl("")}
          accessibilityLabel="Clear"
          hitSlop={8}
          style={{ padding: 2 }}
        >
          <Ionicons
            name="close-circle"
            size={iconTokens.size.base}
            color={palette.inkMuted}
          />
        </Pressable>
      ) : (
        <Pressable
          flat
          onPress={handlePaste}
          accessibilityLabel="Paste from clipboard"
          hitSlop={8}
          style={{
            paddingVertical: 4,
            paddingHorizontal: 10,
            borderRadius: radius.full,
            backgroundColor: palette.paperEdge,
          }}
        >
          <Text variant="caption" tone="secondary" style={{ fontWeight: "600" }}>
            Paste
          </Text>
        </Pressable>
      )}
      <Pressable
        flat
        onPress={onSubmit}
        disabled={!valid || submitting}
        accessibilityLabel="Download"
        accessibilityRole="button"
        style={{
          width: 36,
          height: 36,
          borderRadius: radius.full,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: valid && !submitting ? palette.ink : palette.paperEdge,
        }}
      >
        {submitting ? (
          <ActivityIndicator size="small" color={palette.inkInverse} />
        ) : (
          <Ionicons
            name="arrow-down"
            size={18}
            color={valid ? palette.inkInverse : palette.inkFaint}
          />
        )}
      </Pressable>
    </View>
  );
}

export default function DownloadsScreen() {
  const { getToken } = useAuth();
  const router = useRouter();
  const { jobs, fetchJobs, submitDownload, dismissJob, retryJob } =
    useDownloadsStore();
  const [url, setUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useDownloadWs();

  useEffect(() => {
    if (!API_URL) return;
    let mounted = true;
    (async () => {
      const token = await getToken();
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
      const token = await getToken();
      if (token) fetchJobs(token);
    }, 5000);
    return () => clearInterval(id);
  }, [hasActiveJobs]);

  const latestJob = jobs[0];
  const sessionExpired =
    latestJob?.status === "failed" &&
    latestJob.error?.includes("YouTube session expired") === true;

  const recentJobs = jobs.slice(0, MAX_RECENT_JOBS);

  const handleSubmit = async () => {
    const trimmed = url.trim();
    if (!trimmed) return;

    setSubmitting(true);
    const token = await getToken();
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
    }
  };

  const handleRetry = async (job: DownloadJob) => {
    const token = await getToken();
    if (!token) return;
    const { error } = await retryJob(job, token);
    if (error) Alert.alert("Retry Failed", error);
  };

  const handleDismiss = async (job: DownloadJob) => {
    const token = await getToken();
    if (!token) return;
    const { error } = await dismissJob(job.id, token);
    if (error) Alert.alert("Error", error);
  };

  const renderItem = ({ item }: ListRenderItemInfo<DownloadJob>) => (
    <DownloadRow
      job={item}
      onRetry={() => handleRetry(item)}
      onDismiss={() => handleDismiss(item)}
    />
  );

  return (
    <Screen scroll={false} inset={false}>
      <VStack flex>
        {/* Title */}
        <View style={{ paddingHorizontal: space.base, paddingTop: space.md }}>
          <Text
            variant="titleLg"
            style={{ fontSize: 30, letterSpacing: -0.6 }}
          >
            Downloads
          </Text>
        </View>

        {/* URL bar — always visible, the primary action */}
        <View
          style={{
            paddingHorizontal: space.base,
            paddingTop: space.md,
            paddingBottom: space.md,
          }}
        >
          <UrlBar
            url={url}
            setUrl={setUrl}
            submitting={submitting}
            onSubmit={handleSubmit}
          />
        </View>

        {/* Session-expired banner */}
        {sessionExpired ? (
          <Pressable
            flat
            onPress={() => router.push("/(tabs)/settings")}
            accessibilityLabel="Update YouTube cookies"
            accessibilityRole="link"
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: space.sm,
              marginHorizontal: space.base,
              marginBottom: space.sm,
              paddingVertical: space.sm,
              paddingHorizontal: space.md,
              borderRadius: radius.md,
              backgroundColor: palette.paperSunken,
              borderLeftWidth: 2,
              borderLeftColor: palette.warning,
            }}
          >
            <Ionicons
              name="warning-outline"
              size={16}
              color={palette.warning}
            />
            <Text
              variant="caption"
              tone="warning"
              style={{ flex: 1 }}
              numberOfLines={2}
            >
              YouTube cookies expired — tap to update in Settings
            </Text>
            <Ionicons
              name="chevron-forward"
              size={14}
              color={palette.warning}
            />
          </Pressable>
        ) : null}

        {/* Log */}
        {recentJobs.length > 0 ? (
          <>
            <View
              style={{
                paddingHorizontal: space.base,
                paddingTop: space.sm,
                paddingBottom: space.xs,
                borderTopWidth: 1,
                borderTopColor: palette.paperEdge,
              }}
            >
              <Text variant="eyebrow" tone="muted">
                Activity
              </Text>
            </View>
            <FlatList
              data={recentJobs}
              keyExtractor={(item) => item.id}
              renderItem={renderItem}
              contentContainerStyle={{ paddingBottom: space["2xl"] }}
              showsVerticalScrollIndicator={false}
            />
          </>
        ) : (
          <VStack flex justify="center" align="center" gap="sm" padX="base">
            <Ionicons
              name="cloud-download-outline"
              size={48}
              color={palette.inkFaint}
            />
            <Text variant="title" align="center">
              No downloads yet
            </Text>
            <Text variant="body" tone="muted" align="center">
              Paste a YouTube URL above to fetch a track.
            </Text>
          </VStack>
        )}
      </VStack>
    </Screen>
  );
}
