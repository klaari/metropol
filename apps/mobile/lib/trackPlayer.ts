let TrackPlayer: typeof import("react-native-track-player").default | null =
  null;

try {
  TrackPlayer = require("react-native-track-player").default;
} catch {
  // Native module not available (Expo Go)
}

/** True if the native module exists at all (i.e. running in a dev/production build) */
export function isNativeModuleAvailable(): boolean {
  return TrackPlayer !== null;
}

export function getTrackPlayer() {
  return TrackPlayer;
}

// Singleton promise so setupPlayer() is safe to call multiple times
let setupPromise: Promise<boolean> | null = null;

/**
 * Set up the RNTP player. Safe to call multiple times — returns the same
 * promise after the first call. Await this before calling any RNTP methods.
 */
export function setupPlayer(): Promise<boolean> {
  if (setupPromise) return setupPromise;
  setupPromise = _setupPlayer();
  return setupPromise;
}

async function _setupPlayer(): Promise<boolean> {
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
    return true;
  } catch {
    console.warn(
      "react-native-track-player setup failed — audio playback disabled",
    );
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
      TrackPlayer!.addEventListener(
        Event.RemoteSeek,
        (e: { position: number }) => TrackPlayer!.seekTo(e.position),
      );
    });
  } catch {
    // Native module not available
  }
}
