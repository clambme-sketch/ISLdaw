
import React, { useRef, useState, useMemo, useEffect } from 'react';
import { Track, AudioClip, ToolType, AutomationPoint, LoopRegion } from '../types';
import { Waveform } from './Waveform';
import { Trash2, Copy, Pencil, RotateCw, ClipboardPaste, Scissors, GripVertical } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { TRACK_HEIGHT, AUTOMATION_HEIGHT, TIMELINE_RULER_HEIGHT } from '../constants';

interface TimelineProps {
  tracks: Track[];
  clips: AudioClip[];
  currentTime: number;
  bpm: number;
  zoom: number; // pixels per second
  snap: boolean;
  tool: ToolType;
  
  onClipUpdate: (id: string, newTime: number, newTrackId?: string) => void;
  onFileDrop: (file: File, trackId: string, time: number) => void;
  setClips: React.Dispatch<React.SetStateAction<AudioClip[]>>;
  onSeek: (time: number) => void;
  onDeleteClip: (id: string) => void;
  onDuplicateClip: (id: string) => void;
  onRenameClip: (id: string, newName: string) => void;
  
  onSelectClip: (id: string | null) => void;
  selectedClipId: string | null;
  onCopyClip: (id: string) => void;
  onPasteClip: (time: number, trackId: string) => void;
  canPaste: boolean;
  onLoopClip: (id: string) => void;
  
  onSplitClip: (clipId: string, splitTime: number) => void;
  onAddAutomationPoint: (trackId: string, paramId: string, point: AutomationPoint) => void;
  onClipResize: (clipId: string, newDuration: number) => void;
  
  setZoom?: (z: number) => void;
  
  loopRegion: LoopRegion;
  setLoopRegion: (region: LoopRegion) => void;
}

interface ContextMenuState {
    x: number;
    y: number;
    type: 'CLIP' | 'BACKGROUND';
    targetId?: string; 
    time?: number; 
}

