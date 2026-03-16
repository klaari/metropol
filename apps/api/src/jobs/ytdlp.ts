import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

export interface VideoMetadata {
  title: string;
  artist: string;
  duration: number;
}

export async function getMetadata(url: string): Promise<VideoMetadata> {
  const args = ["yt-dlp", "--dump-json", "--no-download", "--js-runtimes", "node", "-v"];
  if (process.env.YT_COOKIES_FILE) args.push("--cookies", process.env.YT_COOKIES_FILE);
  args.push(url);

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
  return {
    title: info.title || "Unknown",
    artist: info.uploader || info.channel || "Unknown",
    duration: Math.round(info.duration || 0),
  };
}

export interface DownloadResult {
  filePath: string;
  cleanupDir: string;
}

export async function downloadAudio(url: string): Promise<DownloadResult> {
  const dir = await mkdtemp(join(tmpdir(), "metropol-"));
  const output = join(dir, "audio.%(ext)s");

  const args = [
    "yt-dlp",
    "--js-runtimes", "node",
    "-v",
    "-f", "bestaudio[ext=m4a]/bestaudio",
    "--extract-audio",
    "--audio-format", "m4a",
    "-o", output,
  ];
  if (process.env.YT_COOKIES_FILE) args.push("--cookies", process.env.YT_COOKIES_FILE);
  args.push(url);

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
