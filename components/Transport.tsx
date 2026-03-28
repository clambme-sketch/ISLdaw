
import React, { useState, useEffect, useRef } from 'react';
import { Play, Square, FastForward, Rewind, Activity, Scissors, MousePointer2, ZoomIn, ZoomOut, Grid, Undo, Redo, Download, Circle, Repeat, Timer, Settings, Check, Clock, Music4, Lock } from 'lucide-react';
import { LoopRegion, ToolType } from '../types';

interface TransportProps {
  isPlaying: boolean;
  onPlay: () => void;
  onStop: () => void;
  onRewind: () => void;
  onFastForward: () => void;
  
  isRecording: boolean;
  onRecord: () => void;

  currentTime: number;
  bpm: number;
  setBpm: (bpm: number) => void;
  
  tool: ToolType;
  setTool: (t: ToolType) => void;
  zoom: number;
  setZoom: (z: number) => void;
  snap: boolean;
  setSnap: (s: boolean) => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onExport: () => void;
  isExporting: boolean;
  
  loopRegion: LoopRegion;
  setLoopRegion: (region: LoopRegion) => void;
  
  isMetronomeOn: boolean;
  toggleMetronome: () => void;
  countInMeasures: number;
  setCountInMeasures: (n: number) => void;
  
  onOpenSettings: () => void;

  followPlayhead: boolean;
  setFollowPlayhead: (follow: boolean) => void;
  timeDisplayFormat: 'TIME' | 'BARS';
  setTimeDisplayFormat: (fmt: 'TIME' | 'BARS') => void;
}

const formatTime = (seconds: number) => {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  const tenths = Math.floor((seconds % 1) * 10);
  return `${m}:${s.toString().padStart(2, '0')}.${tenths}`;
};

const formatBars = (seconds: number, bpm: number) => {
    const beatsPerSecond = bpm / 60;
    const totalBeats = seconds * beatsPerSecond;
    
    // Assuming 4/4 signature for simplicity
    const bar = Math.floor(totalBeats / 4) + 1;
    const beat = Math.floor(totalBeats % 4) + 1;
    
    return `${bar} : ${beat}`;
};

