
import React, { useState } from 'react';
import { AudioClip } from '../types';
import { X, RotateCw, Volume2, Gauge, MoveHorizontal, Zap, Wand2 } from 'lucide-react';
import { audioService } from '../services/audioEngine';

interface ClipEditorProps {
  clip: AudioClip | null;
  onUpdate: (id: string, updates: Partial<AudioClip>) => void;
  onClose: () => void;
  projectBpm: number;
}

export const ClipEditor: React.FC<ClipEditorProps> = ({ clip, onUpdate, onClose, projectBpm }) => {
  const [originalBpm, setOriginalBpm] = useState<string>('');
  const [isDetecting, setIsDetecting] = useState(false);

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

  const handleAutoTempo = async () => {
      setIsDetecting(true);
      try {
          const detectedBpm = await audioService.detectTempo(clip.buffer);
          setOriginalBpm(detectedBpm.toString());
      } catch (error) {
          console.error("Failed to detect tempo:", error);
          alert("Failed to detect tempo.");
      } finally {
          setIsDetecting(false);
      }
  };

  return (
    <div className="h-48 bg-[#2d2d2d] border-t border-[#111] flex flex-col shadow-none z-40 transition-none">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-[#111] bg-[#2d2d2d]">
        <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-[#d4d4d4] uppercase tracking-wider">Clip Editor</span>
            <span className="text-xs text-[#999] font-mono bg-[#111] px-2 py-0.5 rounded-none">{clip.name}</span>
        </div>
        <button onClick={onClose} className="text-[#999] hover:text-[#d4d4d4] transition-none" title="Close Editor">
          <X size={16} />
        </button>
      </div>

      {/* Controls */}
      <div className="flex-1 p-6 flex items-start gap-8 overflow-x-auto">
        
        {/* Gain */}
        <div className="flex flex-col gap-2 w-32 shrink-0">
            <div className="flex items-center justify-between text-xs text-[#999]">
                <span className="flex items-center gap-1"><Volume2 size={12}/> Gain</span>
                <div className="flex items-center">
                    <input 
                        type="number" 
                        value={clip.gain <= 0 ? -60 : Math.max(-60, 20 * Math.log10(clip.gain)).toFixed(1)} 
                        onChange={(e) => {
                            const db = parseFloat(e.target.value);
                            const linear = db <= -60 ? 0 : Math.pow(10, db / 20);
                            onUpdate(clip.id, { gain: linear });
                        }}
                        className="w-10 bg-transparent text-right outline-none focus:text-[#ff7b00] hide-arrows"
                    />
                    <span className="ml-0.5">dB</span>
                </div>
            </div>
            <input 
                type="range" 
                min="-60" max="24" step="0.1" 
                value={clip.gain <= 0 ? -60 : Math.max(-60, 20 * Math.log10(clip.gain))}
                onChange={(e) => {
                    const db = parseFloat(e.target.value);
                    const linear = db <= -60 ? 0 : Math.pow(10, db / 20);
                    onUpdate(clip.id, { gain: linear });
                }}
                onDoubleClick={() => onUpdate(clip.id, { gain: 1 })}
                className="w-full h-1.5 bg-[#111] rounded-none appearance-none cursor-pointer accent-[#ff7b00]"
                title={`Gain: ${clip.gain <= 0 ? '-inf' : Math.max(-60, 20 * Math.log10(clip.gain)).toFixed(1)} dB (Double-click to reset)`}
            />
            <div className="flex justify-between text-[10px] text-[#666] font-mono">
                <span>-inf</span>
                <span>0dB</span>
                <span>+24dB</span>
            </div>
        </div>

        {/* Pan */}
        <div className="flex flex-col gap-2 w-32 shrink-0">
            <div className="flex items-center justify-between text-xs text-[#999]">
                <span className="flex items-center gap-1"><MoveHorizontal size={12}/> Pan</span>
                <input 
                    type="number" 
                    value={clip.pan.toFixed(1)} 
                    step="0.1"
                    onChange={(e) => onUpdate(clip.id, { pan: parseFloat(e.target.value) })}
                    className="w-10 bg-transparent text-right outline-none focus:text-[#ff7b00] hide-arrows"
                />
            </div>
            <input 
                type="range" 
                min="-1" max="1" step="0.1" 
                value={clip.pan}
                onChange={(e) => onUpdate(clip.id, { pan: parseFloat(e.target.value) })}
                onDoubleClick={() => onUpdate(clip.id, { pan: 0 })}
                className="w-full h-1.5 bg-[#111] rounded-none appearance-none cursor-pointer accent-[#ff7b00]"
                title={`Pan: ${clip.pan.toFixed(1)} (Double-click to reset)`}
            />
            <div className="flex justify-between text-[10px] text-[#666] font-mono">
                <span>L</span>
                <span>C</span>
                <span>R</span>
            </div>
        </div>

        {/* Pitch / Rate */}
        <div className="flex flex-col gap-2 w-32 shrink-0">
            <div className="flex items-center justify-between text-xs text-[#999]">
                <span className="flex items-center gap-1"><Gauge size={12}/> Pitch/Rate</span>
                <div className="flex items-center">
                    <input 
                        type="number" 
                        value={clip.playbackRate.toFixed(3)} 
                        step="0.001"
                        onChange={(e) => onUpdate(clip.id, { playbackRate: parseFloat(e.target.value) })}
                        className="w-12 bg-transparent text-right outline-none focus:text-[#ff7b00] hide-arrows"
                    />
                    <span>x</span>
                </div>
            </div>
            <input 
                type="range" 
                min="0.1" max="4.0" step="0.001" 
                value={clip.playbackRate}
                onChange={(e) => onUpdate(clip.id, { playbackRate: parseFloat(e.target.value) })}
                onDoubleClick={() => onUpdate(clip.id, { playbackRate: 1 })}
                className="w-full h-1.5 bg-[#111] rounded-none appearance-none cursor-pointer accent-[#ff7b00]"
                title={`Playback Rate: ${clip.playbackRate.toFixed(3)}x (Double-click to reset)`}
            />
             <div className="flex justify-between text-[10px] text-[#666] font-mono">
                <span>0.1x</span>
                <span>4.0x</span>
            </div>
        </div>

        <div className="w-px h-16 bg-[#111] mx-2 shrink-0"></div>
        
        {/* Warp Section */}
        <div className="flex flex-col gap-2 w-48 shrink-0">
            <div className="flex items-center justify-between text-xs text-[#999]">
                <span className="flex items-center gap-1"><Zap size={12} className="text-[#ff7b00]"/> Warp Mode</span>
            </div>
            <div className="flex gap-2">
                <input 
                    type="number"
                    placeholder="Orig BPM"
                    value={originalBpm}
                    onChange={(e) => setOriginalBpm(e.target.value)}
                    className="w-16 bg-[#111] border border-[#444] rounded-none px-2 py-1 text-xs text-white outline-none focus:border-[#ff7b00]"
                />
                <button 
                    onClick={handleAutoTempo}
                    disabled={isDetecting}
                    className="flex items-center justify-center bg-[#444] hover:bg-[#555] text-xs text-[#d4d4d4] rounded-none px-2 py-1 transition-none active:bg-[#ff7b00] active:text-black disabled:opacity-50"
                    title="Auto-detect BPM"
                >
                    {isDetecting ? '...' : <Wand2 size={12} />}
                </button>
                <button 
                    onClick={handleWarp}
                    className="flex-1 bg-[#444] hover:bg-[#555] text-xs text-[#d4d4d4] rounded-none px-2 py-1 transition-none active:bg-[#ff7b00] active:text-black"
                    title={`Match clip to Project BPM (${projectBpm})`}
                >
                    Match
                </button>
            </div>
            <div className="text-[10px] text-[#666]">
                Sets rate to match Project {projectBpm} BPM.
            </div>
        </div>

        <div className="w-px h-16 bg-[#111] mx-2 shrink-0"></div>

        {/* Loop Toggle */}
        <div className="flex flex-col gap-2 items-center shrink-0">
            <span className="text-xs text-[#999] mb-1">Looping</span>
            <button 
                onClick={() => onUpdate(clip.id, { loop: !clip.loop })}
                className={`w-12 h-12 rounded-none flex items-center justify-center transition-none border ${clip.loop ? 'bg-[#ff7b00] border-[#ff7b00] text-black shadow-none' : 'bg-[#444] border-[#444] text-[#999] hover:text-[#d4d4d4]'}`}
                title={clip.loop ? "Disable Clip Loop" : "Enable Clip Loop"}
            >
                <RotateCw size={24} />
            </button>
        </div>

        <div className="w-px h-16 bg-[#111] mx-2 shrink-0"></div>

        {/* Info Stats */}
        <div className="flex flex-col gap-1 text-xs text-[#666] font-mono shrink-0">
             <div>Start: <span className="text-[#999]">{clip.startTime.toFixed(2)}s</span></div>
             <div>Dur: <span className="text-[#999]">{clip.duration.toFixed(2)}s</span></div>
             <div>Offset: <span className="text-[#999]">{clip.offset.toFixed(2)}s</span></div>
        </div>

      </div>
    </div>
  );
};
