import React from "react";
import { View, Text, StyleSheet } from "react-native";
import type { DownloadJob, DownloadJobStatus } from "@markku/types";

const STATUS_LABELS: Record<DownloadJobStatus, string> = {
  queued: "Queued",
  downloading: "Downloading...",
  uploading: "Uploading...",
  completed: "Done",
  failed: "Failed",
};

const STATUS_COLORS: Record<DownloadJobStatus, string> = {
  queued: "#888",
  downloading: "#4a9eff",
  uploading: "#f5a623",
  completed: "#4cd964",
  failed: "#ff3b30",
};

export function DownloadJobItem({ job }: { job: DownloadJob }) {
  const statusColor = STATUS_COLORS[job.status] ?? "#888";

  return (
    <View style={styles.container}>
      <View style={styles.info}>
        <Text style={styles.title} numberOfLines={1}>
          {job.title || job.url}
        </Text>
        {job.artist && (
          <Text style={styles.artist} numberOfLines={1}>
            {job.artist}
          </Text>
        )}
        {job.error && (
          <Text style={styles.error} numberOfLines={2}>
            {job.error}
          </Text>
        )}
      </View>
      <View style={[styles.badge, { backgroundColor: statusColor }]}>
        <Text style={styles.badgeText}>{STATUS_LABELS[job.status]}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#333",
  },
  info: {
    flex: 1,
    marginRight: 12,
  },
  title: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "500",
  },
  artist: {
    color: "#aaa",
    fontSize: 13,
    marginTop: 2,
  },
  error: {
    color: "#ff6b6b",
    fontSize: 12,
    marginTop: 4,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },
});
