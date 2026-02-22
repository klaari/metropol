let TrackPlayer: typeof import("react-native-track-player").default | null =
  null;
let isPlayerAvailable = false;

try {
  TrackPlayer = require("react-native-track-player").default;
} catch {
  // Native module not available (Expo Go)
}

export function getPlayerAvailable() {
  return isPlayerAvailable;
}

export function getTrackPlayer() {
  return TrackPlayer;
}

export async function setupPlayer(): Promise<boolean> {
  if (!TrackPlayer) return false;

  try {
    const {
      AppKilledPlaybackBehavior,
      Capability,
    } = require("react-native-track-player");

    await TrackPlayer.setupPlayer();
    await TrackPlayer.updateOptions({
      android: {
        appKilledPlaybackBehavior:
          AppKilledPlaybackBehavior.StopPlaybackAndRemoveNotification,
      },
      capabilities: [
        Capability.Play,
        Capability.Pause,
        Capability.SeekTo,
        Capability.SkipToNext,
        Capability.SkipToPrevious,
      ],
      compactCapabilities: [
        Capability.Play,
        Capability.Pause,
        Capability.SkipToNext,
      ],
    });
    isPlayerAvailable = true;
    return true;
  } catch {
    console.warn(
      "react-native-track-player not available — audio playback disabled",
    );
    isPlayerAvailable = false;
    return false;
  }
}

export function registerPlaybackService() {
  if (!TrackPlayer) return;

  try {
    const { Event } = require("react-native-track-player");

    TrackPlayer.registerPlaybackService(() => async () => {
      TrackPlayer!.addEventListener(Event.RemotePlay, () =>
        TrackPlayer!.play(),
      );
      TrackPlayer!.addEventListener(Event.RemotePause, () =>
        TrackPlayer!.pause(),
      );
      TrackPlayer!.addEventListener(Event.RemoteNext, () =>
        TrackPlayer!.skipToNext(),
      );
      TrackPlayer!.addEventListener(Event.RemotePrevious, () =>
        TrackPlayer!.skipToPrevious(),
      );
      TrackPlayer!.addEventListener(Event.RemoteSeek, (e: { position: number }) =>
        TrackPlayer!.seekTo(e.position),
      );
    });
  } catch {
    // Native module not available
  }
}
