import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useAuth } from "@clerk/clerk-expo";
import type { DownloadJob } from "@markku/types";
import { useDownloadsStore } from "../../store/downloads";
import { DownloadJobItem } from "../../components/DownloadJobItem";

export default function DownloadsScreen() {
  const { getToken } = useAuth();
  const { jobs, isLoading, fetchJobs, submitDownload } = useDownloadsStore();
  const [url, setUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    (async () => {
      const token = await getToken();
      if (token) fetchJobs(token);
    })();
  }, [getToken, fetchJobs]);

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

  const renderItem = ({ item }: { item: DownloadJob }) => (
    <DownloadJobItem job={item} />
  );

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          placeholder="Paste YouTube URL..."
          placeholderTextColor="#666"
          value={url}
          onChangeText={setUrl}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          returnKeyType="go"
          onSubmitEditing={handleSubmit}
        />
        <TouchableOpacity
          style={[styles.button, submitting && styles.buttonDisabled]}
          onPress={handleSubmit}
          disabled={submitting || !url.trim()}
        >
          <Text style={styles.buttonText}>
            {submitting ? "..." : "Download"}
          </Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={jobs}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={jobs.length === 0 ? styles.empty : undefined}
        ListEmptyComponent={
          <Text style={styles.emptyText}>
            {isLoading ? "Loading..." : "No downloads yet"}
          </Text>
        }
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  inputRow: {
    flexDirection: "row",
    padding: 12,
    gap: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#333",
  },
  input: {
    flex: 1,
    backgroundColor: "#1a1a1a",
    color: "#fff",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  button: {
    backgroundColor: "#4a9eff",
    borderRadius: 8,
    paddingHorizontal: 16,
    justifyContent: "center",
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 15,
  },
  empty: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyText: {
    color: "#666",
    fontSize: 16,
  },
});
