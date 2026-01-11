
import React, { useState, useEffect } from 'react';
import { Play, Square, FastForward, Rewind, Activity, Scissors, MousePointer2, ZoomIn, ZoomOut, Grid, Undo, Redo, Download, Circle, Repeat, Timer } from 'lucide-react';
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
    setCountInMeasures
}) => {
  const [showCountInMenu, setShowCountInMenu] = useState(false);

  useEffect(() => {
      const closeMenu = () => setShowCountInMenu(false);
      if (showCountInMenu) window.addEventListener('click', closeMenu);
      return () => window.removeEventListener('click', closeMenu);
  }, [showCountInMenu]);

  return (
    <div className="h-16 bg-gray-900 border-b border-gray-700 flex items-center px-4 justify-between z-30 shadow-lg select-none">
      <div className="flex items-center gap-4">
        <div className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-500 mr-2" title="ISL Digital Audio Workstation">
            ISLdaw
        </div>

        {/* File Actions */}
        <div className="flex items-center gap-1 bg-gray-800 rounded-lg p-1 border border-gray-700">
             <button 
                onClick={onUndo} disabled={!canUndo}
                className="p-1.5 text-gray-400 hover:text-white disabled:opacity-30 rounded hover:bg-gray-700" 
                title="Undo (Ctrl+Z)"
             >
                <Undo size={16} />
             </button>
             <button 
                onClick={onRedo} disabled={!canRedo}
                className="p-1.5 text-gray-400 hover:text-white disabled:opacity-30 rounded hover:bg-gray-700" 
                title="Redo (Ctrl+Y)"
             >
                <Redo size={16} />
             </button>
        </div>

        {/* Tools */}
        <div className="flex items-center gap-1 bg-gray-800 rounded-lg p-1 border border-gray-700">
             <button 
                onClick={() => setTool('MOVE')}
                className={`p-1.5 rounded transition-all ${tool === 'MOVE' ? 'bg-blue-500 text-white shadow-sm' : 'text-gray-400 hover:text-white hover:bg-gray-700'}`}
                title="Move Tool (Select, Move, Resize Clips)"
             >
                <MousePointer2 size={16} />
             </button>
             <button 
                onClick={() => setTool('BLADE')}
                className={`p-1.5 rounded transition-all ${tool === 'BLADE' ? 'bg-blue-500 text-white shadow-sm' : 'text-gray-400 hover:text-white hover:bg-gray-700'}`}
                title="Blade Tool (Split Clips)"
             >
                <Scissors size={16} />
             </button>
        </div>

        <div className="w-px h-8 bg-gray-700 mx-1"></div>

        {/* Transport */}
        <div className="flex bg-gray-800 rounded-lg p-1 gap-1 border border-gray-700">
            <button 
                onClick={() => setLoopRegion({ ...loopRegion, enabled: !loopRegion.enabled })}
                className={`p-2 rounded transition-all active:scale-95 ${loopRegion.enabled ? 'text-yellow-400 bg-yellow-400/10' : 'text-gray-400 hover:text-white hover:bg-gray-700'}`}
                title="Toggle Loop Mode"
            >
                <Repeat size={18} />
            </button>
            <div className="w-px h-full bg-gray-700 mx-1"></div>
            <button 
                onClick={onRewind}
                className="p-2 text-gray-400 hover:text-white rounded hover:bg-gray-700 active:scale-95 transition-transform"
                title="Rewind 5s"
            >
                <Rewind size={18} />
            </button>
            <button 
                onClick={isPlaying ? onStop : onPlay}
                className={`p-2 rounded transition-all active:scale-95 ${isPlaying ? 'text-yellow-400 bg-yellow-400/10' : 'text-green-400 hover:bg-green-400/10 hover:text-green-300'}`}
                title={isPlaying ? "Stop (Space)" : "Play (Space)"}
            >
                {isPlaying ? <Square size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}
            </button>
            <button 
                onClick={onRecord}
                className={`p-2 rounded transition-all active:scale-95 ${isRecording ? 'text-red-500 bg-red-500/20 shadow-[0_0_10px_rgba(239,68,68,0.5)]' : 'text-gray-400 hover:text-red-400 hover:bg-gray-700'}`}
                title="Global Record (Requires Armed Track)"
            >
                <div className={`w-4 h-4 rounded-full ${isRecording ? 'bg-red-500 animate-pulse' : 'bg-current'}`} />
            </button>
             <button 
                onClick={onFastForward}
                className="p-2 text-gray-400 hover:text-white rounded hover:bg-gray-700 active:scale-95 transition-transform"
                title="Fast Forward 5s"
            >
                <FastForward size={18} />
            </button>
        </div>

        {/* Time Display */}
        <div className="bg-black/40 px-3 py-1.5 rounded text-blue-400 font-mono text-lg min-w-[100px] text-center border border-blue-500/20 shadow-inner" title="Current Playhead Position">
            {formatTime(currentTime)}
        </div>
      </div>

      <div className="flex items-center gap-4">
        
        {/* BPM & Metronome */}
        <div className="flex items-center gap-2 bg-gray-800 rounded-lg p-1.5 border border-gray-700 group focus-within:border-blue-500/50" title="Tempo (Beats Per Minute)">
            <div className="relative">
                <button 
                    onClick={toggleMetronome}
                    onContextMenu={(e) => { e.preventDefault(); setShowCountInMenu(true); }}
                    className={`p-1 rounded transition-colors ${isMetronomeOn ? 'text-blue-400 bg-blue-500/10 shadow-[0_0_8px_rgba(59,130,246,0.5)]' : 'text-gray-500 hover:text-gray-300'}`}
                    title="Metronome (Click to Toggle, Right Click for Settings)"
                >
                    <Timer size={16} className={isMetronomeOn ? "animate-pulse" : ""} />
                </button>
                {showCountInMenu && (
                    <div className="absolute top-full left-0 mt-2 bg-gray-800 border border-gray-600 rounded-lg shadow-xl z-50 w-32 py-1 text-xs">
                         <div className="px-2 py-1 text-gray-500 font-bold uppercase border-b border-gray-700 mb-1">Count In</div>
                         {[0, 1, 2, 4].map(measures => (
                             <button
                                key={measures}
                                onClick={() => setCountInMeasures(measures)}
                                className={`w-full text-left px-2 py-1.5 hover:bg-gray-700 ${countInMeasures === measures ? 'text-blue-400 font-bold' : 'text-gray-300'}`}
                             >
                                {measures === 0 ? 'None' : `${measures} Bar${measures > 1 ? 's' : ''}`}
                             </button>
                         ))}
                    </div>
                )}
            </div>
            
            <div className="flex flex-col items-start mr-1">
                <span className="text-[9px] text-gray-500 font-bold leading-none uppercase">BPM</span>
                <input 
                    type="number" 
                    value={bpm}
                    onChange={(e) => setBpm(Math.max(1, Math.min(999, Number(e.target.value))))}
                    className="w-12 bg-transparent text-sm font-mono text-blue-400 outline-none p-0 leading-none"
                />
            </div>
        </div>
        
        {/* Zoom & Snap */}
        <div className="flex items-center gap-2 bg-gray-800 rounded-lg p-1.5 border border-gray-700">
             <button onClick={() => setSnap(!snap)} className={`p-1 rounded ${snap ? 'text-blue-400 bg-blue-500/20' : 'text-gray-500 hover:text-gray-300'}`} title="Snap to Grid (Quantize)">
                 <Grid size={16} />
             </button>
             <div className="w-px h-4 bg-gray-600 mx-1"></div>
             <ZoomOut size={14} className="text-gray-500" />
             <input 
                type="range" min="10" max="500" step="10"
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
                className="w-24 h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-blue-500"
                title="Horizontal Zoom"
            />
             <ZoomIn size={14} className="text-gray-500" />
        </div>

        <button 
            onClick={onExport}
            disabled={isExporting}
            className="flex items-center gap-2 bg-purple-600 hover:bg-purple-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
            title="Export project to WAV file"
        >
            <Download size={16} />
            {isExporting ? 'Exporting...' : 'Export'}
        </button>
      </div>
    </div>
  );
};
