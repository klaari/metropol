import { useEffect, useRef } from "react";
import { AppState } from "react-native";
import { useAuth } from "@clerk/clerk-expo";
import { useLibraryStore } from "../store/library";
import { useDownloadsStore } from "../store/downloads";

export function useAppResumeFetch() {
  const { userId, getToken } = useAuth();
  const fetchTracks = useLibraryStore((s) => s.fetchTracks);
  const fetchJobs = useDownloadsStore((s) => s.fetchJobs);
  const appState = useRef(AppState.currentState);

  useEffect(() => {
    const sub = AppState.addEventListener("change", async (nextState) => {
      if (
        appState.current.match(/inactive|background/) &&
        nextState === "active" &&
        userId
      ) {
        fetchTracks(userId);
        const token = await getToken();
        if (token) fetchJobs(token);
      }
      appState.current = nextState;
    });

    return () => sub.remove();
  }, [userId, getToken, fetchTracks, fetchJobs]);
}
