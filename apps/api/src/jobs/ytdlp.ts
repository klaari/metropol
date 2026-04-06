import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

export interface YtDlpOptions {
  cookiesPath?: string | null;
}

export interface VideoMetadata {
  title: string;
  artist: string | null;
  duration: number;
}

function jsRuntimeArgs(): string[] {
  // Use explicit NODE_PATH if set, otherwise try the current Bun runtime,
  // then fall back to common node locations.
  if (process.env.NODE_PATH) {
    return ["--js-runtimes", `node:${process.env.NODE_PATH}`];
  }
  // process.execPath is the running Bun (or Node) binary — always correct on Railway
  const runtime = process.execPath;
  const isBun = runtime.toLowerCase().includes("bun");
  return ["--js-runtimes", `${isBun ? "bun" : "node"}:${runtime}`];
}

/** Strip playlist/radio params so yt-dlp treats the URL as a single video. */
function stripPlaylistParams(url: string): string {
  try {
    const u = new URL(url);
    u.searchParams.delete("list");
    u.searchParams.delete("start_radio");
    u.searchParams.delete("index");
    return u.toString();
  } catch {
    return url;
  }
}

export async function getMetadata(url: string, opts?: YtDlpOptions): Promise<VideoMetadata> {
  const cleanUrl = stripPlaylistParams(url.trim());
  const args = ["yt-dlp", "--dump-json", "--no-download", "--no-playlist", ...jsRuntimeArgs(), "-v", "--extractor-args", "youtube:player_client=ios,web"];
  if (opts?.cookiesPath) args.push("--cookies", opts.cookiesPath);
  args.push(cleanUrl);

  console.log(`[yt-dlp] metadata cmd: ${args.join(" ")}`);
  const proc = Bun.spawn(args, { stdout: "pipe", stderr: "pipe" });

  const [stdout, stderr] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ]);
  const code = await proc.exited;

  if (code !== 0) {
    console.error(`[yt-dlp] metadata stderr:\n${stderr}`);
    throw new Error(`yt-dlp metadata failed: ${stderr.trim()}`);
  }

  const info = JSON.parse(stdout);
  // Only use actual music metadata tags — never fall back to channel/uploader
  // as that produces "Channel - Artist - Title" filenames when the title
  // already contains the artist name.
  const artist: string = info.artist || info.creator || null;

  return {
    title: info.title || "Unknown",
    artist,
    duration: Math.round(info.duration || 0),
  };
}

export interface DownloadResult {
  filePath: string;
  cleanupDir: string;
}

export async function downloadAudio(url: string, opts?: YtDlpOptions): Promise<DownloadResult> {
  const cleanUrl = stripPlaylistParams(url.trim());
  const dir = await mkdtemp(join(tmpdir(), "metropol-"));
  const output = join(dir, "audio.%(ext)s");

  const args = [
    "yt-dlp",
    ...jsRuntimeArgs(),
    "-v",
    "--no-playlist",
    "--extractor-args", "youtube:player_client=ios,web",
    "-f", "bestaudio[ext=m4a]/bestaudio",
    "--extract-audio",
    "--audio-format", "m4a",
    "-o", output,
  ];
  if (opts?.cookiesPath) args.push("--cookies", opts.cookiesPath);
  args.push(cleanUrl);

  console.log(`[yt-dlp] download cmd: ${args.join(" ")}`);
  const proc = Bun.spawn(args, { stdout: "pipe", stderr: "pipe" });

  const stderr = await new Response(proc.stderr).text();
  const code = await proc.exited;

  if (code !== 0) {
    console.error(`[yt-dlp] download stderr:\n${stderr}`);
    await rm(dir, { recursive: true, force: true });
    throw new Error(`yt-dlp download failed: ${stderr.trim()}`);
  }

  // Find the downloaded file
  const glob = new Bun.Glob("audio.*");
  for await (const file of glob.scan(dir)) {
    return { filePath: join(dir, file), cleanupDir: dir };
  }

  await rm(dir, { recursive: true, force: true });
  throw new Error("yt-dlp produced no output file");
}
