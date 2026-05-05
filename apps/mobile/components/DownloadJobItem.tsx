import type { DownloadJob, DownloadJobStatus } from "@aani/types";
import { Ionicons } from "@expo/vector-icons";
import type { ComponentProps } from "react";
import {
  HStack,
  IconButton,
  ListRow,
  Text,
  palette,
} from "./ui";

type IconName = ComponentProps<typeof Ionicons>["name"];

const STATUS_ICONS: Record<DownloadJobStatus, { name: IconName; color: string }> = {
  queued: { name: "time-outline", color: palette.inkMuted },
  downloading: { name: "arrow-down-circle-outline", color: palette.cobalt },
  uploading: { name: "cloud-upload-outline", color: palette.warning },
  completed: { name: "checkmark", color: palette.inkMuted },
  failed: { name: "close-circle", color: palette.critical },
};

interface Props {
  job: DownloadJob;
  onRetry?: () => void;
  onDismiss?: () => void;
}

export function DownloadJobItem({ job, onRetry, onDismiss }: Props) {
  const status = STATUS_ICONS[job.status] ?? STATUS_ICONS.queued;
  const isFailed = job.status === "failed";
  const isActive =
    job.status === "downloading" ||
    job.status === "uploading" ||
    job.status === "queued";

  return (
    <ListRow
      title={job.title || job.url}
      subtitle={job.error || job.artist || undefined}
      leading={
        isActive ? (
          <Ionicons name={status.name} size={18} color={status.color} />
        ) : undefined
      }
      trailing={
        isFailed ? (
          <HStack gap="xs">
            {onRetry ? (
              <IconButton
                icon="refresh"
                accessibilityLabel="Retry download"
                onPress={onRetry}
                color={palette.cobalt}
                size={18}
              />
            ) : null}
            {onDismiss ? (
              <IconButton
                icon="close"
                accessibilityLabel="Dismiss failed download"
                onPress={onDismiss}
                color={palette.inkMuted}
                size={18}
              />
            ) : null}
          </HStack>
        ) : undefined
      }
    />
  );
}
