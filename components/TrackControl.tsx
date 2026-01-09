import React from 'react';
import { Track } from '../types';
import { Volume2, VolumeX, Mic, Headphones } from 'lucide-react';

interface TrackControlProps {
  track: Track;
  onUpdate: (id: string, updates: Partial<Track>) => void;
  onDelete: (id: string) => void;
  isRecording: boolean;
  onRecordToggle: (trackId: string) => void;
}

export const TrackControl: React.FC<TrackControlProps> = ({ 
    track, 
    onUpdate, 
    onDelete, 
    isRecording, 
    onRecordToggle 
}) => {
  return (
    <div className="flex flex-col p-3 border-b border-gray-700 bg-gray-800 h-24 relative group">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: track.color }} />
            <span className="font-semibold text-sm text-gray-200 truncate w-24" title={track.name}>
            {track.name}
            </span>
        </div>
        <button 
            onClick={() => onDelete(track.id)}
            className="text-xs text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
        >
            Delete
        </button>
      </div>

      <div className="flex items-center gap-2 mb-2">
        {/* Record Button */}
        <button
          onClick={() => onRecordToggle(track.id)}
          className={`p-1.5 rounded-full transition-all ${isRecording ? 'bg-red-500 text-white animate-pulse' : 'bg-gray-700 text-red-500 hover:bg-gray-600 hover:text-red-400'}`}
          title="Record"
        >
          <div className={`w-3 h-3 rounded-full ${isRecording ? 'bg-white' : 'bg-current'}`} />
        </button>

        <button
          onClick={() => onUpdate(track.id, { muted: !track.muted })}
          className={`p-1 rounded ${track.muted ? 'bg-red-500/20 text-red-500' : 'bg-gray-700 text-gray-400 hover:text-gray-200'}`}
          title="Mute"
        >
          {track.muted ? <VolumeX size={14} /> : <Volume2 size={14} />}
        </button>
        <button
          onClick={() => onUpdate(track.id, { soloed: !track.soloed })}
          className={`p-1 rounded ${track.soloed ? 'bg-yellow-500/20 text-yellow-500' : 'bg-gray-700 text-gray-400 hover:text-gray-200'}`}
          title="Solo"
        >
          <Headphones size={14} />
        </button>
        <div className="flex-1">
            <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={track.volume}
                onChange={(e) => onUpdate(track.id, { volume: parseFloat(e.target.value) })}
                className="w-full h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-blue-500"
            />
        </div>
      </div>
    </div>
  );
};