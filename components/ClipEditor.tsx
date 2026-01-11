
import React, { useState } from 'react';
import { AudioClip } from '../types';
import { X, RotateCw, Volume2, Gauge, MoveHorizontal, Zap } from 'lucide-react';

interface ClipEditorProps {
  clip: AudioClip | null;
  onUpdate: (id: string, updates: Partial<AudioClip>) => void;
  onClose: () => void;
  projectBpm: number;
}

export const ClipEditor: React.FC<ClipEditorProps> = ({ clip, onUpdate, onClose, projectBpm }) => {
  const [originalBpm, setOriginalBpm] = useState<string>('');

  if (!clip) return null;

  const handleWarp = () => {
      const bpm = parseFloat(originalBpm);
      if (isNaN(bpm) || bpm <= 0) {
          alert("Please enter a valid BPM");
          return;
      }
      
      const newRate = projectBpm / bpm;
      onUpdate(clip.id, { playbackRate: newRate });
  };

  return (
    <div className="h-48 bg-gray-900 border-t border-gray-700 flex flex-col shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.3)] z-40 animate-slide-up">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-800 bg-gray-850">
        <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-gray-200 uppercase tracking-wider">Clip Editor</span>
            <span className="text-xs text-gray-500 font-mono bg-gray-800 px-2 py-0.5 rounded">{clip.name}</span>
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors" title="Close Editor">
          <X size={16} />
        </button>
      </div>

      {/* Controls */}
      <div className="flex-1 p-6 flex items-start gap-8 overflow-x-auto">
        
        {/* Gain */}
        <div className="flex flex-col gap-2 w-32 shrink-0">
            <div className="flex items-center justify-between text-xs text-gray-400">
                <span className="flex items-center gap-1"><Volume2 size={12}/> Gain</span>
                <span>{(clip.gain * 100).toFixed(0)}%</span>
            </div>
            <input 
                type="range" 
                min="0" max="2" step="0.01" 
                value={clip.gain}
                onChange={(e) => onUpdate(clip.id, { gain: parseFloat(e.target.value) })}
                className="w-full h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                title={`Gain: ${(clip.gain * 100).toFixed(0)}%`}
            />
            <div className="flex justify-between text-[10px] text-gray-600 font-mono">
                <span>0%</span>
                <span>200%</span>
            </div>
        </div>

        {/* Pan */}
        <div className="flex flex-col gap-2 w-32 shrink-0">
            <div className="flex items-center justify-between text-xs text-gray-400">
                <span className="flex items-center gap-1"><MoveHorizontal size={12}/> Pan</span>
                <span>{clip.pan.toFixed(1)}</span>
            </div>
            <input 
                type="range" 
                min="-1" max="1" step="0.1" 
                value={clip.pan}
                onChange={(e) => onUpdate(clip.id, { pan: parseFloat(e.target.value) })}
                className="w-full h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-green-500"
                title={`Pan: ${clip.pan.toFixed(1)}`}
            />
            <div className="flex justify-between text-[10px] text-gray-600 font-mono">
                <span>L</span>
                <span>C</span>
                <span>R</span>
            </div>
        </div>

        {/* Pitch / Rate */}
        <div className="flex flex-col gap-2 w-32 shrink-0">
            <div className="flex items-center justify-between text-xs text-gray-400">
                <span className="flex items-center gap-1"><Gauge size={12}/> Pitch/Rate</span>
                <span>{clip.playbackRate.toFixed(3)}x</span>
            </div>
            <input 
                type="range" 
                min="0.1" max="4.0" step="0.001" 
                value={clip.playbackRate}
                onChange={(e) => onUpdate(clip.id, { playbackRate: parseFloat(e.target.value) })}
                className="w-full h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
                title={`Playback Rate: ${clip.playbackRate.toFixed(3)}x`}
            />
             <div className="flex justify-between text-[10px] text-gray-600 font-mono">
                <span>0.1x</span>
                <span>4.0x</span>
            </div>
        </div>

        <div className="w-px h-16 bg-gray-800 mx-2 shrink-0"></div>
        
        {/* Warp Section */}
        <div className="flex flex-col gap-2 w-36 shrink-0">
            <div className="flex items-center justify-between text-xs text-gray-400">
                <span className="flex items-center gap-1"><Zap size={12} className="text-yellow-500"/> Warp Mode</span>
            </div>
            <div className="flex gap-2">
                <input 
                    type="number"
                    placeholder="Orig BPM"
                    value={originalBpm}
                    onChange={(e) => setOriginalBpm(e.target.value)}
                    className="w-16 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-white outline-none focus:border-blue-500"
                />
                <button 
                    onClick={handleWarp}
                    className="flex-1 bg-gray-700 hover:bg-gray-600 text-xs text-gray-200 rounded px-2 py-1 transition-colors active:bg-blue-600 active:text-white"
                    title={`Match clip to Project BPM (${projectBpm})`}
                >
                    Match
                </button>
            </div>
            <div className="text-[10px] text-gray-600">
                Sets rate to match Project {projectBpm} BPM.
            </div>
        </div>

        <div className="w-px h-16 bg-gray-800 mx-2 shrink-0"></div>

        {/* Loop Toggle */}
        <div className="flex flex-col gap-2 items-center shrink-0">
            <span className="text-xs text-gray-400 mb-1">Looping</span>
            <button 
                onClick={() => onUpdate(clip.id, { loop: !clip.loop })}
                className={`w-12 h-12 rounded-lg flex items-center justify-center transition-all border ${clip.loop ? 'bg-blue-500/20 border-blue-500 text-blue-400 shadow-[0_0_10px_rgba(59,130,246,0.3)]' : 'bg-gray-800 border-gray-700 text-gray-500 hover:text-gray-300'}`}
                title={clip.loop ? "Disable Clip Loop" : "Enable Clip Loop"}
            >
                <RotateCw size={24} />
            </button>
        </div>

        <div className="w-px h-16 bg-gray-800 mx-2 shrink-0"></div>

        {/* Info Stats */}
        <div className="flex flex-col gap-1 text-xs text-gray-500 font-mono shrink-0">
             <div>Start: <span className="text-gray-300">{clip.startTime.toFixed(2)}s</span></div>
             <div>Dur: <span className="text-gray-300">{clip.duration.toFixed(2)}s</span></div>
             <div>Offset: <span className="text-gray-300">{clip.offset.toFixed(2)}s</span></div>
        </div>

      </div>
    </div>
  );
};
