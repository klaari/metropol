"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import type { DownloadJob, DownloadJobStatus, WsJobStatusMessage } from "@metropol/types";


const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";
const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:3000";

const STATUS_ICON: Record<DownloadJobStatus, { symbol: string; color: string }> = {
  queued:      { symbol: "◷", color: "text-zinc-600" },
  downloading: { symbol: "↓", color: "text-blue-400" },
  uploading:   { symbol: "↑", color: "text-orange-400" },
  completed:   { symbol: "✓", color: "text-zinc-600" },
  failed:      { symbol: "✕", color: "text-red-500" },
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
      data.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setJobs(data);
    } catch {
      // silently fail
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

      const ws = new WebSocket(`${WS_URL}?token=${encodeURIComponent(token)}`);
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
            updated[idx] = { ...updated[idx], status: msg.status, title: msg.title, artist: msg.artist, duration: msg.duration, trackId: msg.trackId, error: msg.error };
            return updated;
          });
        } catch { /* ignore */ }
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

  const hasActiveJobs = jobs.some((j) => j.status === "queued" || j.status === "downloading" || j.status === "uploading");
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
    } catch { /* silently fail */ }
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
    } catch { /* silently fail */ }
  };

  const expiredJobs = jobs.filter((j) => j.error?.includes("YouTube session expired"));
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
    } catch { /* silently fail */ }
    setRetrying(false);
  };

  if (jobs.length === 0) return null;

  return (
    <div className="space-y-3">
      {expiredJobs.length > 0 && (
        <div className="flex items-center gap-2.5 bg-[#1a1200] border border-[#3d2800] rounded-xl px-4 py-3">
          <span className="text-[#f5a623] text-sm">⚠</span>
          <p className="text-[#f5a623] text-sm flex-1">
            {expiredJobs.length} download{expiredJobs.length > 1 ? "s" : ""} failed — cookies were expired
          </p>
          <button
            onClick={handleRetryExpired}
            disabled={retrying}
            className="text-[#f5a623] text-sm font-medium hover:text-[#ffbf47] transition-colors disabled:opacity-50 shrink-0"
          >
            {retrying ? "Retrying…" : "Retry all"}
          </button>
        </div>
      )}

      <div>
        <p className="text-zinc-600 text-xs font-semibold uppercase tracking-widest mb-1 px-1">Recent</p>
        <ul>
          {jobs.map((job) => {
            const icon = STATUS_ICON[job.status];
            const isActive = job.status === "downloading" || job.status === "uploading" || job.status === "queued";
            const isFailed = job.status === "failed";

            return (
              <li key={job.id} className="flex items-center gap-3 px-1 py-2">
                {isActive && (
                  <span className={`text-base w-5 text-center shrink-0 ${icon.color}`}>
                    {icon.symbol}
                  </span>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-zinc-300 text-sm truncate">{job.title ?? job.url}</p>
                  {job.artist && (
                    <p className="text-zinc-600 text-xs mt-0.5 truncate">{job.artist}</p>
                  )}
                  {job.error && (
                    <p className="text-red-400 text-xs mt-0.5 line-clamp-2">{job.error}</p>
                  )}
                </div>
                {job.duration && (
                  <span className="text-zinc-600 text-xs tabular-nums shrink-0">
                    {formatDuration(job.duration)}
                  </span>
                )}
                {isFailed && (
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => handleRetry(job)}
                      className="p-1.5 text-blue-400 hover:text-blue-300 transition-colors"
                      title="Retry"
                    >
                      ↺
                    </button>
                    <button
                      onClick={() => handleDismiss(job)}
                      className="p-1.5 text-zinc-600 hover:text-zinc-400 transition-colors"
                      title="Dismiss"
                    >
                      ✕
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
