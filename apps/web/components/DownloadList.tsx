"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import type { DownloadJob, DownloadJobStatus, WsJobStatusMessage } from "@aani/types";
import { HStack, Surface, Text, VStack } from "./ui";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";
const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:3000";

const STATUS_ICON: Record<
  DownloadJobStatus,
  { symbol: string; tone: "muted" | "accent" | "warning" | "critical" }
> = {
  queued: { symbol: "◷", tone: "muted" },
  downloading: { symbol: "↓", tone: "accent" },
  uploading: { symbol: "↑", tone: "warning" },
  completed: { symbol: "✓", tone: "muted" },
  failed: { symbol: "✕", tone: "critical" },
};

const toneClass = {
  muted: "text-ink-muted",
  accent: "text-cobalt",
  warning: "text-warning",
  critical: "text-critical",
} as const;

interface Props {
  jobs: DownloadJob[];
  setJobs: React.Dispatch<React.SetStateAction<DownloadJob[]>>;
}

function formatDuration(seconds: number | null): string {
  if (seconds === null) return "";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function DownloadList({ jobs, setJobs }: Props) {
  const { getToken } = useAuth();
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);
  const pendingUpdates = useRef<Map<string, Partial<DownloadJob>>>(new Map());

  const fetchJobs = useCallback(async () => {
    try {
      const token = await getToken();
      const res = await fetch(`${API_URL}/downloads`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const data = (await res.json()) as DownloadJob[];
      data.sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
      setJobs(data);
    } catch {
      /* silently fail */
    }
  }, [getToken, setJobs]);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  useEffect(() => {
    mountedRef.current = true;

    const connect = async () => {
      if (!mountedRef.current) return;
      const token = await getToken();
      if (!token || !mountedRef.current) return;

      const base = WS_URL.replace(/\/+$/, "");
      const url = base.endsWith("/ws") ? base : `${base}/ws`;
      const ws = new WebSocket(`${url}?token=${encodeURIComponent(token)}`);
      wsRef.current = ws;

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data as string) as WsJobStatusMessage;
          if (msg.type !== "job:status") return;

          setJobs((prev) => {
            const idx = prev.findIndex((j) => j.id === msg.jobId);
            if (idx === -1) {
              pendingUpdates.current.set(msg.jobId, {
                status: msg.status,
                title: msg.title ?? undefined,
                artist: msg.artist ?? undefined,
                duration: msg.duration ?? undefined,
                trackId: msg.trackId ?? undefined,
                error: msg.error ?? undefined,
              });
              return prev;
            }
            const updated = [...prev];
            updated[idx] = {
              ...updated[idx],
              status: msg.status,
              title: msg.title,
              artist: msg.artist,
              duration: msg.duration,
              trackId: msg.trackId,
              error: msg.error,
            };
            return updated;
          });
        } catch {
          /* ignore */
        }
      };

      ws.onclose = () => {
        if (!mountedRef.current) return;
        reconnectTimer.current = setTimeout(connect, 3000);
      };

      ws.onerror = () => ws.close();
    };

    connect();

    return () => {
      mountedRef.current = false;
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
    };
  }, [getToken, setJobs]);

  useEffect(() => {
    if (pendingUpdates.current.size === 0) return;
    const snapshot = new Map(pendingUpdates.current);
    pendingUpdates.current.clear();
    setJobs((prev) => {
      let changed = false;
      const updated = prev.map((j) => {
        const pending = snapshot.get(j.id);
        if (!pending) return j;
        changed = true;
        return { ...j, ...pending };
      });
      return changed ? updated : prev;
    });
  }, [jobs, setJobs]);

  const hasActiveJobs = jobs.some(
    (j) =>
      j.status === "queued" ||
      j.status === "downloading" ||
      j.status === "uploading",
  );
  useEffect(() => {
    if (!hasActiveJobs) return;
    const id = setInterval(fetchJobs, 3000);
    return () => clearInterval(id);
  }, [hasActiveJobs, fetchJobs]);

  const handleRetry = async (job: DownloadJob) => {
    try {
      const token = await getToken();
      const res = await fetch(`${API_URL}/downloads`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ url: job.url }),
      });
      if (!res.ok) return;
      await fetchJobs();
    } catch {
      /* silently fail */
    }
  };

  const handleDismiss = async (job: DownloadJob) => {
    try {
      const token = await getToken();
      const res = await fetch(`${API_URL}/downloads/${job.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      setJobs((prev) => prev.filter((j) => j.id !== job.id));
    } catch {
      /* silently fail */
    }
  };

  const expiredJobs = jobs.filter((j) =>
    j.error?.includes("YouTube session expired"),
  );
  const [retrying, setRetrying] = useState(false);

  const handleRetryExpired = async () => {
    setRetrying(true);
    try {
      const token = await getToken();
      for (const job of expiredJobs) {
        await fetch(`${API_URL}/downloads`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ url: job.url }),
        });
      }
      await fetchJobs();
    } catch {
      /* silently fail */
    }
    setRetrying(false);
  };

  if (jobs.length === 0) return null;

  return (
    <VStack gap="md">
      {expiredJobs.length > 0 ? (
        <Surface tone="raised" rounded="lg" pad="md" bordered>
          <HStack gap="sm" align="center">
            <span className="text-warning">⚠</span>
            <div className="flex-1">
              <Text variant="caption" tone="warning">
                {expiredJobs.length} download
                {expiredJobs.length > 1 ? "s" : ""} failed — cookies were expired
              </Text>
            </div>
            <button
              onClick={handleRetryExpired}
              disabled={retrying}
              className="text-warning text-caption font-semibold hover:opacity-80 disabled:opacity-50 transition-opacity shrink-0"
            >
              {retrying ? "Retrying…" : "Retry all"}
            </button>
          </HStack>
        </Surface>
      ) : null}

      <VStack gap="xs">
        <Text variant="eyebrow" tone="muted">
          Recent
        </Text>
        <ul>
          {jobs.map((job) => {
            const icon = STATUS_ICON[job.status];
            const isActive =
              job.status === "downloading" ||
              job.status === "uploading" ||
              job.status === "queued";
            const isFailed = job.status === "failed";

            return (
              <li
                key={job.id}
                className="flex items-center gap-md py-sm border-b border-paper-edge last:border-b-0"
              >
                {isActive ? (
                  <span
                    className={`${toneClass[icon.tone]} text-body-lg w-5 text-center shrink-0`}
                  >
                    {icon.symbol}
                  </span>
                ) : null}
                <div className="flex-1 min-w-0">
                  <Text variant="body" numberOfLines={1}>
                    {job.title ?? job.url}
                  </Text>
                  {job.artist ? (
                    <Text variant="caption" tone="muted" numberOfLines={1}>
                      {job.artist}
                    </Text>
                  ) : null}
                  {job.error ? (
                    <Text variant="caption" tone="critical" numberOfLines={2}>
                      {job.error}
                    </Text>
                  ) : null}
                </div>
                {job.duration ? (
                  <Text variant="caption" tone="muted" numeric>
                    {formatDuration(job.duration)}
                  </Text>
                ) : null}
                {isFailed ? (
                  <HStack gap="xs">
                    <button
                      onClick={() => handleRetry(job)}
                      aria-label="Retry"
                      title="Retry"
                      className="p-xs text-cobalt hover:opacity-80 transition-opacity"
                    >
                      ↺
                    </button>
                    <button
                      onClick={() => handleDismiss(job)}
                      aria-label="Dismiss"
                      title="Dismiss"
                      className="p-xs text-ink-faint hover:text-ink transition-colors"
                    >
                      ✕
                    </button>
                  </HStack>
                ) : null}
              </li>
            );
          })}
        </ul>
      </VStack>
    </VStack>
  );
}
