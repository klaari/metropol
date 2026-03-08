import type { ServerWebSocket } from "bun";
import type { WsJobStatusMessage } from "@metropol/types";

export interface WsData {
  token: string;
  userId?: string;
}

const connections = new Map<string, Set<ServerWebSocket<WsData>>>();

export function addConnection(userId: string, ws: ServerWebSocket<WsData>) {
  let set = connections.get(userId);
  if (!set) {
    set = new Set();
    connections.set(userId, set);
  }
  set.add(ws);
}

export function removeConnection(userId: string, ws: ServerWebSocket<WsData>) {
  const set = connections.get(userId);
  if (!set) return;
  set.delete(ws);
  if (set.size === 0) connections.delete(userId);
}

export function broadcast(userId: string, message: WsJobStatusMessage) {
  const set = connections.get(userId);
  if (!set) return;
  const data = JSON.stringify(message);
  for (const ws of set) {
    ws.send(data);
  }
}
