import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Alert,
  ScrollView,
} from "react-native";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system";
import * as Updates from "expo-updates";
import { useAuth } from "@clerk/clerk-expo";
import { backfillLocalCache, clearLocalCache, getCacheSizeBytes } from "../../lib/localAudio";
import { useDiscogsSyncStore } from "../../store/discogsSync";

const API_URL = process.env.EXPO_PUBLIC_API_URL;

export default function SettingsScreen() {
  const { getToken, signOut, userId } = useAuth();
  const [cookieStatus, setCookieStatus] = useState<boolean | null>(null);
  const [uploading, setUploading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  const [checking, setChecking] = useState(false);
  const [updateMessage, setUpdateMessage] = useState<string | null>(null);
  const [updateError, setUpdateError] = useState(false);
  const [cacheBytes, setCacheBytes] = useState(0);
  const [clearing, setClearing] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [syncStarting, setSyncStarting] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const discogsCounts = useDiscogsSyncStore((s) => s.counts);
  const discogsCountsLoading = useDiscogsSyncStore((s) => s.countsLoading);
  const discogsStatus = useDiscogsSyncStore((s) => s.status);
  const fetchDiscogsCounts = useDiscogsSyncStore((s) => s.fetchCounts);
  const startDiscogsSync = useDiscogsSyncStore((s) => s.startSync);

  function refreshCacheSize() {
    setCacheBytes(getCacheSizeBytes());
  }

  useEffect(() => {
    refreshCacheSize();
  }, []);

  async function handleClearCache() {
    if (!userId) return;
    Alert.alert(
      "Clear local audio?",
      "Tracks will stream from R2 next time and re-download in the background.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear",
          style: "destructive",
          onPress: async () => {
            setClearing(true);
            try {
              await clearLocalCache(userId);
              refreshCacheSize();
            } finally {
              setClearing(false);
            }
          },
        },
      ],
    );
  }

  async function handleDownloadAll() {
    if (!userId) return;
    setDownloading(true);
    try {
      await backfillLocalCache(userId);
      refreshCacheSize();
    } finally {
      setDownloading(false);
    }
  }

  function formatBytes(n: number): string {
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
    if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
    return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
  }

  async function checkForUpdate() {
    setChecking(true);
    setUpdateMessage(null);
    setUpdateError(false);
    try {
      const result = await Updates.checkForUpdateAsync();
      if (!result.isAvailable) {
        setUpdateMessage("You're on the latest update.");
      } else {
        setUpdateMessage("Downloading update...");
        await Updates.fetchUpdateAsync();
        setUpdateMessage("Update ready — reloading...");
        setTimeout(() => Updates.reloadAsync(), 500);
      }
    } catch (e) {
      setUpdateError(true);
      setUpdateMessage(
        e instanceof Error ? e.message : "Update check failed",
      );
    } finally {
      setChecking(false);
    }
  }

  useEffect(() => {
    checkCookieStatus();
  }, []);

  useEffect(() => {
    (async () => {
      const token = await getToken();
      if (token) await fetchDiscogsCounts(token);
    })();
  }, [fetchDiscogsCounts, getToken]);

  useEffect(() => {
    if (discogsStatus.state === "done") {
      (async () => {
        const token = await getToken();
        if (token) await fetchDiscogsCounts(token);
      })();
    }
  }, [discogsStatus, fetchDiscogsCounts, getToken]);

  async function handleDiscogsSync(opts: { incremental?: boolean }) {
    setSyncStarting(true);
    setSyncError(null);
    try {
      const token = await getToken();
      if (!token) {
        setSyncError("Not authenticated");
        return;
      }
      const { error } = await startDiscogsSync(token, opts);
      if (error) setSyncError(error);
    } finally {
      setSyncStarting(false);
    }
  }

  function discogsStatusLine(): { text: string; tone: "muted" | "ok" | "error" } | null {
    switch (discogsStatus.state) {
      case "idle":
        return null;
      case "running": {
        if (discogsStatus.phase === "starting") {
          return { text: "Starting sync...", tone: "muted" };
        }
        const label = discogsStatus.phase === "collection" ? "collection" : "wantlist";
        const n =
          discogsStatus.phase === "collection"
            ? discogsStatus.collection
            : discogsStatus.wantlist;
        return {
          text: `Syncing ${label}: ${n}`,
          tone: "muted",
        };
      }
      case "done": {
        const seconds = (discogsStatus.durationMs / 1000).toFixed(1);
        return {
          text: `Synced ${discogsStatus.collection} + ${discogsStatus.wantlist} in ${seconds}s`,
          tone: "ok",
        };
      }
      case "error":
        return { text: discogsStatus.error, tone: "error" };
    }
  }

  async function checkCookieStatus() {
    if (!API_URL) return;
    const token = await getToken();
    if (!token) return;

    try {
      const res = await fetch(`${API_URL}/cookies`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setCookieStatus(data.loaded ?? false);
    } catch {
      setCookieStatus(false);
    }
  }

  async function handleUploadCookies() {
    if (!API_URL) {
      Alert.alert("Error", "API URL not configured");
      return;
    }

    const result = await DocumentPicker.getDocumentAsync({
      type: "text/plain",
      copyToCacheDirectory: true,
    });

    if (result.canceled || result.assets.length === 0) return;

    const file = result.assets[0]!;
    setUploading(true);
    setStatusMessage(null);
    setIsError(false);

    try {
      const token = await getToken();
      if (!token) throw new Error("Not authenticated");

      const fileContent = await FileSystem.readAsStringAsync(file.uri);

      const formData = new FormData();
      formData.append("cookies", {
        uri: file.uri,
        name: file.name || "cookies.txt",
        type: "text/plain",
      } as unknown as Blob);

      const res = await fetch(`${API_URL}/cookies`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        setIsError(true);
        setStatusMessage(data.error || "Upload failed");
        setCookieStatus(false);
      } else {
        setCookieStatus(true);
        setStatusMessage("Cookies uploaded successfully");
      }
    } catch (err) {
      setIsError(true);
      setStatusMessage(
        err instanceof Error ? err.message : "Network error — upload failed",
      );
    } finally {
      setUploading(false);
    }
  }

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.heading}>Settings</Text>

      {/* YouTube Cookies */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>YouTube Cookies</Text>
        <Text style={styles.description}>
          Upload a cookies.txt file from your browser to authenticate YouTube
          downloads. Use a browser extension like "Get cookies.txt LOCALLY" to
          export your YouTube cookies.
        </Text>

        <View style={styles.statusRow}>
          <Text style={styles.statusLabel}>Status:</Text>
          {cookieStatus === null ? (
            <Text style={styles.statusChecking}>Checking...</Text>
          ) : cookieStatus ? (
            <Text style={styles.statusLoaded}>Cookies loaded</Text>
          ) : (
            <Text style={styles.statusNotLoaded}>
              No cookies — downloads may fail
            </Text>
          )}
        </View>

        <Pressable
          style={[styles.uploadButton, uploading && styles.buttonDisabled]}
          onPress={handleUploadCookies}
          disabled={uploading}
        >
          {uploading ? (
            <ActivityIndicator color="#000" size="small" />
          ) : (
            <Text style={styles.uploadButtonText}>Upload cookies.txt</Text>
          )}
        </Pressable>

        {statusMessage && (
          <Text style={[styles.statusMsg, isError && styles.statusMsgError]}>
            {statusMessage}
          </Text>
        )}
      </View>

      {/* Local audio */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Local audio</Text>
        <Text style={styles.description}>
          Tracks are downloaded to this device so playback starts instantly.
          New tracks download in the background.
        </Text>
        <View style={styles.statusRow}>
          <Text style={styles.statusLabel}>Used:</Text>
          <Text style={styles.statusLoaded}>{formatBytes(cacheBytes)}</Text>
        </View>
        <Pressable
          style={[styles.smallButton, downloading && styles.buttonDisabled]}
          onPress={handleDownloadAll}
          disabled={downloading}
        >
          {downloading ? (
            <ActivityIndicator color="#000" size="small" />
          ) : (
            <Text style={styles.smallButtonText}>Download all</Text>
          )}
        </Pressable>
        <Pressable
          onPress={handleClearCache}
          disabled={clearing}
          hitSlop={6}
          style={styles.linkBtn}
        >
          {clearing ? (
            <ActivityIndicator color="#666" size="small" />
          ) : (
            <Text style={styles.linkBtnText}>Clear cache</Text>
          )}
        </Pressable>
      </View>

      {/* Discogs sync */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Discogs sync</Text>
        <Text style={styles.description}>
          Mirror your Discogs collection and wantlist locally so search and
          auto-match are instant. Full sync rebuilds; quick sync only fetches
          recent additions.
        </Text>
        <View style={styles.statusRow}>
          <Text style={styles.statusLabel}>Local mirror:</Text>
          {discogsCountsLoading && !discogsCounts ? (
            <Text style={styles.statusChecking}>Checking...</Text>
          ) : discogsCounts ? (
            <Text style={styles.statusLoaded}>
              {discogsCounts.collection} collection · {discogsCounts.wantlist} wantlist
            </Text>
          ) : (
            <Text style={styles.statusNotLoaded}>Not synced yet</Text>
          )}
        </View>
        <View style={styles.buttonRow}>
          <Pressable
            style={[
              styles.smallButton,
              (syncStarting || discogsStatus.state === "running") && styles.buttonDisabled,
            ]}
            onPress={() => handleDiscogsSync({ incremental: false })}
            disabled={syncStarting || discogsStatus.state === "running"}
          >
            {syncStarting && discogsStatus.state !== "running" ? (
              <ActivityIndicator color="#000" size="small" />
            ) : (
              <Text style={styles.smallButtonText}>Full sync</Text>
            )}
          </Pressable>
          <Pressable
            onPress={() => handleDiscogsSync({ incremental: true })}
            disabled={syncStarting || discogsStatus.state === "running"}
            hitSlop={6}
            style={styles.linkBtn}
          >
            <Text style={styles.linkBtnText}>Quick sync</Text>
          </Pressable>
        </View>
        {(() => {
          const line = discogsStatusLine();
          if (!line) return null;
          return (
            <Text
              style={[
                styles.statusMsg,
                line.tone === "error" && styles.statusMsgError,
                line.tone === "muted" && styles.statusMsgMuted,
              ]}
            >
              {line.text}
            </Text>
          );
        })()}
        {syncError && (
          <Text style={[styles.statusMsg, styles.statusMsgError]}>{syncError}</Text>
        )}
      </View>

      {/* App Updates */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>App version</Text>
        <Text style={styles.versionLine}>
          Update ID: {Updates.updateId ? Updates.updateId.slice(0, 8) : "embedded"}
        </Text>
        <Text style={styles.versionLine}>
          Created: {Updates.createdAt ? Updates.createdAt.toISOString().slice(0, 19).replace("T", " ") : "—"}
        </Text>
        <Text style={styles.versionLine}>
          Channel: {Updates.channel || "—"}
        </Text>
        <Pressable style={styles.smallButton} onPress={checkForUpdate}>
          {checking ? (
            <ActivityIndicator color="#000" size="small" />
          ) : (
            <Text style={styles.smallButtonText}>Check for updates</Text>
          )}
        </Pressable>
        {updateMessage && (
          <Text style={[styles.statusMsg, updateError && styles.statusMsgError]}>
            {updateMessage}
          </Text>
        )}
      </View>

      {/* Sign Out */}
      <View style={styles.section}>
        <Pressable style={styles.signOutButton} onPress={() => signOut()}>
          <Text style={styles.signOutText}>Sign Out</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
    paddingHorizontal: 16,
  },
  heading: {
    color: "#fff",
    fontSize: 28,
    fontWeight: "700",
    paddingTop: 16,
    paddingBottom: 24,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 8,
  },
  description: {
    color: "#888",
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
    gap: 8,
  },
  statusLabel: {
    color: "#888",
    fontSize: 14,
  },
  statusChecking: {
    color: "#888",
    fontSize: 14,
    fontStyle: "italic",
  },
  statusLoaded: {
    color: "#4cd964",
    fontSize: 14,
    fontWeight: "600",
  },
  statusNotLoaded: {
    color: "#f5a623",
    fontSize: 14,
    fontWeight: "600",
  },
  uploadButton: {
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 14,
    alignItems: "center",
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  uploadButtonText: {
    color: "#000",
    fontSize: 16,
    fontWeight: "600",
  },
  statusMsg: {
    color: "#4cd964",
    fontSize: 13,
    marginTop: 8,
    textAlign: "center",
  },
  statusMsgError: {
    color: "#ff3b30",
  },
  statusMsgMuted: {
    color: "#888",
  },
  buttonRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  versionLine: {
    color: "#888",
    fontSize: 13,
    fontFamily: "monospace",
    marginBottom: 4,
  },
  checkButton: {
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 14,
    alignItems: "center",
    marginTop: 12,
  },
  checkButtonText: {
    color: "#000",
    fontSize: 15,
    fontWeight: "600",
  },
  smallButton: {
    alignSelf: "flex-start",
    backgroundColor: "#fff",
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginTop: 8,
  },
  smallButtonText: {
    color: "#000",
    fontSize: 13,
    fontWeight: "600",
  },
  linkBtn: {
    alignSelf: "flex-start",
    paddingVertical: 8,
    paddingHorizontal: 4,
    marginTop: 4,
  },
  linkBtnText: {
    color: "#888",
    fontSize: 13,
    textDecorationLine: "underline",
  },
  signOutButton: {
    borderWidth: 1,
    borderColor: "#333",
    borderRadius: 10,
    padding: 14,
    alignItems: "center",
  },
  signOutText: {
    color: "#ff3b30",
    fontSize: 16,
    fontWeight: "600",
  },
});
