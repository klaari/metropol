"use client";

import { useEffect, useRef, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import type { DownloadJob, DownloadJobStatus, WsJobStatusMessage } from "@metropol/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";
const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:3000";

const STATUS_STYLES: Record<DownloadJobStatus, string> = {
  queued: "bg-zinc-700 text-zinc-300",
  downloading: "bg-blue-900 text-blue-300",
  uploading: "bg-orange-900 text-orange-300",
  completed: "bg-green-900 text-green-300",
  failed: "bg-red-900 text-red-300",
};

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

function FailedActions({
  job,
  onRetry,
}: {
  job: DownloadJob;
  onRetry: (job: DownloadJob) => Promise<void>;
}) {
  const [retrying, setRetrying] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleRetry = async () => {
    setRetrying(true);
    try {
      await onRetry(job);
    } finally {
      setRetrying(false);
    }
  };

  const handleCopyError = async () => {
    if (!job.error) return;
    try {
      await navigator.clipboard.writeText(job.error);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback: select text
    }
  };

  return (
    <div className="flex gap-2 mt-1">
      <button
        onClick={handleRetry}
        disabled={retrying}
        className="text-xs bg-zinc-700 hover:bg-zinc-600 text-white px-2.5 py-1 rounded-full disabled:opacity-50 transition-colors"
      >
        {retrying ? "Retrying…" : "↺ Retry"}
      </button>
      {job.error && (
        <button
          onClick={handleCopyError}
          className="text-xs bg-zinc-700 hover:bg-zinc-600 text-zinc-300 px-2.5 py-1 rounded-full transition-colors"
        >
          {copied ? "✓ Copied" : "⎘ Copy error"}
        </button>
      )}
    </div>
  );
}

export default function DownloadList({ jobs, setJobs }: Props) {
  const { getToken } = useAuth();
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  // Initial load
  useEffect(() => {
    const loadJobs = async () => {
      try {
        const token = await getToken();
        const res = await fetch(`${API_URL}/downloads`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = (await res.json()) as DownloadJob[];
          data.sort(
            (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );
          setJobs(data);
        }
      } catch {
        // silently fail
      }
    };
    loadJobs();
  }, [getToken, setJobs]);

  // WebSocket
  useEffect(() => {
    mountedRef.current = true;

    const connect = async () => {
      if (!mountedRef.current) return;
      const token = await getToken();
      if (!token || !mountedRef.current) return;

      const ws = new WebSocket(`${WS_URL}?token=${encodeURIComponent(token)}`);
      wsRef.current = ws;

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data as string) as WsJobStatusMessage;
          if (msg.type !== "job:status") return;

          setJobs((prev) => {
            const idx = prev.findIndex((j) => j.id === msg.jobId);
            if (idx === -1) return prev;
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
          // ignore parse errors
        }
      };

      ws.onclose = () => {
        if (!mountedRef.current) return;
        reconnectTimer.current = setTimeout(connect, 3000);
      };

      ws.onerror = () => {
        ws.close();
      };
    };

    connect();

    return () => {
      mountedRef.current = false;
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
    };
  }, [getToken, setJobs]);

  const handleRetry = async (job: DownloadJob) => {
    try {
      const token = await getToken();
      const res = await fetch(`${API_URL}/downloads`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ url: job.url }),
      });

      if (!res.ok) return;

      const newJob = (await res.json()) as DownloadJob;
      // Add new job at top; keep old failed one so user can see history
      setJobs((prev) => [newJob, ...prev]);
    } catch {
      // silently fail — user can try again
    }
  };

  if (jobs.length === 0) {
    return (
      <p className="text-zinc-500 text-sm">No downloads yet. Paste a YouTube URL above.</p>
    );
  }

  return (
    <ul className="space-y-2">
      {jobs.map((job) => (
        <li
          key={job.id}
          className="flex items-start justify-between bg-zinc-900 rounded-lg px-4 py-3 gap-4"
        >
          <div className="min-w-0">
            <p className="text-sm font-medium text-white truncate">
              {job.title ?? job.url}
            </p>
            {job.artist && (
              <p className="text-xs text-zinc-400 mt-0.5">{job.artist}</p>
            )}
            {job.error && (
              <p className="text-xs text-red-400 mt-0.5 line-clamp-2">{job.error}</p>
            )}
            {job.status === "failed" && (
              <FailedActions job={job} onRetry={handleRetry} />
            )}
          </div>
          <div className="flex items-center gap-3 shrink-0 pt-0.5">
            {job.duration !== null && (
              <span className="text-xs text-zinc-500">
                {formatDuration(job.duration)}
              </span>
            )}
            <span
              className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_STYLES[job.status]}`}
            >
              {job.status}
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
}
