
import React, { useRef, useState, useMemo, useEffect } from 'react';
import { Track, AudioClip, ToolType, AutomationPoint, LoopRegion } from '../types';
import { Waveform } from './Waveform';
import { Trash2, Copy, Pencil, RotateCw, ClipboardPaste, GripVertical, Upload, FileStack, Flag, X, Check, ArrowLeftRight, Scissors } from 'lucide-react';
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
  followPlayhead: boolean;
  setFollowPlayhead: (follow: boolean) => void;
  
  onClipsUpdate: (updates: { id: string, startTime: number, trackId?: string }[]) => void;
  onFileDrop: (file: File, trackId: string, time: number) => void;
  setClips: React.Dispatch<React.SetStateAction<AudioClip[]>>;
  onSeek: (time: number) => void;
  
  // Selection & Batch Ops
  selectedClipIds: string[];
  setSelectedClipIds: (ids: string[]) => void;
  onDeleteClips: (ids: string[]) => void;
  onDuplicateClips: (ids: string[]) => void;
  onCopyClips: (ids: string[]) => void;
  onPasteClips: (time: number, trackId: string) => void;
  canPaste: boolean;
  
  onRenameClip: (id: string, newName: string) => void;
  onLoopClip: (id: string) => void;
  
  onSplitClip: (clipId: string, splitTime: number) => void;
  onAddAutomationPoint: (trackId: string, paramId: string, point: AutomationPoint) => void;
  onClipResize: (clipId: string, newStartTime: number, newDuration: number, newOffset: number) => void;
  
  setZoom?: (z: number) => void;
  
  loopRegion: LoopRegion;
  setLoopRegion: (region: LoopRegion) => void;
  
  onImportAudio: (file: File, trackId: string, time: number) => void;
  
  markers?: {time: number, label: string}[];
  onAddMarker?: (time: number, label: string) => void;
  setBpm?: (bpm: number) => void;
  
  onFlattenClip?: (id: string) => void;
  onClipDoubleClick?: (clipId: string) => void;
  onAutoAlign?: () => void;
}

interface ContextMenuState {
    x: number;
    y: number;
    type: 'CLIP' | 'BACKGROUND' | 'RULER';
    targetId?: string; // ClipId or TrackId
    time?: number; 
}

interface MarqueeState {
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
    active: boolean;
}