export const Timeline: React.FC<TimelineProps> = ({ 
  tracks, 
  clips, 
  currentTime, 
  bpm,
  zoom,
  setZoom,
  snap,
  tool,
  onClipUpdate, 
  onFileDrop,
  onSeek,
  onDeleteClip,
  onDuplicateClip,
  onRenameClip,
  onSelectClip,
  selectedClipId,
  onCopyClip,
  onPasteClip,
  canPaste,
  onLoopClip,
  onSplitClip,
  onAddAutomationPoint,
  onClipResize,
  loopRegion,
  setLoopRegion
}) => {
  const [draggedClipId, setDraggedClipId] = useState<string | null>(null);
  const [resizingClipId, setResizingClipId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState<number>(0);
  const [resizeStartX, setResizeStartX] = useState<number>(0);
  const [resizeStartDuration, setResizeStartDuration] = useState<number>(0);
  
  // Loop Dragging State
  const [loopDragType, setLoopDragType] = useState<'START' | 'END' | 'MOVE' | null>(null);
  const [loopDragStartX, setLoopDragStartX] = useState<number>(0);
  const [loopDragStartValues, setLoopDragStartValues] = useState<{start: number, end: number}>({start:0, end:0});

  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const timelineRef = useRef<HTMLDivElement>(null);

  // --- Grid & Ruler Math ---
  const secondsPerBeat = 60 / bpm;
  const secondsPerBar = secondsPerBeat * 4; 
  const pixelsPerBar = secondsPerBar * zoom;
  const pixelsPerBeat = secondsPerBeat * zoom;

  const totalDuration = Math.max(300, ...clips.map(c => c.startTime + c.duration)); 
  const totalBars = Math.ceil(totalDuration / secondsPerBar) + 5;
  const barsArray = useMemo(() => Array.from({ length: totalBars }), [totalBars, zoom, bpm]);

  const snapToGrid = (time: number): number => {
      if (!snap) return time;
      const beat = 60 / bpm;
      return Math.round(time / beat) * beat;
  };

  useEffect(() => {
      const closeMenu = () => setContextMenu(null);
      const handleGlobalMouseUp = () => {
           if (draggedClipId) setDraggedClipId(null);
           if (resizingClipId) setResizingClipId(null);
           if (loopDragType) setLoopDragType(null);
      };
      
      window.addEventListener('click', closeMenu);
      window.addEventListener('mouseup', handleGlobalMouseUp);
      
      return () => {
          window.removeEventListener('click', closeMenu);
          window.removeEventListener('mouseup', handleGlobalMouseUp);
      };
  }, [draggedClipId, resizingClipId, loopDragType]);

  // Global Mouse Move for dragging/resizing outside container bounds
  useEffect(() => {
      const handleMouseMove = (e: MouseEvent) => {
          if (!timelineRef.current) return;
          const rect = timelineRef.current.getBoundingClientRect();
          const scrollLeft = timelineRef.current.scrollLeft || 0;
          
          // LOOP DRAGGING LOGIC
          if (loopDragType) {
              const diffPixels = e.clientX - loopDragStartX;
              const diffSeconds = diffPixels / zoom;
              
              let newStart = loopDragStartValues.start;
              let newEnd = loopDragStartValues.end;

              if (loopDragType === 'START') {
                  newStart = Math.min(newEnd - 0.25, Math.max(0, loopDragStartValues.start + diffSeconds));
              } else if (loopDragType === 'END') {
                  newEnd = Math.max(newStart + 0.25, loopDragStartValues.end + diffSeconds);
              } else if (loopDragType === 'MOVE') {
                  const duration = loopDragStartValues.end - loopDragStartValues.start;
                  newStart = Math.max(0, loopDragStartValues.start + diffSeconds);
                  newEnd = newStart + duration;
              }

              if (snap) {
                  newStart = snapToGrid(newStart);
                  newEnd = snapToGrid(newEnd);
                  // Ensure min length if snap collapses it
                  if (newEnd <= newStart) newEnd = newStart + secondsPerBeat;
              }

              setLoopRegion({ ...loopRegion, start: newStart, end: newEnd });
              return;
          }

          // CLIP RESIZING LOGIC
          if (resizingClipId) {
             const diffPixels = e.clientX - resizeStartX;
             const diffSeconds = diffPixels / zoom;
             const newDuration = Math.max(0.1, resizeStartDuration + diffSeconds); 
             const snappedDuration = snap ? snapToGrid(newDuration) : newDuration;
             onClipResize(resizingClipId, snappedDuration);
             return;
          }
      };

      if (resizingClipId || loopDragType) {
          window.addEventListener('mousemove', handleMouseMove);
      }
      return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [resizingClipId, resizeStartX, resizeStartDuration, zoom, snap, onClipResize, loopDragType, loopDragStartX, loopDragStartValues, loopRegion, setLoopRegion, bpm]);

  // Wheel Zoom Listener
  useEffect(() => {
      const container = timelineRef.current;
      if (!container || !setZoom) return;

      const handleWheel = (e: WheelEvent) => {
          if (e.ctrlKey || e.metaKey) {
              e.preventDefault();
              const delta = -e.deltaY;
              const zoomFactor = delta > 0 ? 1.1 : 0.9;
              let newZoom = zoom * zoomFactor;
              newZoom = Math.max(10, Math.min(500, newZoom));
              setZoom(newZoom);
          }
      };

      container.addEventListener('wheel', handleWheel, { passive: false });
      return () => container.removeEventListener('wheel', handleWheel);
  }, [zoom, setZoom]);

  const handleTimelineClick = (e: React.MouseEvent) => {
    if (draggedClipId || resizingClipId || loopDragType) return;
    
    const target = e.target as HTMLElement;
    
    // Check if clicked on loop handle/region
    if (target.closest('.loop-region-handle')) return;

    const clipElement = target.closest('[data-clip-id]');
    
    const automationLane = target.closest('[data-automation-track-id]');
    if (automationLane) {
        const trackId = automationLane.getAttribute('data-automation-track-id');
        const track = tracks.find(t => t.id === trackId);
        
        if (track && trackId) {
             const rect = timelineRef.current?.getBoundingClientRect();
             if (rect) {
                 const scrollLeft = timelineRef.current?.scrollLeft || 0;
                 const clickX = e.clientX - rect.left + scrollLeft;
                 const time = Math.max(0, clickX / zoom);
                 
                 const laneRect = automationLane.getBoundingClientRect();
                 const clickY = e.clientY - laneRect.top;
                 const value = 1 - Math.max(0, Math.min(1, clickY / laneRect.height));
                 const paramId = track.selectedAutomationId || 'volume';

                 onAddAutomationPoint(trackId, paramId, {
                     id: uuidv4(),
                     time: time,
                     value: value
                 });
                 return; 
             }
        }
    }

    if (clipElement && tool === 'BLADE') {
         const clipId = clipElement.getAttribute('data-clip-id');
         const rect = timelineRef.current?.getBoundingClientRect();
         if (clipId && rect) {
             const scrollLeft = timelineRef.current?.scrollLeft || 0;
             const clickX = e.clientX - rect.left + scrollLeft;
             const clickTime = clickX / zoom;
             onSplitClip(clipId, clickTime);
             return;
         }
    }
    
    if (!clipElement && !automationLane && !target.classList.contains('resize-handle')) {
        onSelectClip(null);
        const rect = timelineRef.current?.getBoundingClientRect();
        if (!rect) return;
        const scrollLeft = timelineRef.current?.scrollLeft || 0;
        const clickX = e.clientX - rect.left + scrollLeft;
        const seekTime = Math.max(0, (clickX / zoom));
        onSeek(snapToGrid(seekTime));
    }
  };

  const handleDrop = (e: React.DragEvent, trackId: string) => {
    e.preventDefault();
    const rect = timelineRef.current?.getBoundingClientRect();
    if (!rect) return;

    const scrollLeft = timelineRef.current?.scrollLeft || 0;
    const clickX = e.clientX - rect.left + scrollLeft;
    const rawTime = Math.max(0, (clickX / zoom));
    const dropTime = snapToGrid(rawTime);

    if (e.dataTransfer.files.length > 0) {
      const files = Array.from(e.dataTransfer.files) as File[];
      files.forEach(file => {
        if (file.type.startsWith('audio/')) {
          onFileDrop(file, trackId, dropTime);
        }
      });
      return;
    }

    if (draggedClipId) {
        const adjustedTime = Math.max(0, (clickX / zoom) - dragOffset);
        onClipUpdate(draggedClipId, snapToGrid(adjustedTime), trackId);
        setDraggedClipId(null);
        setDragOffset(0);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDragStart = (e: React.DragEvent, clip: AudioClip) => {
     if (tool === 'BLADE' || resizingClipId) {
         e.preventDefault(); 
         return;
     }
     onSelectClip(clip.id);
     const rect = (e.target as HTMLElement).getBoundingClientRect();
     const offsetX = e.clientX - rect.left;
     const offsetTime = offsetX / zoom;
     
     setDragOffset(offsetTime);
     setDraggedClipId(clip.id);
     e.dataTransfer.effectAllowed = "move";
  };
  
  const handleResizeStart = (e: React.MouseEvent, clip: AudioClip) => {
      e.stopPropagation();
      e.preventDefault();
      setResizingClipId(clip.id);
      setResizeStartX(e.clientX);
      setResizeStartDuration(clip.duration);
      onSelectClip(clip.id);
  };
  
  const handleLoopDragStart = (e: React.MouseEvent, type: 'START' | 'END' | 'MOVE') => {
      e.stopPropagation();
      e.preventDefault();
      setLoopDragType(type);
      setLoopDragStartX(e.clientX);
      setLoopDragStartValues({ start: loopRegion.start, end: loopRegion.end });
  };

  const handleClipContextMenu = (e: React.MouseEvent, clipId: string) => {
      e.preventDefault();
      e.stopPropagation();
      onSelectClip(clipId);
      setContextMenu({
          x: e.pageX,
          y: e.pageY,
          type: 'CLIP',
          targetId: clipId
      });
  };

  const handleTrackContextMenu = (e: React.MouseEvent, trackId: string) => {
      e.preventDefault();
      const rect = timelineRef.current?.getBoundingClientRect();
      const scrollLeft = timelineRef.current?.scrollLeft || 0;
      const clickX = e.clientX - (rect?.left || 0) + scrollLeft;
      const time = Math.max(0, clickX / zoom);
      setContextMenu({
          x: e.pageX,
          y: e.pageY,
          type: 'BACKGROUND',
          targetId: trackId,
          time: snapToGrid(time)
      });
  };

  const handleMenuAction = (e: React.MouseEvent, action: string) => {
      e.stopPropagation(); 
      if (!contextMenu) return;
      
      if (contextMenu.type === 'CLIP' && contextMenu.targetId) {
           switch(action) {
              case 'delete': onDeleteClip(contextMenu.targetId); break;
              case 'duplicate': onDuplicateClip(contextMenu.targetId); break;
              case 'rename': 
                  const clip = clips.find(c => c.id === contextMenu.targetId);
                  if (clip) {
                      const newName = prompt("Rename clip:", clip.name);
                      if (newName) onRenameClip(contextMenu.targetId, newName);
                  }
                  break;
              case 'copy': onCopyClip(contextMenu.targetId); break;
              case 'loop': onLoopClip(contextMenu.targetId); break;
          }
      } else if (contextMenu.type === 'BACKGROUND' && contextMenu.targetId && contextMenu.time !== undefined) {
           if (action === 'paste') {
               onPasteClip(contextMenu.time, contextMenu.targetId);
           }
      }
      setContextMenu(null);
  };

  const renderAutomationPoints = (track: Track) => {
      const activeParam = track.selectedAutomationId || 'volume';
      const points = track.automation?.[activeParam];
      if (!points || points.length === 0) return null;
      
      const sortedPoints = [...points].sort((a, b) => a.time - b.time);
      const pathData = sortedPoints.map((p, i) => {
          const x = p.time * zoom;
          const y = (1 - p.value) * (AUTOMATION_HEIGHT - 16) + 8; 
          return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
      }).join(' ');

      return (
          <>
              <path d={pathData} stroke="#60a5fa" strokeWidth="2" fill="none" />
              {sortedPoints.map(p => (
                  <g key={p.id}>
                    <circle 
                      cx={p.time * zoom} 
                      cy={(1 - p.value) * (AUTOMATION_HEIGHT - 16) + 8} 
                      r="12" 
                      fill="transparent"
                      className="cursor-pointer"
                    />
                    <circle 
                        cx={p.time * zoom} 
                        cy={(1 - p.value) * (AUTOMATION_HEIGHT - 16) + 8} 
                        r="4" 
                        fill="#3b82f6" 
                        className="pointer-events-none"
                    />
                  </g>
              ))}
          </>
      );
  };
  
  const renderClipContent = (clip: AudioClip, track: Track) => {
      const singleLoopDuration = clip.buffer.duration / clip.playbackRate;
      const singleLoopWidth = singleLoopDuration * zoom;
      const loops = clip.loop ? Math.ceil(clip.duration / singleLoopDuration) : 1;
      const isMuted = track.muted;
      
      return (
          <div className={`relative w-full h-full overflow-hidden ${isMuted ? 'opacity-40 grayscale' : ''}`}>
             {Array.from({ length: loops }).map((_, i) => (
                 <div 
                    key={i} 
                    className="absolute top-0 bottom-0 border-r border-dashed border-white/20"
                    style={{ left: i * singleLoopWidth, width: singleLoopWidth }}
                 >
                     <Waveform clip={clip} width={singleLoopWidth} height={TRACK_HEIGHT - 10} color={i === 0 ? "#ffffff" : "#ffffffaa"} />
                 </div>
             ))}
          </div>
      );
  };

  return (
    <>
      <style>{`.custom-scrollbar-hidden::-webkit-scrollbar { display: none; } .custom-scrollbar-hidden { -ms-overflow-style: none; scrollbar-width: none; }`}</style>
      <div 
        className={`flex-1 overflow-visible bg-gray-950 relative flex flex-col select-none ${tool === 'BLADE' ? 'cursor-[url(https://cdn.custom-cursor.com/db/cursor/32/Scissors_Cursor.png),_auto]' : ''}`}
        ref={timelineRef}
        onClick={handleTimelineClick}
      >
        <div 
            className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-30 pointer-events-none"
            style={{ left: `${currentTime * zoom}px`, height: '100%' }}
        >
            <div className="w-3 h-3 -ml-1.5 bg-red-500 transform rotate-45 -mt-1.5" />
        </div>

        <div 
          className="border-b border-gray-700 bg-gray-900 sticky top-0 z-20 flex" 
          style={{ width: `${totalBars * pixelsPerBar}px`, height: `${TIMELINE_RULER_HEIGHT}px` }}
        >
             {barsArray.map((_, i) => (
                 <div 
                    key={i} 
                    className="relative h-full border-l border-gray-600/50" 
                    style={{ width: `${pixelsPerBar}px` }}
                 >
                     <span className="absolute top-1 left-1 text-[10px] text-gray-500 font-mono select-none">{i + 1}</span>
                     <div className="absolute bottom-0 left-[25%] h-1 w-px bg-gray-700" />
                     <div className="absolute bottom-0 left-[50%] h-1.5 w-px bg-gray-700" />
                     <div className="absolute bottom-0 left-[75%] h-1 w-px bg-gray-700" />
                 </div>
             ))}

             {/* Loop Region Overlay */}
             {loopRegion.enabled && (
                 <div 
                    className="absolute top-0 h-full bg-yellow-400/20 border-l border-r border-yellow-400/50 group loop-region-handle cursor-move"
                    style={{ left: loopRegion.start * zoom, width: (loopRegion.end - loopRegion.start) * zoom }}
                    onMouseDown={(e) => handleLoopDragStart(e, 'MOVE')}
                 >
                     <div className="absolute top-0 left-0 w-full h-1 bg-yellow-400/50"></div>
                     
                     {/* Handles */}
                     <div 
                        className="absolute top-0 left-0 w-2 h-full cursor-ew-resize hover:bg-yellow-400/50 z-10"
                        onMouseDown={(e) => handleLoopDragStart(e, 'START')}
                     />
                     <div 
                        className="absolute top-0 right-0 w-2 h-full cursor-ew-resize hover:bg-yellow-400/50 z-10"
                        onMouseDown={(e) => handleLoopDragStart(e, 'END')}
                     />
                 </div>
             )}
        </div>

        <div className="flex flex-col relative" style={{ minWidth: `${totalBars * pixelsPerBar}px` }}>
          {/* Loop Region Background Highlight (Extends down tracks) */}
          {loopRegion.enabled && (
                 <div 
                    className="absolute top-0 bottom-0 bg-white/5 pointer-events-none z-0"
                    style={{ left: loopRegion.start * zoom, width: (loopRegion.end - loopRegion.start) * zoom }}
                 />
          )}

          {tracks.map(track => {
            // Dynamic Height Calculation for Lock-step alignment
            const rowHeight = track.showAutomation ? TRACK_HEIGHT + AUTOMATION_HEIGHT : TRACK_HEIGHT;
            
            return (
                <div key={track.id} className="flex flex-col z-10">
                  <div 
                      className="relative border-b border-gray-800 hover:bg-white/5 transition-colors box-border"
                      onDragOver={handleDragOver}
                      onDrop={(e) => handleDrop(e, track.id)}
                      onContextMenu={(e) => handleTrackContextMenu(e, track.id)}
                      style={{ 
                          height: `${TRACK_HEIGHT}px`,
                          backgroundImage: 'linear-gradient(to right, #374151 1px, transparent 1px)',
                          backgroundSize: `${pixelsPerBar}px 100%`,
                          backgroundPosition: '0 0'
                      }}
                  >
                      <div 
                          className="absolute inset-0 pointer-events-none" 
                          style={{ backgroundImage: 'linear-gradient(to right, #374151 1px, transparent 1px)', backgroundSize: `${pixelsPerBeat}px 100%`, opacity: 0.1 }}
                      />

                      {clips.filter(c => c.trackId === track.id).map(clip => (
                      <div
                          key={clip.id}
                          data-clip-id={clip.id}
                          draggable={tool === 'MOVE'}
                          onDragStart={(e) => handleDragStart(e, clip)}
                          onContextMenu={(e) => handleClipContextMenu(e, clip.id)}
                          onClick={(e) => e.stopPropagation()} 
                          onMouseDown={(e) => { if (tool === 'MOVE') onSelectClip(clip.id); }}
                          className={`absolute top-2 bottom-2 rounded-md overflow-hidden border shadow-md group transition-all 
                          ${tool === 'MOVE' ? 'cursor-move' : 'cursor-text hover:brightness-110'} 
                          ${selectedClipId === clip.id ? 'border-white ring-2 ring-blue-500/50 z-20' : 'border-white/20 bg-gray-800 hover:border-white/40 z-10'}`}
                          style={{ left: `${clip.startTime * zoom}px`, width: `${clip.duration * zoom}px` }}
                      >
                          <div className="absolute inset-0 opacity-60" style={{ backgroundColor: track.muted ? '#4b5563' : track.color }}></div>
                          {clip.loop && <div className="absolute top-0 right-4 p-1 text-white/70 z-30"><RotateCw size={10} /></div>}
                          <div className="absolute inset-0 z-10">{renderClipContent(clip, track)}</div>
                          <div className="absolute top-1 left-1 z-20 max-w-full"><div className="px-1 py-0.5 bg-black/40 rounded text-[10px] text-white truncate select-none font-medium flex items-center gap-1">{clip.name}</div></div>
                          {tool === 'MOVE' && <div className="absolute top-0 bottom-0 right-0 w-3 cursor-col-resize hover:bg-white/30 z-40 flex items-center justify-center resize-handle group/handle" onMouseDown={(e) => handleResizeStart(e, clip)}><GripVertical size={10} className="text-white/0 group-hover/handle:text-white/80" /></div>}
                      </div>
                      ))}
                  </div>
                  
                  {track.showAutomation && (
                      <div 
                          className="bg-gray-900/50 border-b border-gray-800 relative cursor-crosshair box-border"
                          data-automation-track-id={track.id}
                          style={{ minWidth: `${totalBars * pixelsPerBar}px`, height: `${AUTOMATION_HEIGHT}px` }}
                      >
                          <div className="absolute inset-0 pointer-events-none border-b border-dashed border-white/10 top-1/2"></div>
                          <div className="absolute top-1 left-1 text-[9px] text-blue-400 font-bold bg-black/50 px-1 rounded pointer-events-none">{track.selectedAutomationId === 'pan' ? 'Pan' : track.selectedAutomationId === 'volume' ? 'Vol' : track.selectedAutomationId?.split(':')[1].toUpperCase()}</div>
                          <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ overflow: 'visible' }}>{renderAutomationPoints(track)}</svg>
                      </div>
                  )}
                </div>
            );
          })}
          <div className="h-64 flex items-center justify-center text-gray-800 select-none pointer-events-none">End of tracks</div>
        </div>

        {contextMenu && (
            <div 
                className="fixed z-50 w-48 bg-gray-800 border border-gray-600 rounded-lg shadow-xl py-1 text-sm text-gray-200 animate-in fade-in zoom-in-95 duration-100"
                style={{ top: contextMenu.y, left: contextMenu.x }}
            >
                {contextMenu.type === 'CLIP' ? (
                    <>
                      <button onClick={(e) => handleMenuAction(e, 'copy')} className="w-full text-left px-4 py-2 hover:bg-gray-700 flex items-center gap-2"><Copy size={14} /> Copy</button>
                      <button onClick={(e) => handleMenuAction(e, 'loop')} className="w-full text-left px-4 py-2 hover:bg-gray-700 flex items-center gap-2"><RotateCw size={14} /> Toggle Loop</button>
                      <button onClick={(e) => handleMenuAction(e, 'rename')} className="w-full text-left px-4 py-2 hover:bg-gray-700 flex items-center gap-2"><Pencil size={14} /> Rename</button>
                      <button onClick={(e) => handleMenuAction(e, 'duplicate')} className="w-full text-left px-4 py-2 hover:bg-gray-700 flex items-center gap-2"><Copy size={14} /> Duplicate</button>
                      <div className="h-px bg-gray-700 my-1" />
                      <button onClick={(e) => handleMenuAction(e, 'delete')} className="w-full text-left px-4 py-2 hover:bg-red-900/50 text-red-400 hover:text-red-300 flex items-center gap-2"><Trash2 size={14} /> Delete</button>
                    </>
                ) : (
                    <>
                      <button onClick={(e) => handleMenuAction(e, 'paste')} disabled={!canPaste} className={`w-full text-left px-4 py-2 flex items-center gap-2 ${canPaste ? 'hover:bg-gray-700' : 'opacity-50 cursor-not-allowed'}`}><ClipboardPaste size={14} /> Paste</button>
                    </>
                )}
            </div>
        )}
      </div>
    </>
  );
};
