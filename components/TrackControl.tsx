
import React, { useEffect, useRef, useState } from 'react';
import { Track } from '../types';
import { Volume2, VolumeX, Mic, Headphones, Activity, TrendingUp, ChevronDown, Eye } from 'lucide-react';
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
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [peak, setPeak] = useState(0);

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
            
            setPeak(localPeak);

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
        className={`flex flex-col p-3 border-b box-border ${isMaster ? 'bg-gray-900 border-t border-blue-500/30' : 'bg-gray-800 border-gray-700'} relative group select-none transition-all`}
        style={{ height: `${height}px` }}
        onDoubleClick={() => onOpenEditor(track.id)}
        title={isMaster ? "Master Track" : "Double-click to open Track Editor"}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
            {!isMaster && <div className="w-3 h-3 rounded-full" style={{ backgroundColor: track.color }} />}
            {isMaster && <Activity size={14} className="text-blue-400" />}
            <span className={`font-semibold text-sm truncate w-24 ${isMaster ? 'text-blue-400' : 'text-gray-200'}`} title={track.name}>
            {track.name}
            </span>
        </div>
        {!isMaster && (
            <button 
                onClick={(e) => { e.stopPropagation(); onDelete(track.id); }}
                className="text-xs text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                title="Delete Track"
            >
                Delete
            </button>
        )}
      </div>

      <div className="flex items-center gap-2 mb-2">
        {!isMaster && (
            <>
                {/* Arm Button */}
                <button
                onClick={(e) => { e.stopPropagation(); onArmToggle(); }}
                className={`p-1.5 rounded-full transition-all ${
                    isArmed 
                        ? (isRecordingGlobal ? 'bg-red-600 text-white animate-pulse' : 'bg-red-900/50 text-red-500 border border-red-500') 
                        : 'bg-gray-700 text-gray-400 hover:text-white hover:bg-gray-600'
                }`}
                title={isArmed ? "Disarm Track (Recording Input)" : "Arm Track for Recording"}
                >
                    <div className={`w-3 h-3 rounded-full ${isArmed ? 'bg-current' : 'bg-current'}`} />
                </button>

                <button
                onClick={(e) => { e.stopPropagation(); onUpdate(track.id, { muted: !track.muted }); }}
                className={`p-1 rounded ${track.muted ? 'bg-red-500/20 text-red-500' : 'bg-gray-700 text-gray-400 hover:text-gray-200'}`}
                title={track.muted ? "Unmute Track" : "Mute Track"}
                >
                {track.muted ? <VolumeX size={14} /> : <Volume2 size={14} />}
                </button>
                <button
                onClick={(e) => { e.stopPropagation(); onUpdate(track.id, { soloed: !track.soloed }); }}
                className={`p-1 rounded ${track.soloed ? 'bg-yellow-500/20 text-yellow-500' : 'bg-gray-700 text-gray-400 hover:text-gray-200'}`}
                title={track.soloed ? "Unsolo Track" : "Solo Track"}
                >
                <Headphones size={14} />
                </button>
                <button
                onClick={(e) => { e.stopPropagation(); onToggleAutomation(track.id); }}
                className={`p-1 rounded ${track.showAutomation ? 'bg-blue-500/20 text-blue-400' : 'bg-gray-700 text-gray-400 hover:text-gray-200'}`}
                title="Toggle Automation Lanes"
                >
                <TrendingUp size={14} />
                </button>
            </>
        )}
        
        {isMaster && (
             <>
                <button
                    onClick={(e) => { e.stopPropagation(); onOpenVisualizerSettings?.(); }}
                    className="p-1.5 bg-gray-700 text-gray-400 hover:text-blue-400 hover:bg-gray-600 rounded transition-colors"
                    title="Visualizer Settings"
                >
                    <Eye size={14} />
                </button>
                <span className="text-[10px] text-gray-500 uppercase font-bold">Vol</span>
             </>
        )}

        <div className="flex-1" onClick={e => e.stopPropagation()}>
            <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={track.volume}
                onChange={(e) => onUpdate(track.id, { volume: parseFloat(e.target.value) })}
                className={`w-full h-1 rounded-lg appearance-none cursor-pointer ${isMaster ? 'accent-blue-400 bg-gray-700' : 'accent-blue-500 bg-gray-600'}`}
                disabled={track.showAutomation && track.selectedAutomationId === 'volume'}
                title={`Volume: ${(track.volume * 100).toFixed(0)}%`}
            />
        </div>
      </div>
      
      <div className="h-2 w-full bg-gray-900 rounded overflow-hidden mt-1 relative border border-gray-800" title="Audio Level Meter">
          <canvas ref={canvasRef} width={200} height={8} className="w-full h-full block" />
          <div className="absolute inset-0 flex justify-between px-2 pointer-events-none opacity-50">
               <div className="w-px h-full bg-black/50" style={{ left: '50%' }}></div>
               <div className="w-px h-full bg-black/50" style={{ left: '75%' }}></div>
          </div>
      </div>
      
      {isMaster && (
          <div className="flex justify-between text-[9px] text-gray-500 font-mono mt-0.5 px-1">
              <span>-inf</span>
              <span>-12</span>
              <span>-6</span>
              <span>0dB</span>
          </div>
      )}

      {/* Improved Automation Header with Dropdown */}
      {track.showAutomation && (
           <div 
             className="absolute bottom-0 left-0 right-0 bg-gray-850 border-t border-gray-700 p-2 flex flex-col gap-1 animate-fade-in"
             style={{ height: `${AUTOMATION_HEIGHT}px` }}
           >
               <div className="flex items-center justify-between">
                   <div className="flex items-center gap-1 text-blue-400 text-[10px] font-bold uppercase">
                       <TrendingUp size={10} /> Auto:
                   </div>
                   {/* Automation Type Selector */}
                   <div className="relative" title="Select Parameter to Automate">
                       <select 
                        className="bg-gray-900 text-[10px] text-gray-300 border border-gray-700 rounded px-1 py-0.5 outline-none focus:border-blue-500 w-32 appearance-none"
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
                               if (p.type === 'HIGHPASS' || p.type === 'LOWPASS') return <option key={p.id} value={`${p.id}:frequency`}>{p.type} Freq</option>;
                               return null;
                           })}
                       </select>
                       <ChevronDown size={10} className="absolute right-1 top-1.5 text-gray-500 pointer-events-none" />
                   </div>
               </div>
               <span className="text-[9px] text-gray-500 text-right">Click timeline to add points</span>
           </div>
      )}

    </div>
  );
};
