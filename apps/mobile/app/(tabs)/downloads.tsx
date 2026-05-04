import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  FlatList,
  StyleSheet,
  Alert,
  SafeAreaView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import { useAuth } from "@clerk/clerk-expo";
import { useRouter } from "expo-router";
import type { DownloadJob } from "@aani/types";
import { useDownloadsStore } from "../../store/downloads";
import { DownloadJobItem } from "../../components/DownloadJobItem";
import { useDownloadWs } from "../../hooks/useDownloadWs";

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
  const { jobs, isLoading, fetchJobs, submitDownload, dismissJob, retryJob } =
    useDownloadsStore();
  const [url, setUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [inputVisible, setInputVisible] = useState(false);
  const inputRef = useRef<TextInput>(null);

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
      // clipboard read can fail on some devices — fall back to empty
    }
    setUrl(prefill);
    setInputVisible(true);
    // autoFocus on the TextInput handles focus on mount
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

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.heading}>Downloads</Text>

      {sessionExpired && (
        <Pressable
          style={styles.expiredBanner}
          onPress={() => router.push("/(tabs)/settings")}
        >
          <Ionicons name="warning" size={16} color="#f5a623" />
          <Text style={styles.expiredText}>
            YouTube cookies expired — tap to update in Settings
          </Text>
        </Pressable>
      )}

      {recentJobs.length > 0 ? (
        <View style={styles.recentSection}>
          <Text style={styles.recentLabel}>Recent</Text>
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
          />
        </View>
      ) : (
        <View style={styles.emptyContainer}>
          <Ionicons name="cloud-download-outline" size={40} color="#333" />
          <Text style={styles.emptyText}>No downloads yet</Text>
          <Text style={styles.emptyHint}>Tap + to add a YouTube URL</Text>
        </View>
      )}

      {inputVisible ? (
        <View style={styles.inputBar}>
          <Pressable
            style={styles.cancelButton}
            onPress={closeInput}
            hitSlop={8}
            disabled={submitting}
          >
            <Ionicons name="close" size={22} color="#888" />
          </Pressable>
          <TextInput
            ref={inputRef}
            style={styles.input}
            placeholder="Paste YouTube URL..."
            placeholderTextColor="#555"
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
          <Pressable
            style={[
              styles.submitButton,
              (!url.trim() || submitting) && styles.submitButtonDisabled,
            ]}
            onPress={handleSubmit}
            disabled={submitting || !url.trim()}
            hitSlop={4}
          >
            <Ionicons
              name={submitting ? "hourglass-outline" : "arrow-up"}
              size={20}
              color="#000"
            />
          </Pressable>
        </View>
      ) : (
        <Pressable
          style={styles.fab}
          onPress={openInput}
          android_ripple={{ color: "rgba(0,0,0,0.15)" }}
        >
          <Ionicons name="add" size={22} color="#000" />
          <Text style={styles.fabLabel}>Add URL</Text>
        </Pressable>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  heading: {
    color: "#fff",
    fontSize: 28,
    fontWeight: "700",
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
  },
  expiredBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#1a1200",
    marginHorizontal: 16,
    marginBottom: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#3d2800",
  },
  expiredText: {
    color: "#f5a623",
    fontSize: 13,
    flex: 1,
  },
  recentSection: {
    flex: 1,
  },
  recentLabel: {
    color: "#666",
    fontSize: 13,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    paddingHorizontal: 16,
    marginBottom: 4,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
  },
  emptyText: {
    color: "#444",
    fontSize: 15,
  },
  emptyHint: {
    color: "#333",
    fontSize: 13,
  },
  inputBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#222",
  },
  cancelButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  input: {
    flex: 1,
    backgroundColor: "#1a1a1a",
    color: "#fff",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    borderWidth: 1,
    borderColor: "#333",
  },
  submitButton: {
    backgroundColor: "#fff",
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  submitButtonDisabled: {
    opacity: 0.2,
  },
  fab: {
    position: "absolute",
    bottom: 20,
    right: 20,
    flexDirection: "row",
    alignItems: "center",
    height: 48,
    paddingHorizontal: 18,
    paddingRight: 22,
    borderRadius: 24,
    backgroundColor: "#fff",
    elevation: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    gap: 4,
  },
  fabLabel: {
    fontSize: 15,
    fontWeight: "600",
    color: "#000",
  },
});
