import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { DownloadJob, DownloadJobStatus } from "@metropol/types";

const STATUS_ICONS: Record<DownloadJobStatus, { name: string; color: string }> = {
  queued: { name: "time-outline", color: "#666" },
  downloading: { name: "arrow-down-circle-outline", color: "#4a9eff" },
  uploading: { name: "cloud-upload-outline", color: "#f5a623" },
  completed: { name: "checkmark", color: "#555" },
  failed: { name: "close-circle", color: "#ff3b30" },
};

interface Props {
  job: DownloadJob;
  onRetry?: () => void;
  onDismiss?: () => void;
}

export function DownloadJobItem({ job, onRetry, onDismiss }: Props) {
  const icon = STATUS_ICONS[job.status] ?? STATUS_ICONS.queued;
  const isFailed = job.status === "failed";

  const isActive = job.status === "downloading" || job.status === "uploading" || job.status === "queued";

  return (
    <View style={styles.container}>
      {isActive && (
        <Ionicons
          name={icon.name as any}
          size={16}
          color={icon.color}
          style={styles.icon}
        />
      )}
      <View style={styles.info}>
        <Text style={styles.title} numberOfLines={1}>
          {job.title || job.url}
        </Text>
        {job.artist ? (
          <Text style={styles.artist} numberOfLines={1}>
            {job.artist}
          </Text>
        ) : null}
        {job.error ? (
          <Text style={styles.error} numberOfLines={2}>
            {job.error}
          </Text>
        ) : null}
      </View>
      {isFailed && onRetry && (
        <Pressable style={styles.actionBtn} onPress={onRetry} hitSlop={8}>
          <Ionicons name="refresh" size={16} color="#4a9eff" />
        </Pressable>
      )}
      {isFailed && onDismiss && (
        <Pressable style={styles.actionBtn} onPress={onDismiss} hitSlop={8}>
          <Ionicons name="close" size={16} color="#666" />
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  icon: {
    marginRight: 10,
    width: 18,
  },
  info: {
    flex: 1,
    marginRight: 8,
  },
  title: {
    color: "#ccc",
    fontSize: 14,
  },
  artist: {
    color: "#666",
    fontSize: 12,
    marginTop: 1,
  },
  error: {
    color: "#ff6b6b",
    fontSize: 11,
    marginTop: 2,
  },
  actionBtn: {
    padding: 6,
  },
});