interface MarkerModalState {
    isOpen: boolean;
    time: number;
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
  followPlayhead,
  setFollowPlayhead,
  onClipsUpdate, 
  onFileDrop,
  onSeek,
  selectedClipIds,
  setSelectedClipIds,
  onDeleteClips,
  onDuplicateClips,
  onCopyClips,
  onPasteClips,
  canPaste,
  onRenameClip,
  onLoopClip,
  onSplitClip,
  onAddAutomationPoint,
  onClipResize,
  loopRegion,
  setLoopRegion,
  onImportAudio,
  markers = [],
  onAddMarker,
  setBpm,
  onFlattenClip,
  onClipDoubleClick,
  onAutoAlign
}) => {
  const playheadRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
      const handleTimeUpdate = (e: Event) => {
          const customEvent = e as CustomEvent<number>;
          if (playheadRef.current) {
              playheadRef.current.style.left = `${customEvent.detail * zoom}px`;
          }
      };
      window.addEventListener('playhead-update', handleTimeUpdate);
      return () => window.removeEventListener('playhead-update', handleTimeUpdate);
  }, [zoom]);

  const [draggedClipId, setDraggedClipId] = useState<string | null>(null);
  
  // Resize State
  const [resizingClipId, setResizingClipId] = useState<string | null>(null);
  const [resizeEdge, setResizeEdge] = useState<'START' | 'END' | null>(null);
  const [resizeStartX, setResizeStartX] = useState<number>(0);
  // Snapshot of clip state at start of resize
  const [resizeStartValues, setResizeStartValues] = useState<{startTime: number, duration: number, offset: number}>({startTime: 0, duration: 0, offset: 0});
  
  // Keep track of the initial offset for ALL selected clips during a drag
  const [dragOffsets, setDragOffsets] = useState<{ [id: string]: number }>({});
  
  // Ruler Zoom/Scroll Drag State
  const [rulerDrag, setRulerDrag] = useState<{startY: number, startX: number, initialZoom: number, initialScrollLeft: number} | null>(null);
  const isRulerDraggingRef = useRef(false);

  // Marquee State
  const [marquee, setMarquee] = useState<MarqueeState | null>(null);
  const justFinishedMarqueeRef = useRef(false);
  
  // Loop Dragging State
  const [loopDragType, setLoopDragType] = useState<'START' | 'END' | 'MOVE' | null>(null);
  const [loopDragStartX, setLoopDragStartX] = useState<number>(0);
  const [loopDragStartValues, setLoopDragStartValues] = useState<{start: number, end: number}>({start:0, end:0});

  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [markerModal, setMarkerModal] = useState<MarkerModalState | null>(null);
  const [markerInputValue, setMarkerInputValue] = useState("");

  const timelineRef = useRef<HTMLDivElement>(null);
  
  // Refs for File Import
  const fileInputRef = useRef<HTMLInputElement>(null);
  const importTargetRef = useRef<{trackId: string, time: number} | null>(null);

  // --- Grid & Ruler Math ---
  const secondsPerBeat = 60 / bpm;
  const secondsPerBar = secondsPerBeat * 4; 
  const pixelsPerBar = secondsPerBar * zoom;
  const pixelsPerBeat = secondsPerBeat * zoom;

  const totalDuration = Math.max(300, ...clips.map(c => c.startTime + c.duration)); 
  const totalBars = Math.ceil(totalDuration / secondsPerBar) + 5;
  const barsArray = useMemo(() => Array.from({ length: totalBars }), [totalBars, zoom, bpm]);

  const snapToGrid = (time: number): number => {
      // Always snap if enabled, caller handles the check
      const beat = 60 / bpm;
      // Round to nearest beat
      return Math.round(time / beat) * beat;
  };

  // --- Keyboard Shortcuts (Delete) ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
        // Prevent deletion if user is typing in an input
        const target = e.target as HTMLElement;
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;

        if (e.key === 'Backspace' || e.key === 'Delete') {
            if (selectedClipIds.length > 0) {
                e.preventDefault();
                onDeleteClips(selectedClipIds);
            }
        }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedClipIds, onDeleteClips]);

  useEffect(() => {
      const closeMenu = () => setContextMenu(null);
      const handleGlobalMouseUp = () => {
           if (draggedClipId) {
               setDraggedClipId(null);
               setDragOffsets({});
           }
           if (resizingClipId) {
               setResizingClipId(null);
               setResizeEdge(null);
           }
           if (loopDragType) setLoopDragType(null);
           if (rulerDrag) {
               setRulerDrag(null);
               // Reset the ref after a short delay so onClick knows we just finished dragging
               setTimeout(() => {
                   isRulerDraggingRef.current = false;
               }, 50);
           }
           if (marquee?.active) {
               setMarquee(null);
               // Set a flag to prevent the subsequent 'click' event from clearing selection
               justFinishedMarqueeRef.current = true;
               setTimeout(() => { justFinishedMarqueeRef.current = false; }, 100);
           }
      };

      // Stop dragging actions if the mouse leaves the document window to prevent stuck states
      const handleMouseLeave = () => {
          if (rulerDrag) {
              setRulerDrag(null);
              isRulerDraggingRef.current = false;
          }
          if (draggedClipId) {
              setDraggedClipId(null);
              setDragOffsets({});
          }
          if (resizingClipId) {
              setResizingClipId(null);
              setResizeEdge(null);
          }
          if (loopDragType) setLoopDragType(null);
      };
      
      window.addEventListener('click', closeMenu);
      window.addEventListener('mouseup', handleGlobalMouseUp);
      document.addEventListener('mouseleave', handleMouseLeave);
      
      return () => {
          window.removeEventListener('click', closeMenu);
          window.removeEventListener('mouseup', handleGlobalMouseUp);
          document.removeEventListener('mouseleave', handleMouseLeave);
      };
  }, [draggedClipId, resizingClipId, loopDragType, marquee, rulerDrag]);

  // Global Mouse Move
  useEffect(() => {
      const handleMouseMove = (e: MouseEvent) => {
          // Ruler Zoom/Scroll Drag Logic
          if (rulerDrag && setZoom && timelineRef.current) {
              const deltaY = e.clientY - rulerDrag.startY;
              const deltaX = e.clientX - rulerDrag.startX;
              
              if (Math.abs(deltaY) > 3 || Math.abs(deltaX) > 3) isRulerDraggingRef.current = true;

              // Drag Down (+Y) -> Zoom In. Drag Up (-Y) -> Zoom Out.
              // Sensitivity: 1px = 1% change roughly
              const factor = 1 + (deltaY * 0.005);
              const newZoom = Math.max(10, Math.min(500, rulerDrag.initialZoom * factor));
              setZoom(newZoom);
              
              // Drag Left/Right -> Scroll
              timelineRef.current.scrollLeft = rulerDrag.initialScrollLeft - deltaX;
              
              return;
          }

          if (!timelineRef.current) return;
          const rect = timelineRef.current.getBoundingClientRect();
          const relativeX = e.clientX - rect.left + timelineRef.current.scrollLeft;
          const relativeY = e.clientY - rect.top + timelineRef.current.scrollTop;

          if (marquee?.active) {
              let currentX = relativeX;
              if (snap) {
                  currentX = snapToGrid(relativeX / zoom) * zoom;
              }
              setMarquee(prev => prev ? { ...prev, currentX, currentY: relativeY } : null);
              
              const mX = Math.min(marquee.startX, currentX);
              const mY = Math.min(marquee.startY, relativeY);
              const mW = Math.abs(currentX - marquee.startX);
              const mH = Math.abs(relativeY - marquee.startY);
              
              const newSelectedIds: string[] = [];
              const clipElements = timelineRef.current.querySelectorAll('[data-clip-id]');
              
              clipElements.forEach(el => {
                  const clipRect = el.getBoundingClientRect();
                  const clipRelX = clipRect.left - rect.left + timelineRef.current!.scrollLeft;
                  const clipRelY = clipRect.top - rect.top + timelineRef.current!.scrollTop;
                  
                  if (mX < clipRelX + clipRect.width &&
                      mX + mW > clipRelX &&
                      mY < clipRelY + clipRect.height &&
                      mY + mH > clipRelY) {
                          const id = el.getAttribute('data-clip-id');
                          if (id) newSelectedIds.push(id);
                      }
              });
              
              setSelectedClipIds(newSelectedIds);
              return;
          }

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
                  if (newEnd <= newStart) newEnd = newStart + secondsPerBeat;
              }

              setLoopRegion({ ...loopRegion, start: newStart, end: newEnd });
              return;
          }

          if (resizingClipId && resizeEdge) {
             const diffPixels = e.clientX - resizeStartX;
             const diffSeconds = diffPixels / zoom;
             
             const clip = clips.find(c => c.id === resizingClipId);
             if (!clip) return;

             let newDuration = resizeStartValues.duration;
             let newStartTime = resizeStartValues.startTime;
             let newOffset = resizeStartValues.offset;

             if (resizeEdge === 'END') {
                 // Adjusting right edge: changes duration
                 newDuration = Math.max(0.05, resizeStartValues.duration + diffSeconds);
                 if (snap) newDuration = snapToGrid(resizeStartValues.startTime + newDuration) - resizeStartValues.startTime;
                 
                 // Clamp to next clip's start
                 const nextClips = clips.filter(c => c.trackId === clip.trackId && c.id !== clip.id && c.startTime >= resizeStartValues.startTime + resizeStartValues.duration - 0.001);
                 if (nextClips.length > 0) {
                     const nextClipStart = Math.min(...nextClips.map(c => c.startTime));
                     if (newStartTime + newDuration > nextClipStart) {
                         newDuration = nextClipStart - newStartTime;
                     }
                 }
             } else {
                 // Adjusting left edge: changes start time, duration, AND offset
                 let desiredDelta = diffSeconds;
                 if (snap) {
                      const snappedNewStart = snapToGrid(resizeStartValues.startTime + diffSeconds);
                      desiredDelta = snappedNewStart - resizeStartValues.startTime;
                 }
                 
                 // Clamp to previous clip's end
                 const prevClips = clips.filter(c => c.trackId === clip.trackId && c.id !== clip.id && c.startTime + c.duration <= resizeStartValues.startTime + 0.001);
                 if (prevClips.length > 0) {
                     const prevClipEnd = Math.max(...prevClips.map(c => c.startTime + c.duration));
                     if (resizeStartValues.startTime + desiredDelta < prevClipEnd) {
                         desiredDelta = prevClipEnd - resizeStartValues.startTime;
                     }
                 }
                 
                 // Constrain: Don't let duration go below 0.05
                 if (resizeStartValues.duration - desiredDelta < 0.05) {
                     desiredDelta = resizeStartValues.duration - 0.05;
                 }
                 
                 // Constrain: Don't let offset go below 0
                 const minDelta = -resizeStartValues.offset / clip.playbackRate;
                 if (desiredDelta < minDelta) {
                     desiredDelta = minDelta;
                 }
                 
                 newStartTime = resizeStartValues.startTime + desiredDelta;
                 newDuration = resizeStartValues.duration - desiredDelta;
                 newOffset = resizeStartValues.offset + (desiredDelta * clip.playbackRate);
             }

             if (newDuration < 0.05) newDuration = 0.05;

             onClipResize(resizingClipId, newStartTime, newDuration, newOffset);
             return;
          }
      };

      if (resizingClipId || loopDragType || marquee?.active || rulerDrag) {
          window.addEventListener('mousemove', handleMouseMove);
      }
      return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [resizingClipId, resizeEdge, resizeStartX, resizeStartValues, zoom, snap, onClipResize, loopDragType, loopDragStartX, loopDragStartValues, loopRegion, setLoopRegion, bpm, marquee, clips, rulerDrag]);

  // Wheel Zoom
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

  const handleRulerMouseDown = (e: React.MouseEvent) => {
      if (e.button !== 0) return; // Only left click
      if ((e.target as HTMLElement).closest('.loop-region-handle')) return;
      e.preventDefault();
      
      setRulerDrag({
          startY: e.clientY,
          startX: e.clientX,
          initialZoom: zoom,
          initialScrollLeft: timelineRef.current?.scrollLeft || 0
      });
      isRulerDraggingRef.current = false; // Will set to true on move
  };

  const handleRulerClick = (e: React.MouseEvent) => {
      if (e.button === 2) return;
      if ((e.target as HTMLElement).closest('.loop-region-handle')) return;
      
      // If we dragged to zoom, don't seek
      if (isRulerDraggingRef.current) return;
      
      const rect = timelineRef.current?.getBoundingClientRect();
      if (!rect) return;
      
      const clickX = e.clientX - rect.left + timelineRef.current!.scrollLeft;
      const seekTime = Math.max(0, (clickX / zoom));
      
      onSeek(snap ? snapToGrid(seekTime) : seekTime);
  };

  const handleTimelineClick = (e: React.MouseEvent) => {
    if (draggedClipId || resizingClipId || loopDragType) return;
    
    if (justFinishedMarqueeRef.current) {
        justFinishedMarqueeRef.current = false;
        return;
    }
    
    const target = e.target as HTMLElement;
    if (target.closest('.loop-region-handle')) return;
    if (target.closest('.ruler-track')) return; 

    const clipElement = target.closest('[data-clip-id]');
    
    const automationLane = target.closest('[data-automation-track-id]');
    if (automationLane) {
        const trackId = automationLane.getAttribute('data-automation-track-id');
        const track = tracks.find(t => t.id === trackId);
        
        if (track && trackId) {
             const rect = timelineRef.current?.getBoundingClientRect();
             if (rect) {
                 const clickX = e.clientX - rect.left + timelineRef.current!.scrollLeft;
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
    
    // NOTE: Blade tool logic is now handled in the clip's onClick to prevent bubbling issues.
    
    if (!clipElement && !automationLane && !target.classList.contains('resize-handle')) {
        const rect = timelineRef.current?.getBoundingClientRect();
        if (!rect) return;
        
        if (!marquee?.active) {
             const clickX = e.clientX - rect.left + timelineRef.current!.scrollLeft;
             const seekTime = Math.max(0, (clickX / zoom));
             onSeek(snap ? snapToGrid(seekTime) : seekTime);
             setSelectedClipIds([]); 
        }
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-clip-id]') && !target.closest('.loop-region-handle') && !target.closest('[data-automation-track-id]') && !target.closest('.ruler-track')) {
          if (tool === 'MOVE') {
              const rect = timelineRef.current!.getBoundingClientRect();
              let x = e.clientX - rect.left + timelineRef.current!.scrollLeft;
              const y = e.clientY - rect.top + timelineRef.current!.scrollTop;
              
              if (snap) {
                  x = snapToGrid(x / zoom) * zoom;
              }
              
              setMarquee({
                  startX: x,
                  startY: y,
                  currentX: x,
                  currentY: y,
                  active: true
              });
          }
      }
  };

  const handleDrop = (e: React.DragEvent, trackId: string) => {
    e.preventDefault();
    const rect = timelineRef.current?.getBoundingClientRect();
    if (!rect) return;

    const clickX = e.clientX - rect.left + timelineRef.current!.scrollLeft;
    const rawTime = Math.max(0, (clickX / zoom));
    
    // If dropping a file, we usually just snap the insertion point
    const dropTime = snap ? snapToGrid(rawTime) : rawTime;

    if (e.dataTransfer.files.length > 0) {
      const files = Array.from(e.dataTransfer.files) as File[];
      files.forEach(file => {
        const isAudio = file.type.startsWith('audio/') || 
                        file.type === 'video/mp4' || 
                        file.type === 'video/webm' || // Chromebook Screen Recording
                        file.name.toLowerCase().endsWith('.webm') ||
                        file.name.toLowerCase().endsWith('.m4a') ||
                        file.name.toLowerCase().endsWith('.aif') ||
                        file.name.toLowerCase().endsWith('.aiff');
        if (isAudio) {
          onFileDrop(file, trackId, dropTime);
        }
      });
      return;
    }

    if (draggedClipId) {
        const draggedClip = clips.find(c => c.id === draggedClipId);
        if (!draggedClip) return;

        const movingIds = selectedClipIds.includes(draggedClipId) ? selectedClipIds : [draggedClipId];
        
        // --- Improved Snap Logic ---
        // We want the *START* of the clip to land on the grid, not the mouse cursor.
        // `primaryOffset` is the time difference between Clip Start and Mouse Click position.
        const primaryOffset = dragOffsets[draggedClipId] || 0;
        
        // 1. Calculate where the clip start WOULD be if we dropped it at the raw mouse position
        const rawNewStartTime = rawTime - primaryOffset;
        
        // 2. Snap THAT start time to the grid
        const snappedNewStartTime = snap ? snapToGrid(rawNewStartTime) : rawNewStartTime;
        
        // 3. Calculate the delta applied to all other selected clips
        const timeDelta = Math.max(0, snappedNewStartTime) - draggedClip.startTime; 
        
        const updates = movingIds.map(id => {
            const clip = clips.find(c => c.id === id);
            if (!clip) return null;
            
            return {
                id: clip.id,
                startTime: Math.max(0, clip.startTime + timeDelta),
                trackId: id === draggedClipId ? trackId : clip.trackId 
            };
        }).filter(Boolean) as { id: string, startTime: number, trackId?: string }[];

        let hasOverlap = false;
        for (const update of updates) {
            const clip = clips.find(c => c.id === update.id);
            if (!clip) continue;
            
            const targetTrackId = update.trackId || clip.trackId;
            const newStartTime = update.startTime;
            const newEndTime = newStartTime + clip.duration;
            
            const otherClips = clips.filter(c => c.trackId === targetTrackId && !movingIds.includes(c.id));
            
            for (const other of otherClips) {
                const otherStart = other.startTime;
                const otherEnd = other.startTime + other.duration;
                
                if (newStartTime < otherEnd - 0.001 && newEndTime > otherStart + 0.001) {
                    hasOverlap = true;
                    break;
                }
            }
            if (hasOverlap) break;
        }

        if (!hasOverlap) {
            onClipsUpdate(updates);
        }
        setDraggedClipId(null);
        setDragOffsets({});
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
     
     let currentSelection = selectedClipIds;
     if (!selectedClipIds.includes(clip.id)) {
         setSelectedClipIds([clip.id]);
         currentSelection = [clip.id];
     }
     
     const rect = (e.target as HTMLElement).getBoundingClientRect();
     
     // Calculate how far the mouse is from the start of the clip (in seconds)
     const mouseOffsetX = e.clientX - rect.left;
     const mouseOffsetTime = mouseOffsetX / zoom;
     
     const offsets: {[id:string]: number} = {};
     currentSelection.forEach(id => {
         // Store the offset so we can subtract it during drop to find the clip start
         if (id === clip.id) {
             offsets[id] = mouseOffsetTime;
         } else {
             offsets[id] = 0; // Not strictly needed for follower clips in this logic
         }
     });
     
     setDragOffsets(offsets);
     setDraggedClipId(clip.id);
     e.dataTransfer.effectAllowed = "move";
  };
  
  const handleResizeStart = (e: React.MouseEvent, clip: AudioClip, edge: 'START' | 'END') => {
      e.stopPropagation();
      e.preventDefault();
      setResizingClipId(clip.id);
      setResizeEdge(edge);
      setResizeStartX(e.clientX);
      setResizeStartValues({
          startTime: clip.startTime,
          duration: clip.duration,
          offset: clip.offset
      });
      if (!selectedClipIds.includes(clip.id)) {
          setSelectedClipIds([clip.id]);
      }
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
      if (!selectedClipIds.includes(clipId)) {
          setSelectedClipIds([clipId]);
      }
      
      const rect = timelineRef.current?.getBoundingClientRect();
      const clickX = e.clientX - (rect?.left || 0) + timelineRef.current!.scrollLeft;
      const time = Math.max(0, clickX / zoom);
      
      setContextMenu({
          x: e.pageX,
          y: e.pageY,
          type: 'CLIP',
          targetId: clipId,
          time: time // Pass time for split logic
      });
  };

  const handleTrackContextMenu = (e: React.MouseEvent, trackId: string) => {
      e.preventDefault();
      const rect = timelineRef.current?.getBoundingClientRect();
      const clickX = e.clientX - (rect?.left || 0) + timelineRef.current!.scrollLeft;
      const time = Math.max(0, clickX / zoom);
      setContextMenu({
          x: e.pageX,
          y: e.pageY,
          type: 'BACKGROUND',
          targetId: trackId,
          time: snap ? snapToGrid(time) : time
      });
  };

  const handleRulerContextMenu = (e: React.MouseEvent) => {
      e.preventDefault();
      const rect = timelineRef.current?.getBoundingClientRect();
      const clickX = e.clientX - (rect?.left || 0) + timelineRef.current!.scrollLeft;
      const time = Math.max(0, clickX / zoom);
      setContextMenu({
          x: e.pageX,
          y: e.pageY,
          type: 'RULER',
          time: snap ? snapToGrid(time) : time
      });
  };

  const handleMenuAction = (e: React.MouseEvent, action: string) => {
      e.stopPropagation(); 
      if (!contextMenu) return;
      
      if (contextMenu.type === 'CLIP') {
           const targetIsSelected = contextMenu.targetId && selectedClipIds.includes(contextMenu.targetId);
           const idsToActOn = targetIsSelected ? selectedClipIds : (contextMenu.targetId ? [contextMenu.targetId] : []);

           switch(action) {
              case 'delete': onDeleteClips(idsToActOn); break;
              case 'duplicate': onDuplicateClips(idsToActOn); break;
              case 'split': 
                  // For split, we typically act on the hovered clip or all selected clips at the playhead/click point
                  // Implementing split for single target clip at the click time
                  if (contextMenu.targetId && contextMenu.time !== undefined) {
                      onSplitClip(contextMenu.targetId, contextMenu.time);
                  }
                  break;
              case 'rename': 
                  if (idsToActOn.length === 1) {
                      const clip = clips.find(c => c.id === idsToActOn[0]);
                      if (clip) {
                          const newName = prompt("Rename clip:", clip.name);
                          if (newName) onRenameClip(idsToActOn[0], newName);
                      }
                  } else {
                      alert("Can only rename one clip at a time.");
                  }
                  break;
              case 'copy': onCopyClips(idsToActOn); break;
              case 'loop': idsToActOn.forEach(id => onLoopClip(id)); break;
              case 'flatten': 
                  if (idsToActOn.length === 1 && onFlattenClip) onFlattenClip(idsToActOn[0]); 
                  else if (idsToActOn.length > 1) alert("Flattening multiple clips not supported yet.");
                  break;
              case 'auto-align':
                  if (onAutoAlign) onAutoAlign();
                  break;
          }
      } else if (contextMenu.type === 'BACKGROUND' && contextMenu.targetId && contextMenu.time !== undefined) {
           if (action === 'paste') {
               onPasteClips(contextMenu.time, contextMenu.targetId);
           } else if (action === 'import-file') {
               importTargetRef.current = { trackId: contextMenu.targetId, time: contextMenu.time };
               fileInputRef.current?.click();
           }
      } else if (contextMenu.type === 'RULER' && contextMenu.time !== undefined) {
           if (action === 'add-marker') {
                setMarkerModal({ isOpen: true, time: contextMenu.time });
                setMarkerInputValue("Verse 1");
           }
      }
      setContextMenu(null);
  };
  
  const handleMarkerSubmit = () => {
      if (!markerModal || !onAddMarker) return;
      const { time } = markerModal;
      
      onAddMarker(time, markerInputValue);
      
      setMarkerModal(null);
  };
  
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0] && importTargetRef.current) {
          const { trackId, time } = importTargetRef.current;
          onImportAudio(e.target.files[0], trackId, time);
      }
      if (fileInputRef.current) {
          fileInputRef.current.value = '';
      }
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
              <path d={pathData} stroke="#ef4444" strokeWidth="2" fill="none" />
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
                        fill="#ef4444" 
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
      
      // Calculate how many loops we need to cover the visible duration + the offset shift
      const totalVisibleTime = clip.duration + (clip.offset / clip.playbackRate);
      const loopsNeeded = clip.loop ? Math.ceil(totalVisibleTime / singleLoopDuration) : 1;
      
      // Shift the inner container left by the offset amount to "hide" the trimmed start
      const shiftPx = (clip.offset / clip.playbackRate) * zoom;
      
      const isMuted = track.muted;
      
      return (
          <div className={`relative w-full h-full overflow-hidden ${isMuted ? 'opacity-40 grayscale' : ''}`}>
             <div className="absolute top-0 bottom-0 flex" style={{ left: -shiftPx }}>
                 {Array.from({ length: loopsNeeded }).map((_, i) => {
                     // If not looping, we only render the first instance.
                     if (!clip.loop && i > 0) return null;
                     
                     return (
                         <div 
                            key={i} 
                            className="flex-shrink-0 border-r border-dashed border-black/20"
                            style={{ width: singleLoopWidth, height: '100%' }}
                         >
                             <Waveform clip={clip} width={singleLoopWidth} height={TRACK_HEIGHT - 10} color={i === 0 ? "#111111" : "#111111aa"} />
                         </div>
                     );
                 })}
             </div>
          </div>
      );
  };

  return (
    <>
      <div 
        className={`flex-1 relative flex flex-col select-none ${tool === 'BLADE' ? 'cursor-[url(https://cdn.custom-cursor.com/db/cursor/32/Scissors_Cursor.png),_auto]' : ''} ${rulerDrag ? 'cursor-ns-resize' : ''}`}
        ref={timelineRef}
        onClick={handleTimelineClick}
        onMouseDown={handleMouseDown}
      >
        <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileSelect}
            className="hidden" 
            accept="audio/*,video/webm,.webm,.m4a,.mp4,.aif,.aiff,.wav,.mp3,.flac,.ogg" 
        />

        {/* Marquee Box */}
        {marquee?.active && (
            <div 
                className="absolute bg-[#ff7b00]/20 border border-[#ff7b00] z-50 pointer-events-none"
                style={{
                    left: Math.min(marquee.startX, marquee.currentX),
                    top: Math.min(marquee.startY, marquee.currentY),
                    width: Math.abs(marquee.currentX - marquee.startX),
                    height: Math.abs(marquee.currentY - marquee.startY)
                }}
            />
        )}

        <div 
            ref={playheadRef}
            className="absolute top-0 bottom-0 w-px bg-[#ff7b00] z-30 pointer-events-none"
            style={{ left: `${currentTime * zoom}px`, height: '100%' }}
        >
            <div 
                className="w-2.5 h-2.5 -ml-[5px] bg-[#ff7b00] transform rotate-45 -mt-1 cursor-pointer pointer-events-auto" 
                onContextMenu={(e) => {
                    e.preventDefault();
                    setFollowPlayhead(!followPlayhead);
                }}
                title={`Right-click to toggle follow playhead (Currently: ${followPlayhead ? 'ON' : 'OFF'})`}
            />
        </div>

        {/* Ruler - Now with sticky top-0 to stick inside the App-level scroll container */}
        <div 
          className="border-b border-[#111] bg-[#2d2d2d] sticky top-0 z-20 flex cursor-context-menu ruler-track" 
          style={{ width: `${totalBars * pixelsPerBar}px`, height: `${TIMELINE_RULER_HEIGHT}px` }}
          onContextMenu={handleRulerContextMenu}
          onClick={handleRulerClick}
          onMouseDown={handleRulerMouseDown}
          title="Left-click to seek. Drag Up/Down to Zoom. Right-click to add markers."
        >
             {barsArray.map((_, i) => (
                 <div 
                    key={i} 
                    className="relative h-full border-l border-[#444] pointer-events-none" 
                    style={{ width: `${pixelsPerBar}px` }}
                 >
                     <span className="absolute top-1 left-1 text-[9px] text-[#999] font-mono select-none">{i + 1}</span>
                     <div className="absolute bottom-0 left-[25%] h-1 w-px bg-[#444]" />
                     <div className="absolute bottom-0 left-[50%] h-1.5 w-px bg-[#444]" />
                     <div className="absolute bottom-0 left-[75%] h-1 w-px bg-[#444]" />
                 </div>
             ))}

             {/* Markers */}
             {markers.map((m, i) => (
                 <div key={i} className="absolute top-0 h-full border-l border-[#ff7b00] group z-20" style={{ left: m.time * zoom }}>
                     {/* Marker Line */}
                     <div className="absolute top-8 w-px h-[2000px] bg-[#ff7b00]/20 pointer-events-none"></div>
                     {/* Marker Label */}
                     <div className="flex items-center bg-[#ff7b00] text-black text-[9px] px-1 rounded-none shadow-none cursor-pointer hover:bg-[#ff9933] transition-none">
                        <Flag size={8} className="mr-1" />
                        {m.label}
                     </div>
                 </div>
             ))}

             {/* Loop Region Overlay */}
             {loopRegion.enabled && (
                 <div 
                    className="absolute top-0 h-full bg-[#ff7b00]/20 border-l border-r border-[#ff7b00]/50 group loop-region-handle cursor-move"
                    style={{ left: loopRegion.start * zoom, width: (loopRegion.end - loopRegion.start) * zoom }}
                    onMouseDown={(e) => handleLoopDragStart(e, 'MOVE')}
                    onClick={(e) => e.stopPropagation()}
                 >
                     <div className="absolute top-0 left-0 w-full h-1 bg-[#ff7b00]/50"></div>
                     
                     {/* Handles */}
                     <div 
                        className="absolute top-0 left-0 w-2 h-full cursor-ew-resize hover:bg-[#ff7b00]/50 z-10"
                        onMouseDown={(e) => handleLoopDragStart(e, 'START')}
                     />
                     <div 
                        className="absolute top-0 right-0 w-2 h-full cursor-ew-resize hover:bg-[#ff7b00]/50 z-10"
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
            return (
                <div key={track.id} className="flex flex-col z-10">
                  <div 
                      className="relative border-b border-[#111] hover:bg-white/5 transition-none box-border"
                      onDragOver={handleDragOver}
                      onDrop={(e) => handleDrop(e, track.id)}
                      onContextMenu={(e) => handleTrackContextMenu(e, track.id)}
                      style={{ 
                          height: `${TRACK_HEIGHT}px`,
                          backgroundImage: 'linear-gradient(to right, #333 1px, transparent 1px)',
                          backgroundSize: `${pixelsPerBar}px 100%`,
                          backgroundPosition: '0 0'
                      }}
                  >
                      <div 
                          className="absolute inset-0 pointer-events-none" 
                          style={{ backgroundImage: 'linear-gradient(to right, #333 1px, transparent 1px)', backgroundSize: `${pixelsPerBeat}px 100%`, opacity: 0.5 }}
                      />

                      {clips.filter(c => c.trackId === track.id).map(clip => {
                          const isSelected = selectedClipIds.includes(clip.id);
                          return (
                          <div
                              key={clip.id}
                              data-clip-id={clip.id}
                              draggable={tool === 'MOVE'}
                              onDragStart={(e) => handleDragStart(e, clip)}
                              onContextMenu={(e) => handleClipContextMenu(e, clip.id)}
                              onClick={(e) => {
                                  e.stopPropagation();
                                  if (tool === 'BLADE') {
                                       const rect = timelineRef.current?.getBoundingClientRect();
                                       if (rect) {
                                           const clickX = e.clientX - rect.left + timelineRef.current!.scrollLeft;
                                           const clickTime = clickX / zoom;
                                           onSplitClip(clip.id, clickTime);
                                       }
                                  } else {
                                      if (tool === 'MOVE' && !isSelected && !e.shiftKey) setSelectedClipIds([clip.id]);
                                  }
                              }} 
                              onDoubleClick={(e) => { e.stopPropagation(); onClipDoubleClick?.(clip.id); }}
                              onMouseDown={(e) => { 
                                  if (tool === 'MOVE' && !isSelected && !e.shiftKey) setSelectedClipIds([clip.id]); 
                              }}
                              className={`absolute top-1 bottom-1 rounded-none overflow-hidden border shadow-none group transition-none 
                              ${tool === 'MOVE' ? 'cursor-move' : 'cursor-text hover:brightness-110'} 
                              ${isSelected ? 'border-white z-20' : 'border-[#111] bg-[#444] hover:border-[#999] z-10'}`}
                              style={{ left: `${clip.startTime * zoom}px`, width: `${clip.duration * zoom}px` }}
                          >
                              <div className="absolute inset-0 opacity-80" style={{ backgroundColor: track.muted ? '#444' : track.color }}></div>
                              {clip.loop && <div className="absolute top-0 right-4 p-1 text-white/70 z-30"><RotateCw size={10} /></div>}
                              <div className="absolute inset-0 z-10">{renderClipContent(clip, track)}</div>
                              <div className="absolute top-0 left-0 z-20 max-w-full w-full bg-black/30"><div className="px-1 py-0.5 text-[9px] text-white truncate select-none font-medium flex items-center gap-1">{clip.name}</div></div>
                              
                              {/* Resize Handles */}
                              {tool === 'MOVE' && isSelected && selectedClipIds.length === 1 && (
                                  <>
                                      {/* Left Handle */}
                                      <div className="absolute top-0 bottom-0 left-0 w-2 cursor-col-resize hover:bg-white/30 z-40 flex items-center justify-center resize-handle group/handle" onMouseDown={(e) => handleResizeStart(e, clip, 'START')}>
                                          <GripVertical size={10} className="text-white/0 group-hover/handle:text-white/80" />
                                      </div>
                                      {/* Right Handle */}
                                      <div className="absolute top-0 bottom-0 right-0 w-2 cursor-col-resize hover:bg-white/30 z-40 flex items-center justify-center resize-handle group/handle" onMouseDown={(e) => handleResizeStart(e, clip, 'END')}>
                                          <GripVertical size={10} className="text-white/0 group-hover/handle:text-white/80" />
                                      </div>
                                  </>
                              )}
                          </div>
                      )})}
                  </div>
                  
                  {track.showAutomation && (
                      <div 
                          className="bg-[#2d2d2d] border-b border-[#111] relative cursor-crosshair box-border"
                          data-automation-track-id={track.id}
                          style={{ minWidth: `${totalBars * pixelsPerBar}px`, height: `${AUTOMATION_HEIGHT}px` }}
                      >
                          <div className="absolute inset-0 pointer-events-none border-b border-dashed border-[#444] top-1/2"></div>
                          <div className="absolute top-1 left-1 text-[9px] text-[#ef4444] font-bold bg-[#111] px-1 rounded-none pointer-events-none">{track.selectedAutomationId === 'pan' ? 'Pan' : track.selectedAutomationId === 'volume' ? 'Vol' : track.selectedAutomationId?.split(':')[1].toUpperCase()}</div>
                          <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ overflow: 'visible' }}>{renderAutomationPoints(track)}</svg>
                      </div>
                  )}
                </div>
            );
          })}
          <div className="h-64 flex items-center justify-center text-[#444] select-none pointer-events-none">End of tracks</div>
        </div>

        {/* Marker Modal Dialog */}
        {markerModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setMarkerModal(null)}>
                <div 
                    className="bg-[#2d2d2d] border border-[#111] rounded-none p-6 w-full max-w-sm" 
                    onClick={e => e.stopPropagation()}
                >
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-bold text-[#d4d4d4] flex items-center gap-2">
                            <Flag size={20} className="text-[#ff7b00]" />
                            Add Marker
                        </h3>
                        <button onClick={() => setMarkerModal(null)} className="text-[#999] hover:text-[#d4d4d4]">
                            <X size={20} />
                        </button>
                    </div>
                    
                    <div className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-[#999] uppercase mb-1">
                                Label Name
                            </label>
                            <input 
                                type='text' 
                                className="w-full bg-[#111] border border-[#111] rounded-none px-3 py-2 text-[#d4d4d4] focus:border-[#ff7b00] outline-none transition-none"
                                value={markerInputValue}
                                onChange={(e) => setMarkerInputValue(e.target.value)}
                                autoFocus
                                onKeyDown={(e) => e.key === 'Enter' && handleMarkerSubmit()}
                            />
                        </div>
                        
                        <div className="flex gap-2">
                            <button 
                                onClick={() => setMarkerModal(null)}
                                className="flex-1 py-2 bg-[#444] hover:bg-[#555] text-[#d4d4d4] rounded-none transition-none font-medium text-sm"
                            >
                                Cancel
                            </button>
                            <button 
                                onClick={handleMarkerSubmit}
                                className="flex-1 py-2 bg-[#ff7b00] hover:bg-[#ff9933] text-black rounded-none transition-none font-medium text-sm flex items-center justify-center gap-1"
                            >
                                <Check size={16} /> Confirm
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        )}

        {contextMenu && (
            <div 
                className="fixed z-[100] w-56 bg-[#2d2d2d] border border-[#111] rounded-none shadow-none py-1 text-sm text-[#d4d4d4] animate-in fade-in zoom-in-95 duration-100"
                style={{ top: contextMenu.y, left: contextMenu.x }}
            >
                {contextMenu.type === 'CLIP' ? (
                    <>
                      {selectedClipIds.length === 2 && (
                          <>
                            <button onClick={(e) => handleMenuAction(e, 'auto-align')} className="w-full text-left px-4 py-2 hover:bg-[#444] flex items-center gap-2 text-[#ff7b00]"><ArrowLeftRight size={14} /> Auto-Align Phase</button>
                            <div className="h-px bg-[#111] my-1" />
                          </>
                      )}
                      <button onClick={(e) => handleMenuAction(e, 'split')} className="w-full text-left px-4 py-2 hover:bg-[#444] flex items-center gap-2"><Scissors size={14} /> Split</button>
                      <button onClick={(e) => handleMenuAction(e, 'copy')} className="w-full text-left px-4 py-2 hover:bg-[#444] flex items-center gap-2"><Copy size={14} /> Copy</button>
                      <button onClick={(e) => handleMenuAction(e, 'loop')} className="w-full text-left px-4 py-2 hover:bg-[#444] flex items-center gap-2"><RotateCw size={14} /> Toggle Loop</button>
                      <button onClick={(e) => handleMenuAction(e, 'rename')} className="w-full text-left px-4 py-2 hover:bg-[#444] flex items-center gap-2"><Pencil size={14} /> Rename</button>
                      <button onClick={(e) => handleMenuAction(e, 'duplicate')} className="w-full text-left px-4 py-2 hover:bg-[#444] flex items-center gap-2"><Copy size={14} /> Duplicate</button>
                      <div className="h-px bg-[#111] my-1" />
                      <button onClick={(e) => handleMenuAction(e, 'flatten')} className="w-full text-left px-4 py-2 hover:bg-[#444] flex items-center gap-2 text-[#ff7b00]"><FileStack size={14} /> Flatten Clip</button>
                      <div className="h-px bg-[#111] my-1" />
                      <button onClick={(e) => handleMenuAction(e, 'delete')} className="w-full text-left px-4 py-2 hover:bg-[#ef4444]/20 text-[#ef4444] flex items-center gap-2"><Trash2 size={14} /> Delete</button>
                    </>
                ) : contextMenu.type === 'BACKGROUND' ? (
                    <>
                      <button onClick={(e) => handleMenuAction(e, 'paste')} disabled={!canPaste} className={`w-full text-left px-4 py-2 flex items-center gap-2 ${canPaste ? 'hover:bg-[#444]' : 'opacity-50 cursor-not-allowed'}`}><ClipboardPaste size={14} /> Paste</button>
                      <div className="h-px bg-[#111] my-1" />
                      <button onClick={(e) => handleMenuAction(e, 'import-file')} className="w-full text-left px-4 py-2 hover:bg-[#444] flex items-center gap-2"><Upload size={14} className="text-[#ff7b00]" /> Import Audio File</button>
                    </>
                ) : (
                    <>
                        <div className="px-4 py-2 text-xs font-bold text-[#999] uppercase">Marker Options</div>
                        <button onClick={(e) => handleMenuAction(e, 'add-marker')} className="w-full text-left px-4 py-2 hover:bg-[#444] flex items-center gap-2"><Flag size={14} className="text-[#ff7b00]" /> Place Marker</button>
                    </>
                )}
            </div>
        )}
      </div>
    </>
  );
};
