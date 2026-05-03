export type TrackSource = "youtube" | "soundcloud" | "upload";

export interface Track {
  id: string;
  source: TrackSource;
  sourceId: string | null;
  contentHash: string;
  title: string;
  artist: string | null;
  duration: number | null;
  fileKey: string;
  fileSize: number | null;
  format: string | null;
  sourceUrl: string | null;
  downloadedAt: Date;
  // Per-user fields, populated when joined with userTracks.
  originalBpm?: number | null;
  localUri?: string | null;
}

export interface TrackInsert {
  id?: string;
  source: TrackSource;
  sourceId?: string | null;
  contentHash: string;
  title: string;
  artist?: string | null;
  duration?: number | null;
  fileKey: string;
  fileSize?: number | null;
  format?: string | null;
  sourceUrl?: string | null;
}

export interface UserTrack {
  id: string;
  userId: string;
  trackId: string;
  addedAt: Date;
  originalBpm: number | null;
}

export interface UserTrackWithTrack extends UserTrack {
  track: Track;
}

/** Flattened track entry for library UI — merges Track + UserTrack fields. */
export interface LibraryTrack extends Track {
  userTrackId: string;
  addedAt: Date;
  originalBpm: number | null;
}

export interface Playlist {
  id: string;
  userId: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface PlaylistInsert {
  id?: string;
  userId: string;
  name: string;
}

export interface PlaylistTrack {
  id: string;
  playlistId: string;
  trackId: string;
  position: number;
}

export interface PlaylistTrackInsert {
  id?: string;
  playlistId: string;
  trackId: string;
  position: number;
}

export interface PlaybackState {
  id: string;
  userId: string;
  trackId: string;
  playbackRate: number;
  lastPosition: number;
  updatedAt: Date;
}

export interface PlaybackStateInsert {
  id?: string;
  userId: string;
  trackId: string;
  playbackRate?: number;
  lastPosition?: number;
}

// Download job types

export type DownloadJobStatus =
  | "queued"
  | "downloading"
  | "uploading"
  | "completed"
  | "failed";

export interface DownloadJob {
  id: string;
  userId: string;
  url: string;
  youtubeId: string | null;
  status: DownloadJobStatus;
  title: string | null;
  artist: string | null;
  duration: number | null;
  trackId: string | null;
  error: string | null;
  createdAt: Date;
  completedAt: Date | null;
}

export interface WsJobStatusMessage {
  type: "job:status";
  jobId: string;
  status: DownloadJobStatus;
  title: string | null;
  artist: string | null;
  duration: number | null;
  trackId: string | null;
  error: string | null;
  progress: number | null;
}
