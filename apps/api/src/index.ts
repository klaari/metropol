import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { env } from "./lib/env";
import { healthRoute } from "./routes/health";
import { downloadRoute } from "./routes/download";
import { cookiesRoute } from "./routes/cookies";
import { playlistsRoute } from "./routes/playlists";
import { discogsRoute } from "./routes/discogs";
import { handleWsOpen, handleWsClose, handleWsMessage } from "./ws/handler";
import { initProcessor, recoverStaleJobs } from "./jobs/processor";
import { startBgutilServer } from "./lib/bgutil";

// Spawn the bgutil PO Token provider before any yt-dlp invocation can happen.
// yt-dlp's bgutil plugin auto-detects it on 127.0.0.1:4416.
startBgutilServer();

initProcessor();

const app = new Hono();

app.use("*", logger());
app.use("*", cors());

app.route("/", healthRoute);
app.route("/", downloadRoute);
app.route("/", cookiesRoute);
app.route("/", playlistsRoute);
app.route("/", discogsRoute);

const server = Bun.serve({
  port: env.port,
  fetch(req, server) {
    const url = new URL(req.url);

    if (url.pathname === "/ws") {
      const token = url.searchParams.get("token");
      if (!token) {
        return new Response("Missing token", { status: 401 });
      }
      const upgraded = server.upgrade(req, { data: { token } });
      if (upgraded) return undefined;
      return new Response("WebSocket upgrade failed", { status: 500 });
    }

    return app.fetch(req, { ip: server.requestIP(req) });
  },
  websocket: {
    open: handleWsOpen,
    close: handleWsClose,
    message: handleWsMessage,
  },
});

console.log(`Aani API running on port ${server.port}`);

// Recover jobs that were in-progress when server last stopped
recoverStaleJobs().catch((err) => {
  console.error("[startup] Failed to recover stale jobs:", err);
});
