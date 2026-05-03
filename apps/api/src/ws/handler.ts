import type { ServerWebSocket } from "bun";
import { verifyToken } from "@clerk/backend";
import { eq, and, notInArray } from "drizzle-orm";
import { createDb, downloadJobs } from "@aani/db";
import type { WsJobStatusMessage } from "@aani/types";
import { env } from "../lib/env";
import { addConnection, removeConnection, type WsData } from "./connections";

const db = createDb(env.databaseUrl);

export async function handleWsOpen(ws: ServerWebSocket<WsData>) {
  const { token } = ws.data;

  try {
    const payload = await verifyToken(token, {
      secretKey: env.clerkSecretKey,
    });
    ws.data.userId = payload.sub;
    addConnection(payload.sub, ws);

    // Send current active jobs as initial state
    const activeJobs = await db
      .select()
      .from(downloadJobs)
      .where(
        and(
          eq(downloadJobs.userId, payload.sub),
          notInArray(downloadJobs.status, ["completed", "failed"]),
        ),
      );

    for (const job of activeJobs) {
      const msg: WsJobStatusMessage = {
        type: "job:status",
        jobId: job.id,
        status: job.status as WsJobStatusMessage["status"],
        title: job.title,
        artist: job.artist,
        duration: job.duration,
        trackId: job.trackId,
        error: job.error,
        progress: null,
      };
      ws.send(JSON.stringify(msg));
    }
  } catch {
    ws.close(4001, "Invalid token");
  }
}

export function handleWsClose(ws: ServerWebSocket<WsData>) {
  if (ws.data.userId) {
    removeConnection(ws.data.userId, ws);
  }
}

export function handleWsMessage(_ws: ServerWebSocket<WsData>, _message: string | Buffer) {
  // Server → client only, no client messages expected
}
