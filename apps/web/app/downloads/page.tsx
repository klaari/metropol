"use client";

import DownloadList from "@/components/DownloadList";
import { useAuth } from "@clerk/nextjs";
import { useEffect, useRef, useState } from "react";
import type { DownloadJob } from "@aani/types";
import {
  HStack,
  IconButton,
  Surface,
  Text,
  VStack,
} from "@/components/ui";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";
const YOUTUBE_URL_REGEX =
  /^https?:\/\/(www\.)?(youtube\.com|youtu\.be|music\.youtube\.com)\//;

export default function DownloadsPage() {
  const { getToken } = useAuth();
  const [jobs, setJobs] = useState<DownloadJob[]>([]);
  const [url, setUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const tryPrefill = async () => {
      try {
        const text = await navigator.clipboard.readText();
        if (YOUTUBE_URL_REGEX.test(text)) setUrl(text);
      } catch {
        /* clipboard read not permitted */
      }
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

  const jobCount = jobs.length;
  const jobCountLabel = jobCount === 1 ? "1 job" : `${jobCount} jobs`;

  return (
    <VStack gap="lg" pad="lg" className="max-w-3xl w-full mx-auto">
      <VStack gap="xs">
        <Text variant="eyebrow" tone="muted">
          Queue
        </Text>
        <Text variant="titleLg">
          {jobCount > 0 ? jobCountLabel : "Downloads"}
        </Text>
      </VStack>

      <Surface tone="raised" rounded="xl" pad="sm" bordered>
        <form onSubmit={handleSubmit}>
          <HStack gap="sm">
            <input
              ref={inputRef}
              type="url"
              value={url}
              onChange={(e) => {
                setUrl(e.target.value);
                setError(null);
              }}
              placeholder="Paste YouTube URL..."
              className="flex-1 bg-transparent text-ink placeholder:text-ink-faint focus:outline-none text-body py-xs px-sm"
              disabled={submitting}
            />
            <IconButton
              type="submit"
              variant="filled"
              aria-label="Submit URL"
              disabled={submitting || !url.trim()}
            >
              <span className="text-body-lg leading-none">
                {submitting ? "…" : "↑"}
              </span>
            </IconButton>
          </HStack>
        </form>
      </Surface>
      {error ? (
        <Text variant="caption" tone="critical">
          {error}
        </Text>
      ) : null}

      <DownloadList jobs={jobs} setJobs={setJobs} />
    </VStack>
  );
}
