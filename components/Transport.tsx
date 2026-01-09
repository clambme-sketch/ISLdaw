
import React from 'react';
import { Play, Square, FastForward, Rewind, Activity } from 'lucide-react';

interface TransportProps {
  isPlaying: boolean;
  onPlay: () => void;
  onStop: () => void;
  onRewind: () => void;
  onFastForward: () => void;
  currentTime: number;
  bpm: number;
  setBpm: (bpm: number) => void;
}

const formatTime = (seconds: number) => {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 100);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
};

export const Transport: React.FC<TransportProps> = ({ 
    isPlaying, 
    onPlay, 
    onStop, 
    onRewind,
    onFastForward,
    currentTime, 
    bpm, 
    setBpm 
}) => {
  return (
    <div className="h-16 bg-gray-900 border-b border-gray-700 flex items-center px-4 justify-between z-30 shadow-lg">
      <div className="flex items-center gap-6">
        <div className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-500 mr-2">
            ISLdaw
        </div>

        {/* BPM Control */}
        <div className="flex items-center gap-2 bg-gray-800 rounded-lg p-1.5 border border-gray-700 group focus-within:border-blue-500/50 transition-colors">
            <Activity size={16} className="text-gray-500 group-focus-within:text-blue-400 ml-1" />
            <div className="flex flex-col items-start mr-1">
                <span className="text-[10px] text-gray-500 font-bold leading-none">BPM</span>
                <input 
                    type="number" 
                    value={bpm}
                    onChange={(e) => setBpm(Math.max(1, Math.min(999, Number(e.target.value))))}
                    className="w-12 bg-transparent text-sm font-mono text-blue-400 outline-none p-0 leading-none"
                />
            </div>
        </div>

        <div className="w-px h-8 bg-gray-700 mx-2"></div>

        <div className="flex bg-gray-800 rounded-lg p-1 gap-1">
            <button 
                onClick={onRewind}
                className="p-2 text-gray-400 hover:text-white rounded hover:bg-gray-700 active:scale-95 transition-transform"
                title="-5s"
            >
                <Rewind size={20} />
            </button>
            <button 
                onClick={isPlaying ? onStop : onPlay}
                className={`p-2 rounded transition-all active:scale-95 ${isPlaying ? 'text-yellow-400 bg-yellow-400/10' : 'text-green-400 hover:bg-green-400/10 hover:text-green-300'}`}
            >
                {isPlaying ? <Square size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" />}
            </button>
             <button 
                onClick={onFastForward}
                className="p-2 text-gray-400 hover:text-white rounded hover:bg-gray-700 active:scale-95 transition-transform"
                title="+5s"
            >
                <FastForward size={20} />
            </button>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="bg-black/40 px-4 py-2 rounded text-blue-400 font-mono text-xl min-w-[120px] text-center border border-blue-500/20 shadow-inner select-none">
            {formatTime(currentTime)}
        </div>
      </div>
    </div>
  );
};
