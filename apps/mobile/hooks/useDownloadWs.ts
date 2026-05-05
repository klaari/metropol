import { useEffect, useRef } from "react";
import { useAuth } from "@clerk/clerk-expo";
import type { WsServerMessage } from "@aani/types";
import { backfillLocalCache } from "../lib/localAudio";
import { useDiscogsMatchStore } from "../store/discogsMatch";
import { useDiscogsSyncStore } from "../store/discogsSync";
import { useDownloadsStore } from "../store/downloads";
import { useLibraryStore } from "../store/library";

const WS_URL = process.env.EXPO_PUBLIC_WS_URL;
const RECONNECT_DELAY = 3000;

export function useDownloadWs() {
  const { getToken, userId } = useAuth();
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;
  const handleDownloadMessage = useDownloadsStore((s) => s.handleWsMessage);
  const handleDiscogsSyncMessage = useDiscogsSyncStore((s) => s.handleWsMessage);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!WS_URL) return;
    const base = WS_URL.replace(/\/+$/, "");
    const wsUrl = base.endsWith("/ws") ? base : `${base}/ws`;

    let unmounted = false;

    async function connect() {
      if (unmounted) return;

      const token = await getTokenRef.current();
      if (!token || unmounted) return;

      const ws = new WebSocket(`${wsUrl}?token=${token}`);
      wsRef.current = ws;

      ws.onmessage = (event) => {
        try {
          const msg: WsServerMessage = JSON.parse(event.data);
          if (msg.type === "job:status") {
            handleDownloadMessage(msg);
            if (msg.status === "completed" && msg.trackId && userId) {
              const trackId = msg.trackId;
              const trackTitle = msg.title ?? "Downloaded track";
              useLibraryStore.getState().fetchTracks(userId);
              backfillLocalCache(userId).catch((e) =>
                console.warn(
                  "[localAudio] post-completion backfill:",
                  e?.message ?? e,
                ),
              );
              (async () => {
                const token = await getTokenRef.current();
                if (!token) return;
                useDiscogsMatchStore
                  .getState()
                  .triggerAutoMatch({ trackId, trackTitle }, token)
                  .catch((e) =>
                    console.warn(
                      "[discogs] auto-match:",
                      e?.message ?? e,
                    ),
                  );
              })();
            }
          } else if (msg.type === "discogs:sync") {
            handleDiscogsSyncMessage(msg);
          }
        } catch {
          // Ignore malformed messages
        }
      };

      ws.onclose = () => {
        if (unmounted) return;
        reconnectTimer.current = setTimeout(connect, RECONNECT_DELAY);
      };

      ws.onerror = () => {
        ws.close();
      };
    }

    connect();

    return () => {
      unmounted = true;
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
    };
  }, [handleDownloadMessage, handleDiscogsSyncMessage, userId]);
}
