import { useEffect, useRef } from "react";
import { AppState } from "react-native";
import { useAuth } from "@clerk/clerk-expo";
import { useDiscogsSyncStore } from "../store/discogsSync";
import { useLibraryStore } from "../store/library";
import { useDownloadsStore } from "../store/downloads";

export function useAppResumeFetch() {
  const { userId, getToken } = useAuth();
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;
  const fetchTracks = useLibraryStore((s) => s.fetchTracks);
  const fetchJobs = useDownloadsStore((s) => s.fetchJobs);
  const maybeIncrementalSync = useDiscogsSyncStore((s) => s.maybeIncrementalSync);
  const appState = useRef(AppState.currentState);

  useEffect(() => {
    async function refresh() {
      if (!userId) return;
      fetchTracks(userId);
      const token = await getTokenRef.current();
      if (!token) return;
      fetchJobs(token);
      maybeIncrementalSync(token).catch((e) =>
        console.warn("[discogs] auto-sync:", e?.message ?? e),
      );
    }

    // Initial cold-start refresh once we have a userId.
    refresh();

    const sub = AppState.addEventListener("change", (nextState) => {
      if (
        appState.current.match(/inactive|background/) &&
        nextState === "active"
      ) {
        refresh();
      }
      appState.current = nextState;
    });

    return () => sub.remove();
  }, [userId, fetchTracks, fetchJobs, maybeIncrementalSync]);
}
