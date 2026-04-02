
export interface Track {
  id: string;
  name: string;
  color: string;
  volume: number; // 0.0 to 1.0
  muted: boolean;
  soloed: boolean;
  plugins: AudioPlugin[];
  isMaster?: boolean;
  // Key is the parameter ID (e.g., 'volume', 'pan', 'pluginId:paramName')
  automation: Record<string, AutomationPoint[]>; 
  showAutomation?: boolean; 
  selectedAutomationId?: string; // Which lane is currently visible/editable
}

export interface AutomationPoint {
  id: string;
  time: number; 
  value: number; // Normalized 0-1
}

export interface AudioClip {
  id: string;
  trackId: string;
  buffer: AudioBuffer;
  name: string;
  startTime: number; 
  duration: number; 
  offset: number; 
  
  gain: number; 
  pan: number; 
  playbackRate: number; 
  loop: boolean;
}

export enum DragType {
  CLIP = 'CLIP',
  FILE = 'FILE'
}

export interface DragItem {
  type: DragType;
  id?: string; 
  files?: FileList; 
}

export interface PlaybackState {
  isPlaying: boolean;
  currentTime: number; 
}

export type PluginType = 'DELAY' | 'REVERB' | 'DISTORTION' | 'FILTER' | 'LIMITER' | 'SIDECHAIN' | 'EQ8' | 'COMPRESSOR' | 'BITCRUSHER' | 'TAPE_SATURATION';

export interface AudioPlugin {
  id: string;
  type: PluginType;
  enabled: boolean;
  params: {
    [key: string]: number | string;
  };
}

export type ToolType = 'MOVE' | 'BLADE';

export interface HistoryState {
  tracks: Track[];
  clips: AudioClip[];
}

export interface LoopRegion {
  start: number;
  end: number;
  enabled: boolean;
}
