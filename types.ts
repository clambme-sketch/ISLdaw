export interface Track {
  id: string;
  name: string;
  color: string;
  volume: number; // 0.0 to 1.0
  muted: boolean;
  soloed: boolean;
}

export interface AudioClip {
  id: string;
  trackId: string;
  buffer: AudioBuffer;
  name: string;
  startTime: number; // Start time in seconds on the timeline
  duration: number; // Duration in seconds
  offset: number; // Start offset within the audio file (trimming start)
}

export enum DragType {
  CLIP = 'CLIP',
  FILE = 'FILE'
}

export interface DragItem {
  type: DragType;
  id?: string; // If moving an existing clip
  files?: FileList; // If dropping external files
}

export interface PlaybackState {
  isPlaying: boolean;
  currentTime: number; // Current playback time in seconds
}