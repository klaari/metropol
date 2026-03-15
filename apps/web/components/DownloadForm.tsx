"use client";

import { useState, useEffect, useRef } from "react";
import { useAuth } from "@clerk/nextjs";
import type { DownloadJob } from "@metropol/types";

const YOUTUBE_URL_REGEX =
  /^https?:\/\/(www\.)?(youtube\.com|youtu\.be|music\.youtube\.com)\//;

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";

interface Props {
  onJobCreated: (job: DownloadJob) => void;
}

export default function DownloadForm({ onJobCreated }: Props) {
  const { getToken } = useAuth();
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const tryPrefillFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (YOUTUBE_URL_REGEX.test(text)) {
        setUrl((prev) => (prev ? prev : text));
      }
    } catch {
      // clipboard read not permitted — silently skip
    }
  };

  useEffect(() => {
    tryPrefillFromClipboard();
  }, []);

  const handleFocus = () => {
    if (!url) {
      tryPrefillFromClipboard();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!YOUTUBE_URL_REGEX.test(url)) {
      setError("Please enter a valid YouTube URL.");
      return;
    }

    setLoading(true);
    try {
      const token = await getToken();
      const res = await fetch(`${API_URL}/downloads`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ url }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error ?? `Server error ${res.status}`);
      }

      const job = (await res.json()) as DownloadJob;
      onJobCreated(job);
      setUrl("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="flex gap-2">
        <input
          ref={inputRef}
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onFocus={handleFocus}
          placeholder="Paste a YouTube URL..."
          className="flex-1 bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-2.5 text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-500 text-sm"
          disabled={loading}
        />
        <button
          type="submit"
          disabled={loading || !url}
          className="bg-white text-black font-medium text-sm px-5 py-2.5 rounded-lg disabled:opacity-40 hover:bg-zinc-100 transition-colors"
        >
          {loading ? "Adding…" : "Add"}
        </button>
      </div>
      {error && <p className="text-red-400 text-sm">{error}</p>}
    </form>
  );
}
