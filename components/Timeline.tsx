import React, { useRef, useState } from 'react';
import { Track, AudioClip } from '../types';
import { PIXELS_PER_SECOND, TIMELINE_RULER_HEIGHT } from '../constants';
import { Waveform } from './Waveform';

interface TimelineProps {
  tracks: Track[];
  clips: AudioClip[];
  currentTime: number;
  onClipUpdate: (id: string, newTime: number, newTrackId?: string) => void;
  onFileDrop: (file: File, trackId: string, time: number) => void;
  setClips: React.Dispatch<React.SetStateAction<AudioClip[]>>;
  onSeek: (time: number) => void;
}

export const Timeline: React.FC<TimelineProps> = ({ 
  tracks, 
  clips, 
  currentTime, 
  onClipUpdate, 
  onFileDrop,
  onSeek
}) => {
  const [draggedClipId, setDraggedClipId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState<number>(0);
  const timelineRef = useRef<HTMLDivElement>(null);

  // Seek Handler
  const handleTimelineClick = (e: React.MouseEvent) => {
    // Only seek if clicking the background or ruler, not dragging a clip
    if (draggedClipId) return;
    
    const rect = timelineRef.current?.getBoundingClientRect();
    if (!rect) return;

    const scrollLeft = timelineRef.current?.scrollLeft || 0;
    const clickX = e.clientX - rect.left + scrollLeft;
    
    // Ensure we don't seek to negative time due to margins
    const seekTime = Math.max(0, (clickX / PIXELS_PER_SECOND));
    onSeek(seekTime);
  };

  const handleDrop = (e: React.DragEvent, trackId: string) => {
    e.preventDefault();
    const rect = timelineRef.current?.getBoundingClientRect();
    if (!rect) return;

    const scrollLeft = timelineRef.current?.scrollLeft || 0;
    const clickX = e.clientX - rect.left + scrollLeft;
    const dropTime = Math.max(0, (clickX / PIXELS_PER_SECOND));

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
        const adjustedTime = Math.max(0, dropTime - dragOffset);
        onClipUpdate(draggedClipId, adjustedTime, trackId);
        setDraggedClipId(null);
        setDragOffset(0);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDragStart = (e: React.DragEvent, clip: AudioClip) => {
     const rect = (e.target as HTMLElement).getBoundingClientRect();
     const offsetX = e.clientX - rect.left;
     const offsetTime = offsetX / PIXELS_PER_SECOND;
     
     setDragOffset(offsetTime);
     setDraggedClipId(clip.id);
     e.dataTransfer.effectAllowed = "move";
  };

  return (
    <div 
      className="flex-1 overflow-auto bg-gray-950 relative custom-scrollbar flex flex-col"
      ref={timelineRef}
      onClick={handleTimelineClick}
    >
        {/* Playhead */}
        <div 
            className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-30 pointer-events-none"
            style={{ left: `${currentTime * PIXELS_PER_SECOND}px`, height: '100%' }}
        >
            <div className="w-3 h-3 -ml-1.5 bg-red-500 transform rotate-45 -mt-1.5" />
        </div>

        {/* Ruler */}
        <div className="h-8 border-b border-gray-700 bg-gray-900 sticky top-0 z-20 flex min-w-[2000px] cursor-pointer" >
             {Array.from({ length: 100 }).map((_, i) => (
                 <div key={i} className="relative h-full border-l border-gray-600/50" style={{ width: `${PIXELS_PER_SECOND}px` }}>
                     <span className="absolute top-1 left-1 text-[10px] text-gray-500 font-mono select-none">
                         {i}s
                     </span>
                 </div>
             ))}
        </div>

      <div className="flex flex-col min-w-[2000px] relative">
        {tracks.map(track => (
          <div 
            key={track.id}
            className="relative h-24 border-b border-gray-800 hover:bg-white/5 transition-colors"
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, track.id)}
            style={{ 
                backgroundImage: 'linear-gradient(to right, #374151 1px, transparent 1px)',
                backgroundSize: `${PIXELS_PER_SECOND}px 100%` 
              }}
          >
            {clips.filter(c => c.trackId === track.id).map(clip => (
              <div
                key={clip.id}
                draggable
                onDragStart={(e) => handleDragStart(e, clip)}
                className="absolute top-2 bottom-2 rounded-md overflow-hidden cursor-move border border-white/20 shadow-md group bg-gray-800"
                style={{
                  left: `${clip.startTime * PIXELS_PER_SECOND}px`,
                  width: `${clip.duration * PIXELS_PER_SECOND}px`,
                }}
              >
                <div 
                    className="absolute inset-0 opacity-60"
                    style={{ backgroundColor: track.color }}
                ></div>
                
                {/* Waveform Visualization */}
                <div className="absolute inset-0 z-10">
                    <Waveform 
                        clip={clip} 
                        width={Math.ceil(clip.duration * PIXELS_PER_SECOND)} 
                        height={80} // Approx height of clip container - padding
                        color="#ffffff"
                    />
                </div>

                <div className="absolute top-1 left-1 z-20 max-w-full">
                    <div className="px-1 py-0.5 bg-black/40 rounded text-[10px] text-white truncate select-none font-medium">
                        {clip.name}
                    </div>
                </div>
              </div>
            ))}
          </div>
        ))}
        {/* Empty space at bottom */}
        <div className="h-64 flex items-center justify-center text-gray-800 select-none pointer-events-none">
             End of tracks
        </div>
      </div>
    </div>
  );
};