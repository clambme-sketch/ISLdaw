
import React, { useEffect, useRef, useState } from 'react';
import { Track } from '../types';
import { Volume2, VolumeX, Mic, Headphones, Activity, TrendingUp, ChevronDown, Eye, AlertTriangle } from 'lucide-react';
import { audioService } from '../services/audioEngine';
import { TRACK_HEIGHT, AUTOMATION_HEIGHT } from '../constants';

interface TrackControlProps {
  track: Track;
  onUpdate: (id: string, updates: Partial<Track>) => void;
  onDelete: (id: string) => void;
  
  // Recording Props
  isArmed: boolean;
  isRecordingGlobal: boolean;
  onArmToggle: () => void;
  
  onOpenEditor: (trackId: string) => void;
  onToggleAutomation: (trackId: string) => void;
  onOpenVisualizerSettings?: () => void;
}

export const TrackControl: React.FC<TrackControlProps> = ({ 
    track, 
    onUpdate, 
    onDelete, 
    isArmed,
    isRecordingGlobal,
    onArmToggle,
    onOpenEditor,
    onToggleAutomation,
    onOpenVisualizerSettings
}) => {
  const isMaster = track.isMaster;
  const [hasClipped, setHasClipped] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Meter Animation
  useEffect(() => {
    let animationId: number;
    const analyser = audioService.getTrackAnalyser(track.id);
    const monitorAnalyser = audioService.getTrackMonitorAnalyser(track.id);
    
    // Choose analyser based on state: if armed, show monitor input. If playing, show track output.
    const activeAnalyser = isArmed ? monitorAnalyser : analyser;
    
    if (activeAnalyser && canvasRef.current) {
        const bufferLength = activeAnalyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        const ctx = canvasRef.current.getContext('2d');
        let localPeak = 0;
        let peakHoldTimer = 0;

        const draw = () => {
            if (!ctx) return;
            activeAnalyser.getByteTimeDomainData(dataArray);
            
            let sum = 0;
            let framePeak = 0;

            for(let i = 0; i < bufferLength; i++) {
                const sample = (dataArray[i] - 128) / 128; 
                sum += sample * sample;
                if (Math.abs(sample) > framePeak) framePeak = Math.abs(sample);
            }
            
            const rms = Math.sqrt(sum / bufferLength);
            
            if (framePeak > localPeak) {
                localPeak = framePeak;
                peakHoldTimer = 60; 
            } else {
                peakHoldTimer--;
                if (peakHoldTimer <= 0) localPeak *= 0.95; 
            }

            // Check for clipping (persistent)
            if (framePeak >= 0.99) {
                setHasClipped(true);
            }

            const width = canvasRef.current!.width;
            const height = canvasRef.current!.height;
            
            ctx.clearRect(0, 0, width, height);
            
            ctx.fillStyle = '#111827';
            ctx.fillRect(0, 0, width, height);
            
            const rmsWidth = width * Math.min(1, Math.pow(rms * 4, 0.6));
            
            const gradient = ctx.createLinearGradient(0, 0, width, 0);
            gradient.addColorStop(0, '#10b981'); 
            gradient.addColorStop(0.6, '#f59e0b'); 
            gradient.addColorStop(0.85, '#ef4444'); 
            
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, rmsWidth, height);
            
            const peakPos = width * Math.min(1, Math.pow(localPeak * 4, 0.6));
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(peakPos, 0, 2, height);
            
            if (localPeak >= 0.98) {
                ctx.fillStyle = '#ef4444';
                ctx.fillRect(width - 4, 0, 4, height);
            }

            animationId = requestAnimationFrame(draw);
        };
        draw();
    }
    return () => cancelAnimationFrame(animationId);
  }, [track.id, isArmed]);

  const height = track.showAutomation ? TRACK_HEIGHT + AUTOMATION_HEIGHT : TRACK_HEIGHT;

  return (
    <div 
        className={`flex flex-col p-2 border-b box-border ${isMaster ? 'bg-[#2d2d2d] border-t border-[#111]' : 'bg-[#2d2d2d] border-[#111]'} relative group select-none transition-none`}
        style={{ height: `${height}px` }}
        onDoubleClick={() => onOpenEditor(track.id)}
        title={isMaster ? "Master Track" : "Double-click to open Track Editor"}
    >
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2">
            {!isMaster && (
                <div className="relative w-2.5 h-2.5">
                    <input 
                        type="color" 
                        value={track.color} 
                        onChange={(e) => onUpdate(track.id, { color: e.target.value })}
                        className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                        title="Change Track Color"
                    />
                    <div className="w-full h-full rounded-full pointer-events-none" style={{ backgroundColor: track.color }} />
                </div>
            )}
            {isMaster && <Activity size={12} className="text-[#d4d4d4]" />}
            <input
                type="text"
                value={track.name}
                onChange={(e) => onUpdate(track.id, { name: e.target.value })}
                onClick={(e) => e.stopPropagation()}
                onDoubleClick={(e) => e.stopPropagation()}
                className={`font-medium text-xs truncate w-24 bg-transparent outline-none focus:bg-[#111] focus:px-1 rounded-sm ${isMaster ? 'text-[#d4d4d4]' : 'text-[#d4d4d4]'}`}
                title={track.name}
                readOnly={isMaster}
            />
            {hasClipped && (
                <button 
                    onClick={(e) => { e.stopPropagation(); setHasClipped(false); }}
                    className="flex items-center gap-1 px-1.5 py-0.5 bg-[#ef4444] text-black rounded-none animate-pulse"
                    title="Track is clipping! Click to clear warning."
                >
                    <AlertTriangle size={10} fill="currentColor" />
                    <span className="text-[8px] font-black uppercase">CLIP</span>
                </button>
            )}
        </div>
        {!isMaster && (
            <button 
                onClick={(e) => { e.stopPropagation(); onDelete(track.id); }}
                className="text-[10px] text-[#999] hover:text-[#ef4444] opacity-0 group-hover:opacity-100 transition-none"
                title="Delete Track"
            >
                Delete
            </button>
        )}
      </div>

      <div className="flex items-center gap-1 mb-1.5">
        {!isMaster && (
            <>
                {/* Arm Button */}
                <button
                onClick={(e) => { e.stopPropagation(); onArmToggle(); }}
                className={`p-1 rounded-none transition-none ${
                    isArmed 
                        ? (isRecordingGlobal ? 'bg-[#ef4444] text-white' : 'bg-[#ef4444]/30 text-[#ef4444] border border-[#ef4444]') 
                        : 'bg-[#444] text-[#999] hover:text-[#d4d4d4] hover:bg-[#555]'
                }`}
                title={isArmed ? "Disarm Track (Recording Input)" : "Arm Track for Recording"}
                >
                    <div className={`w-2.5 h-2.5 rounded-full ${isArmed ? 'bg-current' : 'bg-current'}`} />
                </button>

                <button
                onClick={(e) => { e.stopPropagation(); onUpdate(track.id, { muted: !track.muted }); }}
                className={`p-1 rounded-none ${track.muted ? 'bg-[#ff7b00] text-black' : 'bg-[#444] text-[#999] hover:text-[#d4d4d4] hover:bg-[#555]'}`}
                title={track.muted ? "Unmute Track" : "Mute Track"}
                >
                {track.muted ? <VolumeX size={12} /> : <Volume2 size={12} />}
                </button>
                <button
                onClick={(e) => { e.stopPropagation(); onUpdate(track.id, { soloed: !track.soloed }); }}
                className={`p-1 rounded-none ${track.soloed ? 'bg-[#3b82f6] text-black' : 'bg-[#444] text-[#999] hover:text-[#d4d4d4] hover:bg-[#555]'}`}
                title={track.soloed ? "Unsolo Track" : "Solo Track"}
                >
                <Headphones size={12} />
                </button>
                <button
                onClick={(e) => { e.stopPropagation(); onToggleAutomation(track.id); }}
                className={`p-1 rounded-none ${track.showAutomation ? 'bg-[#ef4444] text-black' : 'bg-[#444] text-[#999] hover:text-[#d4d4d4] hover:bg-[#555]'}`}
                title="Toggle Automation Lanes"
                >
                <TrendingUp size={12} />
                </button>
            </>
        )}
        
        {isMaster && (
             <>
                <button
                    onClick={(e) => { e.stopPropagation(); onOpenVisualizerSettings?.(); }}
                    className="p-1 bg-[#444] text-[#999] hover:text-[#d4d4d4] hover:bg-[#555] rounded-none transition-none"
                    title="Visualizer Settings"
                >
                    <Eye size={12} />
                </button>
                <div className="flex items-center ml-1">
                    <span className="text-[9px] text-[#999] uppercase font-bold mr-1">Vol</span>
                    <input 
                        type="number" 
                        value={track.volume <= 0 ? -60 : Math.max(-60, 20 * Math.log10(track.volume)).toFixed(1)} 
                        onChange={(e) => {
                            const db = parseFloat(e.target.value);
                            const linear = db <= -60 ? 0 : Math.pow(10, db / 20);
                            onUpdate(track.id, { volume: linear });
                        }}
                        className="w-8 bg-transparent text-right text-[9px] text-[#999] outline-none focus:text-[#ff7b00] hide-arrows"
                    />
                    <span className="text-[9px] text-[#999] ml-0.5">dB</span>
                </div>
             </>
        )}
        {!isMaster && (
            <div className="flex items-center ml-1">
                <input 
                    type="number" 
                    value={track.volume <= 0 ? -60 : Math.max(-60, 20 * Math.log10(track.volume)).toFixed(1)} 
                    onChange={(e) => {
                        const db = parseFloat(e.target.value);
                        const linear = db <= -60 ? 0 : Math.pow(10, db / 20);
                        onUpdate(track.id, { volume: linear });
                    }}
                    className="w-8 bg-transparent text-right text-[9px] text-[#999] outline-none focus:text-[#ff7b00] hide-arrows"
                />
                <span className="text-[9px] text-[#999] ml-0.5">dB</span>
            </div>
        )}

        <div className="flex-1 ml-1" onClick={e => e.stopPropagation()}>
            <input
                type="range"
                min="-60"
                max="24"
                step="0.1"
                value={track.volume <= 0 ? -60 : Math.max(-60, 20 * Math.log10(track.volume))}
                onChange={(e) => {
                    const db = parseFloat(e.target.value);
                    const linear = db <= -60 ? 0 : Math.pow(10, db / 20);
                    onUpdate(track.id, { volume: linear });
                }}
                onDoubleClick={() => onUpdate(track.id, { volume: 1.0 })}
                className={`w-full h-1.5 rounded-none appearance-none cursor-pointer ${isMaster ? 'accent-[#ff7b00] bg-[#111]' : 'accent-[#ff7b00] bg-[#111]'}`}
                disabled={track.showAutomation && track.selectedAutomationId === 'volume'}
                title={`Volume: ${track.volume <= 0 ? '-inf' : Math.max(-60, 20 * Math.log10(track.volume)).toFixed(1)} dB (Double-click to reset)`}
            />
        </div>
      </div>
      
      <div className="h-1.5 w-full bg-[#111] rounded-none overflow-hidden mt-0.5 relative border border-[#111]" title="Audio Level Meter">
          <canvas ref={canvasRef} width={200} height={8} className="w-full h-full block" />
          <div className="absolute inset-0 flex justify-between px-2 pointer-events-none opacity-50">
               <div className="w-px h-full bg-black/50" style={{ left: '50%' }}></div>
               <div className="w-px h-full bg-black/50" style={{ left: '75%' }}></div>
          </div>
      </div>
      
      {isMaster && (
          <div className="flex justify-between text-[8px] text-[#777] font-mono mt-0.5 px-1">
              <span>-inf</span>
              <span>-12</span>
              <span>-6</span>
              <span>0dB</span>
          </div>
      )}

      {/* Improved Automation Header with Dropdown */}
      {track.showAutomation && (
           <div 
             className="absolute bottom-0 left-0 right-0 bg-[#2d2d2d] border-t border-[#111] p-1.5 flex flex-col gap-1"
             style={{ height: `${AUTOMATION_HEIGHT}px` }}
           >
               <div className="flex items-center justify-between">
                   <div className="flex items-center gap-1 text-[#ef4444] text-[9px] font-bold uppercase">
                       <TrendingUp size={10} /> Auto:
                   </div>
                   {/* Automation Type Selector */}
                   <div className="relative" title="Select Parameter to Automate">
                       <select 
                        className="bg-[#111] text-[9px] text-[#d4d4d4] border border-[#111] rounded-none px-1 py-0.5 outline-none focus:border-[#ff7b00] w-28 appearance-none"
                        value={track.selectedAutomationId || 'volume'}
                        onChange={(e) => onUpdate(track.id, { selectedAutomationId: e.target.value })}
                        onClick={(e) => e.stopPropagation()}
                       >
                           <option value="volume">Volume</option>
                           <option value="pan">Pan</option>
                           {/* Dynamic Plugin Params */}
                           {track.plugins.map(p => {
                               if (p.type === 'REVERB') return (
                                   <React.Fragment key={p.id}>
                                        <option value={`${p.id}:mix`}>Reverb Mix</option>
                                        <option value={`${p.id}:decay`}>Reverb Decay</option>
                                   </React.Fragment>
                               );
                               if (p.type === 'DELAY') return <option key={p.id} value={`${p.id}:time`}>Delay Time</option>;
                               if (p.type === 'DISTORTION') return <option key={p.id} value={`${p.id}:drive`}>Distortion</option>;
                               if (p.type === 'FILTER') return <option key={p.id} value={`${p.id}:frequency`}>Filter Freq</option>;
                               return null;
                           })}
                       </select>
                       <ChevronDown size={10} className="absolute right-1 top-1 text-[#777] pointer-events-none" />
                   </div>
               </div>
               <span className="text-[8px] text-[#777] text-right">Click timeline to add points</span>
           </div>
      )}

    </div>
  );
};
