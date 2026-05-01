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

const API_URL = process.env.EXPO_PUBLIC_API_URL;

export default function SettingsScreen() {
  const { getToken, signOut } = useAuth();
  const [cookieStatus, setCookieStatus] = useState<boolean | null>(null);
  const [uploading, setUploading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  const [checking, setChecking] = useState(false);
  const [updateMessage, setUpdateMessage] = useState<string | null>(null);
  const [updateError, setUpdateError] = useState(false);

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
        <Pressable style={styles.checkButton} onPress={checkForUpdate}>
          {checking ? (
            <ActivityIndicator color="#000" size="small" />
          ) : (
            <Text style={styles.checkButtonText}>Check for updates</Text>
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
