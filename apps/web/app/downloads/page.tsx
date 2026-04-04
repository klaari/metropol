"use client";

import DownloadList from "@/components/DownloadList";
import { useAuth } from "@clerk/nextjs";
import { useRef, useState, useEffect } from "react";
import type { DownloadJob } from "@metropol/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";
const YOUTUBE_URL_REGEX = /^https?:\/\/(www\.)?(youtube\.com|youtu\.be|music\.youtube\.com)\//;

export default function DownloadsPage() {
  const { getToken } = useAuth();
  const [jobs, setJobs] = useState<DownloadJob[]>([]);
  const [url, setUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Try to prefill from clipboard
  useEffect(() => {
    const tryPrefill = async () => {
      try {
        const text = await navigator.clipboard.readText();
        if (YOUTUBE_URL_REGEX.test(text)) setUrl(text);
      } catch { /* clipboard read not permitted */ }
    };
    tryPrefill();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = url.trim();
    if (!trimmed) return;
    setError(null);

    if (!YOUTUBE_URL_REGEX.test(trimmed)) {
      setError("Please enter a valid YouTube URL");
      return;
    }

    setSubmitting(true);
    try {
      const token = await getToken();
      const res = await fetch(`${API_URL}/downloads`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ url: trimmed }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError((body as { error?: string }).error ?? `Error ${res.status}`);
        return;
      }
      setJobs((prev) => [body as DownloadJob, ...prev]);
      setUrl("");
    } catch {
      setError("Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Scrollable job list */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <h1 className="text-3xl font-bold text-white mb-6">Downloads</h1>
        <DownloadList jobs={jobs} setJobs={setJobs} />
      </div>

      {/* Input bar — sticks to bottom inside the flex column */}
      <div className="shrink-0 border-t border-zinc-900 bg-black px-3 py-2.5">
        <form onSubmit={handleSubmit} className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="url"
            value={url}
            onChange={(e) => { setUrl(e.target.value); setError(null); }}
            placeholder="Paste YouTube URL..."
            className="flex-1 bg-zinc-900 border border-zinc-800 rounded-full px-4 py-2.5 text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-600 text-sm"
            disabled={submitting}
          />
          <button
            type="submit"
            disabled={submitting || !url.trim()}
            className="w-10 h-10 rounded-full bg-white flex items-center justify-center disabled:opacity-20 hover:bg-zinc-100 transition-colors shrink-0"
          >
            <span className="text-black text-base leading-none">{submitting ? "…" : "↑"}</span>
          </button>
        </form>
        {error && <p className="text-red-400 text-xs mt-1.5 px-1">{error}</p>}
      </div>
    </div>
  );
}