export const Transport: React.FC<TransportProps> = ({ 
    isPlaying, 
    onPlay, 
    onStop, 
    onRewind, 
    onFastForward,
    isRecording,
    onRecord,
    currentTime, 
    bpm, 
    setBpm,
    tool,
    setTool,
    zoom,
    setZoom,
    snap,
    setSnap,
    onUndo,
    onRedo,
    canUndo,
    canRedo,
    onExport,
    isExporting,
    loopRegion,
    setLoopRegion,
    isMetronomeOn,
    toggleMetronome,
    countInMeasures,
    setCountInMeasures,
    onOpenSettings,
    followPlayhead,
    setFollowPlayhead,
    timeDisplayFormat,
    setTimeDisplayFormat
}) => {
  const [showCountInMenu, setShowCountInMenu] = useState(false);
  const [showTimerMenu, setShowTimerMenu] = useState(false);
  const [menuPos, setMenuPos] = useState({ x: 0, y: 0 });
  
  // Tap Tempo State
  const tapTimesRef = useRef<number[]>([]);

  useEffect(() => {
      const closeMenu = () => {
          setShowCountInMenu(false);
          setShowTimerMenu(false);
      };
      if (showCountInMenu || showTimerMenu) window.addEventListener('click', closeMenu);
      return () => window.removeEventListener('click', closeMenu);
  }, [showCountInMenu, showTimerMenu]);

  const handleMetronomeClick = (e: React.MouseEvent) => {
      toggleMetronome();

      // Tap Tempo Logic
      const now = Date.now();
      const times = tapTimesRef.current;
      
      // Filter clicks older than 2 seconds
      const recentTimes = times.filter(t => now - t < 2000);
      recentTimes.push(now);
      tapTimesRef.current = recentTimes;
      
      if (recentTimes.length >= 4) {
          // Calculate BPM
          let sumIntervals = 0;
          for(let i=1; i<recentTimes.length; i++) {
              sumIntervals += (recentTimes[i] - recentTimes[i-1]);
          }
          const avgInterval = sumIntervals / (recentTimes.length - 1);
          const newBpm = Math.round(60000 / avgInterval);
          
          if (newBpm >= 30 && newBpm <= 300) {
              setBpm(newBpm);
          }
      }
  };

  const handleTimerContextMenu = (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setMenuPos({ x: e.clientX, y: e.clientY });
      setShowTimerMenu(true);
  };

  return (
    <div className="h-14 bg-[#2d2d2d] border-b border-[#111] flex items-center z-30 shadow-none select-none overflow-x-auto custom-scrollbar-hidden">
      <div className="flex items-center justify-between px-4 min-w-max w-full gap-4">
          <div className="flex items-center gap-4">
            <div className="text-xl font-bold text-[#d4d4d4] mr-2 flex-shrink-0 tracking-tight" title="ISL Digital Audio Workstation">
                ISLdaw
            </div>

            {/* File Actions */}
            <div className="flex items-center bg-[#1e1e1e] rounded-md border border-[#333] overflow-hidden flex-shrink-0">
                <button 
                    onClick={onUndo} disabled={!canUndo}
                    className="p-1.5 text-[#999] hover:text-[#d4d4d4] disabled:opacity-30 hover:bg-[#333]" 
                    title="Undo (Ctrl+Z)"
                >
                    <Undo size={14} />
                </button>
                <button 
                    onClick={onRedo} disabled={!canRedo}
                    className="p-1.5 text-[#999] hover:text-[#d4d4d4] disabled:opacity-30 hover:bg-[#333]" 
                    title="Redo (Ctrl+Y)"
                >
                    <Redo size={14} />
                </button>
            </div>

            {/* Tools */}
            <div className="flex items-center bg-[#1e1e1e] rounded-md border border-[#333] overflow-hidden flex-shrink-0">
                <button 
                    onClick={() => setTool('MOVE')}
                    className={`p-1.5 transition-none ${tool === 'MOVE' ? 'bg-[#ff7b00] text-black' : 'text-[#999] hover:text-[#d4d4d4] hover:bg-[#333]'}`}
                    title="Move Tool (Select, Move, Resize Clips)"
                >
                    <MousePointer2 size={14} />
                </button>
                <button 
                    onClick={() => setTool('BLADE')}
                    className={`p-1.5 transition-none ${tool === 'BLADE' ? 'bg-[#ff7b00] text-black' : 'text-[#999] hover:text-[#d4d4d4] hover:bg-[#333]'}`}
                    title="Blade Tool (Split Clips)"
                >
                    <Scissors size={14} />
                </button>
            </div>

            <div className="w-px h-6 bg-[#333] mx-1 flex-shrink-0"></div>

            {/* Transport */}
            <div className="flex items-center bg-[#1e1e1e] rounded-md border border-[#333] overflow-hidden flex-shrink-0">
                <button 
                    onClick={() => setLoopRegion({ ...loopRegion, enabled: !loopRegion.enabled })}
                    className={`p-1.5 transition-none ${loopRegion.enabled ? 'text-black bg-[#ff7b00]' : 'text-[#999] hover:text-[#d4d4d4] hover:bg-[#333]'}`}
                    title="Toggle Loop Mode"
                >
                    <Repeat size={16} />
                </button>
                <div className="w-px h-4 bg-[#333] mx-0"></div>
                <button 
                    onClick={onRewind}
                    className="p-1.5 text-[#999] hover:text-[#d4d4d4] hover:bg-[#333] transition-none"
                    title="Rewind 5s"
                >
                    <Rewind size={16} />
                </button>
                <button 
                    onClick={isPlaying ? onStop : onPlay}
                    className={`p-1.5 transition-none ${isPlaying ? 'text-black bg-[#22c55e]' : 'text-[#999] hover:bg-[#333] hover:text-[#d4d4d4]'}`}
                    title={isPlaying ? "Stop (Space)" : "Play (Space)"}
                >
                    {isPlaying ? <Square size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />}
                </button>
                <button 
                    onClick={onRecord}
                    className={`p-1.5 transition-none ${isRecording ? 'text-white bg-[#ef4444]' : 'text-[#999] hover:text-[#ef4444] hover:bg-[#333]'}`}
                    title="Global Record (Requires Armed Track)"
                >
                    <div className={`w-3 h-3 rounded-full ${isRecording ? 'bg-white' : 'bg-current'}`} />
                </button>
                <button 
                    onClick={onFastForward}
                    className="p-1.5 text-[#999] hover:text-[#d4d4d4] hover:bg-[#333] transition-none"
                    title="Fast Forward 5s"
                >
                    <FastForward size={16} />
                </button>
            </div>

            {/* Time Display */}
            <div 
                onContextMenu={handleTimerContextMenu}
                className="bg-[#0a0a0a] px-4 py-1.5 rounded-lg text-[#ff7b00] text-xl min-w-[110px] text-center border-2 border-[#333] shadow-inner flex-shrink-0 cursor-context-menu hover:border-[#555] transition-colors relative flex items-center justify-center font-mono" 
                style={{ 
                    fontVariantNumeric: 'tabular-nums',
                    letterSpacing: '0.05em',
                    fontWeight: 600,
                    textShadow: '0 0 5px #ff7b0066'
                }}
                title="Current Position (Right-click for options)"
            >
                {timeDisplayFormat === 'TIME' ? formatTime(currentTime) : formatBars(currentTime, bpm)}
                
                {/* Tiny indicator for Follow mode */}
                {followPlayhead && (
                    <div className="absolute top-1 right-1">
                        <Lock size={10} className="text-yellow-500/50" />
                    </div>
                )}
            </div>
          </div>

          <div className="flex items-center gap-4">
            
            {/* BPM & Metronome */}
            <div className="flex items-center bg-[#1e1e1e] rounded-md border border-[#333] overflow-hidden group focus-within:border-[#555] flex-shrink-0" title="Tempo (Beats Per Minute)">
                <div className="relative">
                    <button 
                        onClick={handleMetronomeClick}
                        onContextMenu={(e) => { e.preventDefault(); setShowCountInMenu(true); }}
                        className={`p-1.5 transition-none ${isMetronomeOn ? 'text-black bg-[#ff7b00]' : 'text-[#999] hover:text-[#d4d4d4] hover:bg-[#333]'}`}
                        title="Metronome (Click repeatedly to Tap Tempo, Right Click for Settings)"
                    >
                        <Timer size={14} className={isMetronomeOn ? "" : ""} />
                    </button>
                    {showCountInMenu && (
                        <div className="absolute top-full left-0 mt-1 bg-[#2d2d2d] border border-[#111] rounded-none shadow-none z-50 w-32 py-1 text-xs">
                            <div className="px-2 py-1 text-[#999] font-bold uppercase border-b border-[#111] mb-1">Count In</div>
                            {[0, 1, 2, 4].map(measures => (
                                <button
                                    key={measures}
                                    onClick={() => setCountInMeasures(measures)}
                                    className={`w-full text-left px-2 py-1 hover:bg-[#444] ${countInMeasures === measures ? 'text-[#ff7b00] font-bold' : 'text-[#d4d4d4]'}`}
                                >
                                    {measures === 0 ? 'None' : `${measures} Bar${measures > 1 ? 's' : ''}`}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
                
                <div className="flex flex-col items-start px-2 py-1 justify-center">
                    <span className="text-[8px] text-[#999] font-bold leading-none uppercase">BPM</span>
                    <input 
                        type="number" 
                        value={bpm}
                        onChange={(e) => setBpm(Math.max(1, Math.min(999, Number(e.target.value))))}
                        className="w-10 bg-transparent text-xs font-mono text-[#d4d4d4] outline-none p-0 leading-none"
                        title="Tempo"
                    />
                </div>
            </div>
            
            {/* Zoom & Snap */}
            <div className="flex items-center bg-[#1e1e1e] rounded-md border border-[#333] overflow-hidden flex-shrink-0">
                <button onClick={() => setSnap(!snap)} className={`p-1.5 ${snap ? 'text-black bg-[#ff7b00]' : 'text-[#999] hover:text-[#d4d4d4] hover:bg-[#333]'}`} title="Snap to Grid (Quantize)">
                    <Grid size={14} />
                </button>
                <div className="w-px h-4 bg-[#333] mx-0"></div>
                
                <div className="flex items-center px-2 py-1 gap-2">
                    <button 
                        onClick={() => setZoom(Math.max(10, zoom - 10))}
                        className="text-[#999] hover:text-[#d4d4d4] transition-none p-0.5"
                        title="Zoom Out"
                    >
                        <ZoomOut size={12} />
                    </button>

                    <input 
                        type="range" min="10" max="500" step="10"
                        value={zoom}
                        onChange={(e) => setZoom(Number(e.target.value))}
                        className="w-20 h-1 bg-[#333] rounded-full appearance-none cursor-pointer accent-[#ff7b00]"
                        title="Horizontal Zoom"
                    />
                    
                    <button 
                        onClick={() => setZoom(Math.min(500, zoom + 10))}
                        className="text-[#999] hover:text-[#d4d4d4] transition-none p-0.5"
                        title="Zoom In"
                    >
                        <ZoomIn size={12} />
                    </button>
                </div>
            </div>

            <button 
                onClick={onExport}
                disabled={isExporting}
                className="flex items-center gap-1.5 bg-[#444] hover:bg-[#555] text-[#d4d4d4] px-3 py-1.5 rounded-none text-xs font-medium transition-none disabled:opacity-50 flex-shrink-0 border border-[#111]"
                title="Export project to WAV file"
            >
                <Download size={14} />
                {isExporting ? 'Saving...' : 'Save'}
            </button>
            
            <button 
                onClick={onOpenSettings}
                className="p-1.5 ml-2 text-[#999] hover:text-[#d4d4d4] rounded-none hover:bg-[#444] transition-none flex-shrink-0"
                title="Settings (Audio I/O, Calibration, Export Stems)"
            >
                <Settings size={16} />
            </button>
          </div>
      </div>

      {/* Timer Context Menu (Fixed Position) */}
      {showTimerMenu && (
        <div 
            className="fixed z-[100] bg-[#2d2d2d] border border-[#111] rounded-none shadow-none w-48 py-1 text-xs text-[#d4d4d4]"
            style={{ top: menuPos.y + 10, left: menuPos.x - 20 }}
        >
            <div className="px-3 py-1 text-[10px] font-bold text-[#999] uppercase border-b border-[#111] mb-1">Display Options</div>
            
            <button 
                onClick={() => setTimeDisplayFormat('TIME')}
                className="w-full text-left px-3 py-1.5 hover:bg-[#444] flex items-center justify-between"
            >
                <span className="flex items-center gap-2"><Clock size={12} /> Time (mm:ss)</span>
                {timeDisplayFormat === 'TIME' && <Check size={12} className="text-[#ff7b00]" />}
            </button>
            
            <button 
                onClick={() => setTimeDisplayFormat('BARS')}
                className="w-full text-left px-3 py-1.5 hover:bg-[#444] flex items-center justify-between"
            >
                <span className="flex items-center gap-2"><Music4 size={12} /> Measures (Bars)</span>
                {timeDisplayFormat === 'BARS' && <Check size={12} className="text-[#ff7b00]" />}
            </button>
            
            <div className="h-px bg-[#111] my-1"></div>
            
            <button 
                onClick={() => setFollowPlayhead(!followPlayhead)}
                className="w-full text-left px-3 py-1.5 hover:bg-[#444] flex items-center justify-between"
            >
                <span className="flex items-center gap-2"><Lock size={12} /> Follow Playhead</span>
                {followPlayhead && <Check size={12} className="text-[#ff7b00]" />}
            </button>
        </div>
      )}
    </div>
  );
};
