import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system";
import * as Updates from "expo-updates";
import { useAuth } from "@clerk/clerk-expo";
import { backfillLocalCache, clearLocalCache, getCacheSizeBytes } from "../../lib/localAudio";
import { type DiscogsSyncStatus, useDiscogsSyncStore } from "../../store/discogsSync";
import {
  Button,
  ContentBlock,
  HStack,
  Inline,
  PageSection,
  Screen,
  Text,
  VStack,
  palette,
} from "../../components/ui";

const API_URL = process.env.EXPO_PUBLIC_API_URL;

type StatusInfo = { text: string; tone: "muted" | "ok" | "error" };

function describeDiscogsStatus(status: DiscogsSyncStatus): StatusInfo | null {
  switch (status.state) {
    case "idle":
      return null;
    case "running":
      if (status.phase === "starting") {
        return { text: "Starting sync...", tone: "muted" };
      }
      return {
        text: `Syncing ${status.phase}: ${status[status.phase]}`,
        tone: "muted",
      };
    case "done":
      return {
        text: `Synced ${status.collection} + ${status.wantlist} in ${(status.durationMs / 1000).toFixed(1)}s`,
        tone: "ok",
      };
    case "error":
      return { text: status.error, tone: "error" };
  }
}

export default function SettingsScreen() {
  const { getToken, signOut, userId } = useAuth();
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;
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

  const discogsStatusInfo = describeDiscogsStatus(discogsStatus);

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

  const statusTone = (tone: StatusInfo["tone"]) => {
    if (tone === "ok") return "positive" as const;
    if (tone === "error") return "critical" as const;
    return "muted" as const;
  };

  return (
    <Screen>
      <VStack gap="xl">
        <Text variant="titleLg">Settings</Text>

        <PageSection eyebrow="YouTube" title="Cookies">
          <ContentBlock>
            <Text variant="body" tone="muted">
          Upload a cookies.txt file from your browser to authenticate YouTube
          downloads. Use a browser extension like "Get cookies.txt LOCALLY" to
          export your YouTube cookies.
            </Text>

        <Inline>
          <Text variant="body" tone="muted">Status</Text>
          {cookieStatus === null ? (
            <Text variant="caption" tone="muted" italic>Checking...</Text>
          ) : cookieStatus ? (
            <Text variant="bodyStrong" tone="positive">Cookies loaded</Text>
          ) : (
            <Text variant="bodyStrong" tone="warning">
              No cookies — downloads may fail
            </Text>
          )}
        </Inline>

        <Button
          label={uploading ? "Uploading" : "Upload cookies.txt"}
          onPress={handleUploadCookies}
          disabled={uploading}
          leading={uploading ? <ActivityIndicator color={palette.inkInverse} size="small" /> : null}
        />

        {statusMessage && (
          <Text variant="caption" tone={isError ? "critical" : "positive"} align="center">
            {statusMessage}
          </Text>
        )}
          </ContentBlock>
        </PageSection>

        <PageSection eyebrow="Storage" title="Local audio">
          <ContentBlock>
        <Text variant="body" tone="muted">
          Tracks are downloaded to this device so playback starts instantly.
          New tracks download in the background.
        </Text>
        <Inline>
          <Text variant="body" tone="muted">Used</Text>
          <Text variant="numeric" tone="positive">{formatBytes(cacheBytes)}</Text>
        </Inline>
        <HStack gap="md">
        <Button
          label={downloading ? "Downloading" : "Download all"}
          size="sm"
          onPress={handleDownloadAll}
          disabled={downloading}
          leading={downloading ? <ActivityIndicator color={palette.inkInverse} size="small" /> : null}
        />
        <Button
          label={clearing ? "Clearing" : "Clear cache"}
          size="sm"
          variant="destructive"
          onPress={handleClearCache}
          disabled={clearing}
          leading={clearing ? <ActivityIndicator color={palette.inkInverse} size="small" /> : null}
        />
        </HStack>
          </ContentBlock>
        </PageSection>

        <PageSection eyebrow="Discogs" title="Sync">
          <ContentBlock>
        <Text variant="body" tone="muted">
          Mirror your Discogs collection and wantlist locally so search and
          auto-match are instant. Full sync rebuilds; quick sync only fetches
          recent additions.
        </Text>
        <Inline align="start">
          <Text variant="body" tone="muted">Local mirror</Text>
          {discogsCountsLoading && !discogsCounts ? (
            <Text variant="caption" tone="muted" italic>Checking...</Text>
          ) : discogsCounts ? (
            <Text variant="caption" tone="positive">
              {discogsCounts.collection} collection · {discogsCounts.wantlist} wantlist
            </Text>
          ) : (
            <Text variant="caption" tone="warning">Not synced yet</Text>
          )}
        </Inline>
        <HStack gap="md">
          <Button
            label="Full sync"
            size="sm"
            onPress={() => handleDiscogsSync({ incremental: false })}
            disabled={syncStarting || discogsStatus.state === "running"}
            leading={syncStarting && discogsStatus.state !== "running" ? <ActivityIndicator color={palette.inkInverse} size="small" /> : null}
          />
          <Button
            label="Quick sync"
            size="sm"
            variant="secondary"
            onPress={() => handleDiscogsSync({ incremental: true })}
            disabled={syncStarting || discogsStatus.state === "running"}
          />
        </HStack>
        {discogsStatusInfo && (
          <Text
            variant="caption"
            tone={statusTone(discogsStatusInfo.tone)}
            align="center"
          >
            {discogsStatusInfo.text}
          </Text>
        )}
        {syncError && (
          <Text variant="caption" tone="critical" align="center">{syncError}</Text>
        )}
          </ContentBlock>
        </PageSection>

        <PageSection eyebrow="App" title="Version">
          <ContentBlock>
        <Text variant="numeric" tone="muted">
          Update ID: {Updates.updateId ? Updates.updateId.slice(0, 8) : "embedded"}
        </Text>
        <Text variant="numeric" tone="muted">
          Created: {Updates.createdAt ? Updates.createdAt.toISOString().slice(0, 19).replace("T", " ") : "—"}
        </Text>
        <Text variant="numeric" tone="muted">
          Channel: {Updates.channel || "—"}
        </Text>
        <Button
          label={checking ? "Checking" : "Check for updates"}
          size="sm"
          onPress={checkForUpdate}
          disabled={checking}
          leading={checking ? <ActivityIndicator color={palette.inkInverse} size="small" /> : null}
        />
        {updateMessage && (
          <Text variant="caption" tone={updateError ? "critical" : "positive"} align="center">
            {updateMessage}
          </Text>
        )}
          </ContentBlock>
        </PageSection>

        <PageSection>
          <Button
            label="Sign Out"
            variant="destructive"
            onPress={() => signOut()}
            block
          />
        </PageSection>
      </VStack>
    </Screen>
  );
}
