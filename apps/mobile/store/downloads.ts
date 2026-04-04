import type { DownloadJob, WsJobStatusMessage } from "@metropol/types";
import { create } from "zustand";
import { apiFetch } from "../lib/api";

interface DownloadsState {
  jobs: DownloadJob[];
  isLoading: boolean;
  error: string | null;

  fetchJobs: (token: string) => Promise<void>;
  submitDownload: (url: string, token: string) => Promise<{ error: string | null }>;
  dismissJob: (jobId: string, token: string) => Promise<{ error: string | null }>;
  retryJob: (job: DownloadJob, token: string) => Promise<{ error: string | null }>;
  handleWsMessage: (msg: WsJobStatusMessage) => void;
}

export const useDownloadsStore = create<DownloadsState>((set, get) => ({
  jobs: [],
  isLoading: false,
  error: null,

  fetchJobs: async (token) => {
    set({ isLoading: true, error: null });
    const { data, error } = await apiFetch<DownloadJob[]>("/downloads", token);
    if (error) {
      set({ error, isLoading: false });
    } else {
      set({ jobs: data ?? [], isLoading: false });
    }
  },

  submitDownload: async (url, token) => {
    const { data, error } = await apiFetch<DownloadJob>("/downloads", token, {
      method: "POST",
      body: JSON.stringify({ url }),
    });

    if (error) {
      return { error };
    }

    if (data) {
      set({ jobs: [data, ...get().jobs] });
    }
    return { error: null };
  },

  dismissJob: async (jobId, token) => {
    const { data, error } = await apiFetch<{ ok: boolean }>(
      `/downloads/${jobId}`,
      token,
      { method: "DELETE" },
    );
    if (error) return { error };
    set({ jobs: get().jobs.filter((j) => j.id !== jobId) });
    return { error: null };
  },

  retryJob: async (job, token) => {
    // Dismiss the failed job first, then resubmit
    await get().dismissJob(job.id, token);
    return get().submitDownload(job.url, token);
  },

  handleWsMessage: (msg) => {
    set((state) => {
      const idx = state.jobs.findIndex((j) => j.id === msg.jobId);
      if (idx === -1) {
        // New job we don't know about — prepend it
        const newJob: DownloadJob = {
          id: msg.jobId,
          userId: "",
          url: "",
          status: msg.status,
          title: msg.title,
          artist: msg.artist,
          duration: msg.duration,
          trackId: msg.trackId,
          error: msg.error,
          createdAt: new Date(),
          completedAt: msg.status === "completed" || msg.status === "failed" ? new Date() : null,
        };
        return { jobs: [newJob, ...state.jobs] };
      }

      const updated = [...state.jobs];
      updated[idx] = {
        ...updated[idx],
        status: msg.status,
        title: msg.title ?? updated[idx].title,
        artist: msg.artist ?? updated[idx].artist,
        duration: msg.duration ?? updated[idx].duration,
        trackId: msg.trackId ?? updated[idx].trackId,
        error: msg.error,
        completedAt:
          msg.status === "completed" || msg.status === "failed"
            ? new Date()
            : updated[idx].completedAt,
      };
      return { jobs: updated };
    });
  },
}));
