import type { Track } from "@aani/types";
import { usePlayerStore } from "../store/player";

export function useCurrentTrack(): Track | null {
  return usePlayerStore((s) =>
    s.currentIndex >= 0 ? s.queue[s.currentIndex]?.track ?? null : null,
  );
}
