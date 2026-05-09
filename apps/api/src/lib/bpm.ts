import { unlink } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

export interface BpmResult {
  bpm: number;
  /**
   * Time of the first detected beat in seconds.
   * Combined with bpm, this defines a full beat grid:
   *   beat_n = beatOffset + n * (60 / bpm)
   *
   * Note: aubio's beat tracker reports the nearest tactus hit, not
   * necessarily the musical downbeat. The offset gives you beat-level
   * alignment; bar-level (downbeat) correction may need manual adjustment.
   */
  beatOffset: number;
}

/**
 * Detect the dominant BPM and first beat offset of an audio file.
 *
 * Pipeline:
 *   ffmpeg -i <file> -ac 1 -ar 22050 -f wav <tmpwav>
 *   aubiotrack <tmpwav>            -> beat times in seconds, one per line
 *   median(diff(times))            -> median inter-beat interval
 *   60 / median_interval           -> BPM
 *   beats[0]                       -> beatOffset (first beat timestamp)
 *
 * Aubio is built against libsndfile, which doesn't decode AAC/M4A, so we
 * decode through ffmpeg first into a 22.05 kHz mono WAV — sufficient for
 * tempo detection and ~5x faster than the 44.1 kHz original.
 *
 * Returns null when the file has fewer than 4 detected beats (too short or
 * arrhythmic) or any of the steps errors out.
 */
export async function detectBpm(filePath: string): Promise<BpmResult | null> {
  const wavPath = join(tmpdir(), `aani-bpm-${process.pid}-${Date.now()}.wav`);
  try {
    const ff = Bun.spawn(
      [
        "ffmpeg", "-y",
        "-i", filePath,
        "-ac", "1",
        "-ar", "22050",
        "-f", "wav",
        wavPath,
      ],
      { stdout: "pipe", stderr: "pipe" },
    );
    const ffCode = await ff.exited;
    if (ffCode !== 0) {
      const stderr = await new Response(ff.stderr).text();
      console.warn(`[bpm] ffmpeg failed (${ffCode}): ${stderr.slice(0, 300)}`);
      return null;
    }

    const at = Bun.spawn(["aubiotrack", wavPath], { stdout: "pipe", stderr: "pipe" });
    const stdout = await new Response(at.stdout).text();
    const atCode = await at.exited;
    if (atCode !== 0) {
      const stderr = await new Response(at.stderr).text();
      console.warn(`[bpm] aubiotrack failed (${atCode}): ${stderr.slice(0, 300)}`);
      return null;
    }

    const beats = stdout
      .trim()
      .split("\n")
      .map((line) => parseFloat(line.trim()))
      .filter((n) => Number.isFinite(n) && n > 0);

    if (beats.length < 4) return null;

    const intervals: number[] = [];
    for (let i = 1; i < beats.length; i++) {
      intervals.push(beats[i]! - beats[i - 1]!);
    }
    intervals.sort((a, b) => a - b);
    const median = intervals[Math.floor(intervals.length / 2)]!;
    if (median <= 0) return null;

    let bpm = 60 / median;
    if (bpm < 40 || bpm > 220) return null;

    // aubio's tempo tracker locks onto the tactus, which sits at half-time
    // on most dance music (house/techno actually pulses at ~125, aubio
    // reports ~62). Anything below 95 is almost certainly a half-miss for
    // the music in this library — double it. Above 95 we trust the value.
    if (bpm < 95) bpm *= 2;
    if (bpm > 220) return null;

    // beatOffset: first detected beat, adjusted for the same doubling.
    // When we double BPM (half-time correction), the beat grid has twice
    // as many beats — the offset stays the same since it's the first
    // aubio hit, which is still a valid beat position.
    const beatOffset = Math.round(beats[0]! * 1000) / 1000;

    return { bpm: Math.round(bpm * 10) / 10, beatOffset };
  } catch (e) {
    console.warn(`[bpm] error: ${e instanceof Error ? e.message : String(e)}`);
    return null;
  } finally {
    unlink(wavPath).catch(() => {});
  }
}
