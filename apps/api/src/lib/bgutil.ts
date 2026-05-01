import { existsSync } from "node:fs";

const BGUTIL_PORT = 4416;
const BGUTIL_PATH = "/opt/bgutil/server/build/main.js";
const RESTART_DELAY_MS = 5000;
const MAX_RESTARTS = 10;

let restartCount = 0;

export function startBgutilServer(): void {
  if (!existsSync(BGUTIL_PATH)) {
    console.warn(`[bgutil] ${BGUTIL_PATH} not found — running without PO Token provider (yt-dlp downloads may fail on YouTube)`);
    return;
  }

  const proc = Bun.spawn(["node", BGUTIL_PATH, "--port", String(BGUTIL_PORT)], {
    stdout: "pipe",
    stderr: "pipe",
  });

  console.log(`[bgutil] PO Token server started on :${BGUTIL_PORT} (pid ${proc.pid})`);

  void pipeLogs(proc.stdout, false);
  void pipeLogs(proc.stderr, true);

  proc.exited.then((code) => {
    console.error(`[bgutil] exited with code ${code}`);
    if (++restartCount > MAX_RESTARTS) {
      console.error(`[bgutil] exceeded ${MAX_RESTARTS} restarts — giving up`);
      return;
    }
    setTimeout(startBgutilServer, RESTART_DELAY_MS);
  });
}

async function pipeLogs(stream: ReadableStream<Uint8Array>, isError: boolean) {
  const decoder = new TextDecoder();
  let buffer = "";
  for await (const chunk of stream as unknown as AsyncIterable<Uint8Array>) {
    buffer += decoder.decode(chunk, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      const out = `[bgutil] ${line}`;
      if (isError) console.error(out);
      else console.log(out);
    }
  }
}
