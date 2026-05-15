import { useAuth } from "@clerk/clerk-expo";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system";
import * as Updates from "expo-updates";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  View,
} from "react-native";
import {
  HStack,
  SettingsRow,
  Screen,
  Text,
  VStack,
  palette,
  space,
} from "../../components/ui";
import {
  backfillLocalCache,
  clearLocalCache,
  getCacheSizeBytes,
} from "../../lib/localAudio";
import {
  type DiscogsSyncStatus,
  useDiscogsSyncStore,
} from "../../store/discogsSync";

const API_URL = process.env.EXPO_PUBLIC_API_URL;

type StatusTone = "muted" | "ok" | "error";
type StatusInfo = { text: string; tone: StatusTone };

function describeDiscogsStatus(status: DiscogsSyncStatus): StatusInfo | null {
  switch (status.state) {
    case "idle":
      return null;
    case "running":
      if (status.phase === "starting") {
        return { text: "Starting sync…", tone: "muted" };
      }
      return {
        text: `Syncing ${status.phase}: ${status[status.phase]}`,
        tone: "muted",
      };
    case "done":
      return {
        text: `Synced ${status.collection} + ${status.wantlist} in ${(
          status.durationMs / 1000
        ).toFixed(1)}s`,
        tone: "ok",
      };
    case "error":
      return { text: status.error, tone: "error" };
  }
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function SectionHeader({ label }: { label: string }) {
  return (
    <View
      style={{
        paddingHorizontal: space.base,
        paddingTop: space.lg,
        paddingBottom: space.xs,
      }}
    >
      <Text variant="eyebrow" tone="muted">
        {label}
      </Text>
    </View>
  );
}

function SectionGroup({ children }: { children: React.ReactNode }) {
  return (
    <View
      style={{
        paddingHorizontal: space.base,
        borderTopWidth: 1,
        borderTopColor: palette.paperEdge,
      }}
    >
      {children}
    </View>
  );
}

function StatusLine({
  text,
  tone,
}: {
  text: string;
  tone: "muted" | "positive" | "warning" | "critical";
}) {
  return (
    <View
      style={{
        paddingHorizontal: space.base,
        paddingTop: space.xs,
        paddingBottom: space.sm,
      }}
    >
      <Text variant="caption" tone={tone}>
        {text}
      </Text>
    </View>
  );
}

export default function SettingsScreen() {
  const { getToken, signOut, userId } = useAuth();
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;

  const [cookieStatus, setCookieStatus] = useState<boolean | null>(null);
  const [uploading, setUploading] = useState(false);
  const [cookieMessage, setCookieMessage] = useState<{
    text: string;
    error: boolean;
  } | null>(null);

  const [cacheBytes, setCacheBytes] = useState(0);
  const [clearing, setClearing] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const [syncStarting, setSyncStarting] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);

  const [checking, setChecking] = useState(false);
  const [updateMessage, setUpdateMessage] = useState<{
    text: string;
    error: boolean;
  } | null>(null);

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
    checkCookieStatus();
  }, []);

  useEffect(() => {
    (async () => {
      const token = await getTokenRef.current();
      if (token) await fetchDiscogsCounts(token);
    })();
  }, [fetchDiscogsCounts]);

  useEffect(() => {
    if (discogsStatus.state !== "done") return;
    (async () => {
      const token = await getTokenRef.current();
      if (token) await fetchDiscogsCounts(token);
    })();
  }, [discogsStatus.state, fetchDiscogsCounts]);

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
    setCookieMessage(null);

    try {
      const token = await getToken();
      if (!token) throw new Error("Not authenticated");

      await FileSystem.readAsStringAsync(file.uri);

      const formData = new FormData();
      formData.append("cookies", {
        uri: file.uri,
        name: file.name || "cookies.txt",
        type: "text/plain",
      } as unknown as Blob);

      const res = await fetch(`${API_URL}/cookies`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        setCookieStatus(false);
        setCookieMessage({
          text: data.error || "Upload failed",
          error: true,
        });
      } else {
        setCookieStatus(true);
        setCookieMessage({ text: "Cookies uploaded.", error: false });
      }
    } catch (err) {
      setCookieMessage({
        text: err instanceof Error ? err.message : "Network error — upload failed",
        error: true,
      });
    } finally {
      setUploading(false);
    }
  }

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

  async function checkForUpdate() {
    setChecking(true);
    setUpdateMessage(null);
    try {
      const result = await Updates.checkForUpdateAsync();
      if (!result.isAvailable) {
        setUpdateMessage({ text: "You're on the latest update.", error: false });
      } else {
        setUpdateMessage({ text: "Downloading update…", error: false });
        await Updates.fetchUpdateAsync();
        setUpdateMessage({ text: "Update ready — reloading…", error: false });
        setTimeout(() => Updates.reloadAsync(), 500);
      }
    } catch (e) {
      setUpdateMessage({
        text: e instanceof Error ? e.message : "Update check failed",
        error: true,
      });
    } finally {
      setChecking(false);
    }
  }

  // Derived display values
  const cookieValue =
    cookieStatus === null
      ? "Checking…"
      : cookieStatus
        ? "Loaded"
        : "Missing";
  const cookieValueTone: "muted" | "positive" | "warning" =
    cookieStatus === null ? "muted" : cookieStatus ? "positive" : "warning";

  const discogsValue = useMemo(() => {
    if (discogsCountsLoading && !discogsCounts) return "Checking…";
    if (!discogsCounts) return "Not synced";
    return `${discogsCounts.collection} · ${discogsCounts.wantlist}`;
  }, [discogsCounts, discogsCountsLoading]);

  const discogsStatusInfo = describeDiscogsStatus(discogsStatus);
  const syncing = discogsStatus.state === "running";

  return (
    <Screen scroll={false} inset={false}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: space["2xl"] }}
        showsVerticalScrollIndicator={false}
      >
        {/* Big-title */}
        <View
          style={{
            paddingHorizontal: space.base,
            paddingTop: space.md,
            paddingBottom: space.md,
          }}
        >
          <Text
            variant="titleLg"
            style={{ fontSize: 30, letterSpacing: -0.6 }}
          >
            Settings
          </Text>
        </View>

        {/* YouTube */}
        <SectionHeader label="YouTube" />
        <SectionGroup>
          <SettingsRow
            title="Cookies"
            subtitle="Upload a cookies.txt to authenticate downloads"
            onPress={uploading ? undefined : handleUploadCookies}
            trailing={
              uploading
                ? {
                    type: "value",
                    value: "Uploading…",
                  }
                : {
                    type: "value",
                    value: cookieValue,
                  }
            }
          />
        </SectionGroup>
        {cookieMessage ? (
          <StatusLine
            text={cookieMessage.text}
            tone={cookieMessage.error ? "critical" : "positive"}
          />
        ) : cookieValueTone === "warning" ? (
          <StatusLine
            text="Downloads will fail until cookies are uploaded."
            tone="warning"
          />
        ) : null}

        {/* Storage */}
        <SectionHeader label="Storage" />
        <SectionGroup>
          <SettingsRow
            title="Local audio"
            subtitle="Tracks cached on this device for instant playback"
            trailing={{ type: "value", value: formatBytes(cacheBytes) }}
          />
          <SettingsRow
            title={downloading ? "Downloading…" : "Download all tracks"}
            onPress={downloading ? undefined : handleDownloadAll}
            trailing={
              downloading
                ? undefined
                : { type: "chevron" }
            }
          />
          <SettingsRow
            title={clearing ? "Clearing…" : "Clear cache"}
            tone="destructive"
            onPress={clearing ? undefined : handleClearCache}
          />
        </SectionGroup>

        {/* Discogs */}
        <SectionHeader label="Discogs" />
        <SectionGroup>
          <SettingsRow
            title="Local mirror"
            subtitle="Collection · Wantlist (cached locally)"
            trailing={{ type: "value", value: discogsValue }}
          />
          <SettingsRow
            title={syncing && !syncStarting ? "Syncing…" : "Full sync"}
            subtitle="Rebuilds the local mirror from scratch"
            onPress={
              syncStarting || syncing
                ? undefined
                : () => handleDiscogsSync({ incremental: false })
            }
            trailing={
              syncStarting || syncing
                ? undefined
                : { type: "chevron" }
            }
          />
          <SettingsRow
            title="Quick sync"
            subtitle="Fetches recent additions only"
            onPress={
              syncStarting || syncing
                ? undefined
                : () => handleDiscogsSync({ incremental: true })
            }
            trailing={
              syncStarting || syncing
                ? undefined
                : { type: "chevron" }
            }
          />
        </SectionGroup>
        {discogsStatusInfo ? (
          <StatusLine
            text={discogsStatusInfo.text}
            tone={
              discogsStatusInfo.tone === "ok"
                ? "positive"
                : discogsStatusInfo.tone === "error"
                  ? "critical"
                  : "muted"
            }
          />
        ) : null}
        {syncError ? <StatusLine text={syncError} tone="critical" /> : null}

        {/* App */}
        <SectionHeader label="App" />
        <SectionGroup>
          <SettingsRow
            title="Version"
            trailing={{
              type: "value",
              value: Updates.updateId
                ? Updates.updateId.slice(0, 8)
                : "embedded",
            }}
          />
          <SettingsRow
            title="Channel"
            trailing={{ type: "value", value: Updates.channel || "—" }}
          />
          <SettingsRow
            title="Created"
            trailing={{
              type: "value",
              value: Updates.createdAt
                ? Updates.createdAt.toISOString().slice(0, 10)
                : "—",
            }}
          />
          <SettingsRow
            title={checking ? "Checking…" : "Check for updates"}
            onPress={checking ? undefined : checkForUpdate}
            trailing={checking ? undefined : { type: "chevron" }}
          />
        </SectionGroup>
        {updateMessage ? (
          <StatusLine
            text={updateMessage.text}
            tone={updateMessage.error ? "critical" : "positive"}
          />
        ) : null}

        {/* Account */}
        <SectionHeader label="Account" />
        <SectionGroup>
          <SettingsRow
            title="Sign out"
            tone="destructive"
            onPress={() => signOut()}
          />
        </SectionGroup>

        {/* Inline activity indicator overlay for long actions */}
        {uploading || downloading || clearing || syncStarting ? (
          <HStack
            padX="base"
            padY="md"
            align="center"
            gap="sm"
            justify="center"
          >
            <ActivityIndicator size="small" color={palette.ink} />
            <Text variant="caption" tone="muted">
              Working…
            </Text>
          </HStack>
        ) : null}
      </ScrollView>
    </Screen>
  );
}
