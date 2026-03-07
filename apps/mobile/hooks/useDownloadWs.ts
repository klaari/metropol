import { useEffect, useRef } from "react";
import { useAuth } from "@clerk/clerk-expo";
import type { WsJobStatusMessage } from "@markku/types";
import { useDownloadsStore } from "../store/downloads";

const WS_URL = process.env.EXPO_PUBLIC_WS_URL;
const RECONNECT_DELAY = 3000;

export function useDownloadWs() {
  const { getToken } = useAuth();
  const handleWsMessage = useDownloadsStore((s) => s.handleWsMessage);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!WS_URL) return;

    let unmounted = false;

    async function connect() {
      if (unmounted) return;

      const token = await getToken();
      if (!token || unmounted) return;

      const ws = new WebSocket(`${WS_URL}?token=${token}`);
      wsRef.current = ws;

      ws.onmessage = (event) => {
        try {
          const msg: WsJobStatusMessage = JSON.parse(event.data);
          if (msg.type === "job:status") {
            handleWsMessage(msg);
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
  }, [getToken, handleWsMessage]);
}
