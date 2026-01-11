
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { TrackControl } from './components/TrackControl';
import { Timeline } from './components/Timeline';
import { Transport } from './components/Transport';
import { ClipEditor } from './components/ClipEditor';
import { TrackEditor } from './components/TrackEditor';
import { MasterVisualizer } from './components/MasterVisualizer';
import { Track, AudioClip, PlaybackState, ToolType, HistoryState, AutomationPoint, LoopRegion } from './types';
import { TRACK_COLORS, TRACK_HEADER_WIDTH, TIMELINE_RULER_HEIGHT } from './constants';
import { audioService } from './services/audioEngine';
import { Plus } from 'lucide-react';

const INITIAL_TRACKS: Track[] = [
  { id: 'track-1', name: 'Drums', color: TRACK_COLORS[0], volume: 0.8, muted: false, soloed: false, plugins: [], automation: { volume: [] }, showAutomation: false, selectedAutomationId: 'volume' },
  { id: 'track-2', name: 'Bass', color: TRACK_COLORS[1], volume: 0.8, muted: false, soloed: false, plugins: [], automation: { volume: [] }, showAutomation: false, selectedAutomationId: 'volume' },
  { id: 'track-3', name: 'Melody', color: TRACK_COLORS[4], volume: 0.8, muted: false, soloed: false, plugins: [], automation: { volume: [] }, showAutomation: false, selectedAutomationId: 'volume' },
  { id: 'track-4', name: 'Vocals', color: TRACK_COLORS[5], volume: 0.8, muted: false, soloed: false, plugins: [], automation: { volume: [] }, showAutomation: false, selectedAutomationId: 'volume' },
];

const MASTER_TRACK: Track = {
    id: 'master',
    name: 'Master',
    color: '#1e293b',
    volume: 0.8,
    muted: false,
    soloed: false,
    plugins: [],
    isMaster: true,
    automation: { volume: [] },
    showAutomation: false,
    selectedAutomationId: 'volume'
};

function App() {
  // --- Core State ---
  const [tracks, setTracks] = useState<Track[]>([...INITIAL_TRACKS, MASTER_TRACK]);
  const [clips, setClips] = useState<AudioClip[]>([]);
  
  // --- UI/Tool State ---
  const [bpm, setBpm] = useState<number>(120);
  const [zoom, setZoom] = useState<number>(50); // Pixels per second
  const [snap, setSnap] = useState<boolean>(true);
  const [tool, setTool] = useState<ToolType>('MOVE');
  const [isExporting, setIsExporting] = useState(false);
  
  // Metronome State
  const [isMetronomeOn, setIsMetronomeOn] = useState(false);
  const [countInMeasures, setCountInMeasures] = useState(1);
  
  // Loop State (Default measures 1-4 -> 0s to 8s at 120bpm)
  const [loopRegion, setLoopRegion] = useState<LoopRegion>({ start: 0, end: 8, enabled: false });
  // Ref for loop region to access in RAF without re-binding
  const loopRegionRef = useRef(loopRegion);
  
  useEffect(() => {
      loopRegionRef.current = loopRegion;
  }, [loopRegion]);

  // Recording State
  const [armedTrackId, setArmedTrackId] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
  const [clipboardClip, setClipboardClip] = useState<AudioClip | null>(null);
  const [editingTrackId, setEditingTrackId] = useState<string | null>(null);

  // --- Scroll Synchronization Refs ---
  const trackHeaderRef = useRef<HTMLDivElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const navigatorRef = useRef<HTMLDivElement>(null);

  // --- History State ---
  const [history, setHistory] = useState<HistoryState[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  // --- Playback State ---
  const [playbackState, setPlaybackState] = useState<PlaybackState>({
    isPlaying: false,
    currentTime: 0
  });

  const rafRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0); 
  const pauseTimeRef = useRef<number>(0); 
  const recordStartTimeRef = useRef<number>(0);

  // Initialize Audio Nodes
  useEffect(() => {
    tracks.forEach(track => {
      audioService.createTrackNodes(track.id, track.isMaster);
      audioService.updateTrackVolume(track.id, track.volume);
      audioService.updateTrackPlugins(track.id, track.plugins);
    });
  }, []); 
  
  // --- Scroll Sync ---
  const handleTimelineScroll = (e: React.UIEvent<HTMLDivElement>) => {
      const target = e.target as HTMLDivElement;
      if (trackHeaderRef.current) {
          trackHeaderRef.current.scrollTop = target.scrollTop;
      }
      if (navigatorRef.current) {
          navigatorRef.current.scrollLeft = target.scrollLeft;
      }
  };
  
  const handleNavigatorScroll = (e: React.UIEvent<HTMLDivElement>) => {
      const target = e.target as HTMLDivElement;
      if (timelineRef.current) {
          timelineRef.current.scrollLeft = target.scrollLeft;
      }
  };
  
  // --- Undo/Redo System ---
  const pushHistory = useCallback((newTracks: Track[], newClips: AudioClip[]) => {
      const newState = { tracks: newTracks, clips: newClips };
      const currentHistory = history.slice(0, historyIndex + 1);
      setHistory([...currentHistory, newState]);
      setHistoryIndex(prev => prev + 1);
  }, [history, historyIndex]);

  useEffect(() => {
      if (history.length === 0) {
          pushHistory(tracks, clips);
      }
  }, []);

  const handleUndo = () => {
      if (historyIndex > 0) {
          const prevState = history[historyIndex - 1];
          setTracks(prevState.tracks);
          setClips(prevState.clips);
          setHistoryIndex(historyIndex - 1);
          prevState.tracks.forEach(t => {
               audioService.updateTrackVolume(t.id, t.volume);
               audioService.updateTrackPlugins(t.id, t.plugins);
          });
          audioService.applyRealtimeSoloMute(prevState.tracks);
          if (playbackState.isPlaying) handleStop(); 
      }
  };

  const handleRedo = () => {
      if (historyIndex < history.length - 1) {
          const nextState = history[historyIndex + 1];
          setTracks(nextState.tracks);
          setClips(nextState.clips);
          setHistoryIndex(historyIndex - 1);
          nextState.tracks.forEach(t => {
               audioService.updateTrackVolume(t.id, t.volume);
               audioService.updateTrackPlugins(t.id, t.plugins);
          });
          audioService.applyRealtimeSoloMute(nextState.tracks);
          if (playbackState.isPlaying) handleStop();
      }
  };

  const updateStateWithHistory = (newTracks: Track[], newClips: AudioClip[]) => {
      setTracks(newTracks);
      setClips(newClips);
      pushHistory(newTracks, newClips);
  };

  // --- Playback Logic ---
  
  const startPlayback = useCallback((startAt: number) => {
    audioService.stopPlayback(); 
    if (rafRef.current) cancelAnimationFrame(rafRef.current);

    audioService.play(clips, tracks, startAt);
    
    // Schedule metronome if enabled
    if (isMetronomeOn) {
        audioService.scheduleMetronome(bpm, audioService.getContext().currentTime, 300); // Schedule 5 mins of clicks
    }
    
    startTimeRef.current = audioService.getContext().currentTime;
    setPlaybackState(prev => ({ ...prev, isPlaying: true, currentTime: startAt }));
    
    const animate = () => {
      const now = audioService.getContext().currentTime;
      const elapsed = now - startTimeRef.current;
      const newTime = startAt + elapsed;
      
      // Loop Check using REF to avoid closure staleness
      if (loopRegionRef.current.enabled && newTime >= loopRegionRef.current.end) {
          startPlayback(loopRegionRef.current.start);
          return; 
      }
      
      setPlaybackState(prev => ({ ...prev, currentTime: newTime }));
      rafRef.current = requestAnimationFrame(animate);
    };
    
    rafRef.current = requestAnimationFrame(animate);
  }, [clips, tracks, bpm, isMetronomeOn]); 

  const handleSeek = useCallback((time: number) => {
      pauseTimeRef.current = time;
      setPlaybackState(prev => ({ ...prev, currentTime: time }));
      
      // If playing, we need to restart playback at new position
      if (playbackState.isPlaying) {
           startPlayback(time);
      }
  }, [playbackState.isPlaying, startPlayback]);

  const handlePlay = useCallback(async () => {
    await audioService.resume();
    startPlayback(pauseTimeRef.current);
  }, [startPlayback]);

  const handleStop = useCallback(async () => {
    audioService.stop();
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    
    if (isRecording) {
       await finishRecording();
    }
    
    setPlaybackState(prev => {
        pauseTimeRef.current = prev.currentTime; 
        return { ...prev, isPlaying: false };
    });
  }, [isRecording]);

  const handleRewind = () => {
      const newTime = Math.max(0, playbackState.currentTime - 5);
      handleSeek(newTime);
  };

  const handleFastForward = () => {
      const newTime = playbackState.currentTime + 5;
      handleSeek(newTime);
  };

  // --- Recording Logic ---
  const handleArmTrack = async (trackId: string) => {
      if (armedTrackId === trackId) {
          setArmedTrackId(null);
          audioService.disableMonitoring();
      } else {
          try {
              setArmedTrackId(trackId);
              await audioService.enableMonitoring(trackId); 
          } catch(e) {
              alert("Could not access microphone.");
              setArmedTrackId(null);
          }
      }
  };

  const handleTransportRecord = async () => {
      if (isRecording) {
          handleStop();
      } else {
          if (!armedTrackId) {
              alert("Please arm a track first.");
              return;
          }
          try {
            await audioService.resume();

            // Count-In Logic
            if (countInMeasures > 0) {
                 await audioService.playCountIn(bpm, countInMeasures);
            }

            audioService.startRecording();
            setIsRecording(true);
            recordStartTimeRef.current = pauseTimeRef.current;
            startPlayback(pauseTimeRef.current);
          } catch(e) {
              console.error(e);
          }
      }
  };

  const finishRecording = async () => {
      if (!armedTrackId) {
          setIsRecording(false);
          return;
      }
      const blob = await audioService.stopRecording();
      const startTime = recordStartTimeRef.current;
      if (blob) {
          try {
              const buffer = await audioService.decodeBlob(blob);
              const newClip: AudioClip = {
                  id: uuidv4(),
                  trackId: armedTrackId,
                  buffer: buffer,
                  name: 'Recording',
                  startTime: startTime,
                  duration: buffer.duration,
                  offset: 0,
                  gain: 1,
                  pan: 0,
                  playbackRate: 1,
                  loop: false
              };
              updateStateWithHistory(tracks, [...clips, newClip]);
          } catch (e) {
              console.error("Failed to process recording", e);
          }
      }
      setIsRecording(false);
  };

  // --- Track Management ---
  const addTrack = () => {
    const newTrack: Track = {
      id: `track-${Date.now()}`,
      name: `Track ${tracks.length}`, 
      color: TRACK_COLORS[(tracks.length - 1) % TRACK_COLORS.length],
      volume: 0.8,
      muted: false,
      soloed: false,
      plugins: [],
      automation: { volume: [] },
      showAutomation: false,
      selectedAutomationId: 'volume'
    };
    
    const newTracks = [...tracks];
    const master = newTracks.pop();
    newTracks.push(newTrack);
    if (master) newTracks.push(master);
    
    audioService.createTrackNodes(newTrack.id);
    updateStateWithHistory(newTracks, clips);
  };

  const updateTrack = (id: string, updates: Partial<Track>) => {
    const newTracks = tracks.map(t => {
        if (t.id === id) {
            if (updates.volume !== undefined) audioService.updateTrackVolume(id, updates.volume);
            if (updates.plugins !== undefined) audioService.updateTrackPlugins(id, updates.plugins);
            return { ...t, ...updates };
        }
        return t;
    });
    setTracks(newTracks);
    if (updates.muted !== undefined || updates.soloed !== undefined) {
        audioService.applyRealtimeSoloMute(newTracks);
    }
  };
  
  const toggleAutomation = (trackId: string) => {
      const newTracks = tracks.map(t => t.id === trackId ? { ...t, showAutomation: !t.showAutomation } : t);
      setTracks(newTracks);
  };
  
  const handleAddAutomationPoint = (trackId: string, paramId: string, point: AutomationPoint) => {
      const newTracks = tracks.map(t => {
          if (t.id === trackId) {
             const points = t.automation?.[paramId] ? [...t.automation[paramId]] : [];
             const existingIdx = points.findIndex(p => Math.abs(p.time - point.time) < 0.1);
             if (existingIdx >= 0) points[existingIdx] = point;
             else points.push(point);
             return { ...t, automation: { ...t.automation, [paramId]: points } };
          }
          return t;
      });
      updateStateWithHistory(newTracks, clips);
      if (playbackState.isPlaying) startPlayback(playbackState.currentTime);
  };

  const deleteTrack = (id: string) => {
    if (id === 'master') return;
    audioService.removeTrackNodes(id);
    const newTracks = tracks.filter(t => t.id !== id);
    const newClips = clips.filter(c => c.trackId !== id);
    if (editingTrackId === id) setEditingTrackId(null);
    updateStateWithHistory(newTracks, newClips);
  };

  // --- Clip Management ---
  const handleFileDrop = async (file: File, trackId: string, time: number) => {
    if (trackId === 'master') return;
    try {
      const buffer = await audioService.loadFile(file);
      const newClip: AudioClip = {
        id: uuidv4(),
        trackId,
        buffer,
        name: file.name,
        startTime: time,
        duration: buffer.duration,
        offset: 0,
        gain: 1,
        pan: 0,
        playbackRate: 1,
        loop: false
      };
      updateStateWithHistory(tracks, [...clips, newClip]);
    } catch (e) {
      console.error("Failed to load audio", e);
      alert("Could not load audio file.");
    }
  };

  const updateClip = (id: string, newTime: number, newTrackId?: string) => {
    if (newTrackId === 'master') return;
    const newClips = clips.map(c => c.id === id ? { ...c, startTime: newTime, trackId: newTrackId || c.trackId } : c);
    setClips(newClips);
  };
  
  const updateClipProps = (id: string, updates: Partial<AudioClip>) => {
      const newClips = clips.map(c => c.id === id ? { ...c, ...updates } : c);
      setClips(newClips);
      if (playbackState.isPlaying) startPlayback(playbackState.currentTime); 
  };
  
  const handleClipResize = (clipId: string, newDuration: number) => {
      const newClips = clips.map(c => c.id === clipId ? { ...c, duration: newDuration } : c);
      setClips(newClips);
  };

  const deleteClip = (id: string) => {
      const newClips = clips.filter(c => c.id !== id);
      if (selectedClipId === id) setSelectedClipId(null);
      updateStateWithHistory(tracks, newClips);
  };

  const duplicateClip = (id: string) => {
      const original = clips.find(c => c.id === id);
      if (!original) return;
      const newClip: AudioClip = {
          ...original,
          id: uuidv4(),
          startTime: original.startTime + original.duration,
          name: `${original.name} (Copy)`
      };
      updateStateWithHistory(tracks, [...clips, newClip]);
  };

  const renameClip = (id: string, newName: string) => {
      const newClips = clips.map(c => c.id === id ? { ...c, name: newName } : c);
      updateStateWithHistory(tracks, newClips);
  };

  const handleSplitClip = (clipId: string, splitTime: number) => {
      const clip = clips.find(c => c.id === clipId);
      if (!clip) return;
      const relativeSplit = splitTime - clip.startTime;
      if (relativeSplit <= 0 || relativeSplit >= (clip.duration / clip.playbackRate)) return;
      
      const firstDuration = relativeSplit * clip.playbackRate;
      const leftClip: AudioClip = { ...clip, id: uuidv4(), duration: firstDuration, name: clip.name };
      const rightClip: AudioClip = { ...clip, id: uuidv4(), startTime: splitTime, offset: clip.offset + firstDuration, duration: clip.duration - firstDuration, name: clip.name };

      const newClips = clips.filter(c => c.id !== clipId);
      newClips.push(leftClip, rightClip);
      updateStateWithHistory(tracks, newClips);
  };
  
  const handleCopyClip = (id: string) => {
      const clip = clips.find(c => c.id === id);
      if (clip) setClipboardClip(clip);
  };
  
  const handlePasteClip = (time: number, trackId: string) => {
      if (!clipboardClip || trackId === 'master') return;
      const newClip: AudioClip = {
          ...clipboardClip,
          id: uuidv4(),
          startTime: time,
          trackId: trackId,
          name: `${clipboardClip.name} (Paste)`
      };
      updateStateWithHistory(tracks, [...clips, newClip]);
  };
  
  const handleLoopToggle = (id: string) => {
      const clip = clips.find(c => c.id === id);
      if (clip) {
          const isLooping = !clip.loop;
          const baseDuration = clip.buffer.duration / clip.playbackRate;
          const newDuration = isLooping ? clip.duration + baseDuration : clip.duration;
          const newClips = clips.map(c => c.id === id ? { ...c, loop: isLooping, duration: newDuration } : c);
          updateStateWithHistory(tracks, newClips);
      }
  };

  // --- Export ---
  const handleExport = async () => {
      setIsExporting(true);
      if (playbackState.isPlaying) handleStop();
      try {
          const blob = await audioService.renderOffline(clips, tracks);
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `Project_${new Date().getTime()}.wav`;
          a.click();
          URL.revokeObjectURL(url);
      } catch (e) {
          console.error("Export failed", e);
          alert("Export failed. See console.");
      } finally {
          setIsExporting(false);
      }
  };

  // --- Derived State & Variables ---
  const regularTracks = tracks.filter(t => !t.isMaster);
  const masterTrack = tracks.find(t => t.isMaster) || MASTER_TRACK;
  const selectedClip = clips.find(c => c.id === selectedClipId) || null;
  const editingTrack = tracks.find(t => t.id === editingTrackId) || null;

  const totalDuration = Math.max(300, ...clips.map(c => c.startTime + c.duration));
  const secondsPerBeat = 60 / bpm;
  const secondsPerBar = secondsPerBeat * 4; 
  const totalBars = Math.ceil(totalDuration / secondsPerBar) + 5;
  const pixelsPerBar = secondsPerBar * zoom;
  const timelineWidth = totalBars * pixelsPerBar;

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-gray-950 text-white font-sans selection:bg-purple-500/30">
      <Transport 
        isPlaying={playbackState.isPlaying}
        onPlay={handlePlay}
        onStop={handleStop}
        onRewind={handleRewind}
        onFastForward={handleFastForward}
        isRecording={isRecording}
        onRecord={handleTransportRecord}
        currentTime={playbackState.currentTime}
        bpm={bpm}
        setBpm={setBpm}
        tool={tool}
        setTool={setTool}
        zoom={zoom}
        setZoom={setZoom}
        snap={snap}
        setSnap={setSnap}
        onUndo={handleUndo}
        onRedo={handleRedo}
        canUndo={historyIndex > 0}
        canRedo={historyIndex < history.length - 1}
        onExport={handleExport}
        isExporting={isExporting}
        loopRegion={loopRegion}
        setLoopRegion={setLoopRegion}
        isMetronomeOn={isMetronomeOn}
        toggleMetronome={() => setIsMetronomeOn(!isMetronomeOn)}
        countInMeasures={countInMeasures}
        setCountInMeasures={setCountInMeasures}
      />

      {/* Main Workspace: Tracks & Timeline */}
      <div className="flex flex-1 overflow-hidden relative border-b border-gray-800">
        {/* Track Headers */}
        <div 
            ref={trackHeaderRef}
            className="flex-shrink-0 bg-gray-900 border-r border-gray-700 overflow-y-hidden z-10 shadow-xl"
            style={{ width: TRACK_HEADER_WIDTH }}
        >
          {/* Spacer to align with Timeline Ruler */}
          <div 
             className="flex-shrink-0 border-b border-gray-700 bg-gray-900 box-border sticky top-0 z-20"
             style={{ height: `${TIMELINE_RULER_HEIGHT}px` }}
          />

          {regularTracks.map(track => (
            <TrackControl 
              key={track.id} 
              track={track} 
              onUpdate={updateTrack}
              onDelete={deleteTrack}
              isArmed={armedTrackId === track.id}
              isRecordingGlobal={isRecording}
              onArmToggle={() => handleArmTrack(track.id)}
              onOpenEditor={setEditingTrackId}
              onToggleAutomation={toggleAutomation}
            />
          ))}
          <div className="p-3">
             <button 
                onClick={addTrack}
                className="w-full py-3 border border-dashed border-gray-700 rounded-lg text-gray-500 hover:text-white hover:border-gray-500 hover:bg-gray-800 flex items-center justify-center gap-2 text-sm transition-all group"
                title="Add a new audio track"
             >
                <div className="p-1 rounded bg-gray-800 group-hover:bg-gray-700 transition-colors"><Plus size={14} /></div>
                <span>Add Track</span>
             </button>
          </div>
        </div>

        {/* Timeline (Scrollbar hidden via CSS in Timeline.tsx) */}
        <div className="flex-1 overflow-hidden relative flex flex-col">
            <div 
                ref={timelineRef}
                onScroll={handleTimelineScroll}
                className="flex-1 overflow-auto custom-scrollbar-hidden" // Class to hide scrollbar
            >
                <Timeline 
                    tracks={regularTracks}
                    clips={clips}
                    currentTime={playbackState.currentTime}
                    onClipUpdate={updateClip}
                    onFileDrop={handleFileDrop}
                    setClips={setClips}
                    onSeek={handleSeek}
                    bpm={bpm}
                    zoom={zoom}
                    setZoom={setZoom}
                    snap={snap}
                    tool={tool}
                    onDeleteClip={deleteClip}
                    onDuplicateClip={duplicateClip}
                    onRenameClip={renameClip}
                    onSplitClip={handleSplitClip}
                    onAddAutomationPoint={handleAddAutomationPoint}
                    onSelectClip={(id) => { setSelectedClipId(id); if (id) setEditingTrackId(null); }}
                    selectedClipId={selectedClipId}
                    onCopyClip={handleCopyClip}
                    onPasteClip={handlePasteClip}
                    canPaste={!!clipboardClip}
                    onLoopClip={handleLoopToggle}
                    onClipResize={handleClipResize}
                    loopRegion={loopRegion}
                    setLoopRegion={setLoopRegion}
                />
            </div>
        </div>
      </div>

      {/* Fixed Bottom Master Section */}
      <div className="h-44 bg-gray-900 border-t-2 border-gray-800 flex flex-col z-20 shadow-[0_-5px_15px_rgba(0,0,0,0.5)]">
         {/* Master Row */}
         <div className="flex flex-1 overflow-hidden">
             {/* Master Control (Left) */}
             <div className="flex-shrink-0 border-r border-gray-800" style={{ width: TRACK_HEADER_WIDTH }}>
                <TrackControl 
                  track={masterTrack}
                  onUpdate={updateTrack}
                  onDelete={() => {}}
                  isArmed={false}
                  isRecordingGlobal={false}
                  onArmToggle={() => {}}
                  onOpenEditor={setEditingTrackId}
                  onToggleAutomation={() => {}}
                />
             </div>
             {/* Master Visualizer (Right) */}
             <div className="flex-1 p-2 bg-gray-900 flex items-center justify-center">
                 <MasterVisualizer isPlaying={playbackState.isPlaying} />
             </div>
         </div>

         {/* Navigator / Scrollbar (Bottom Fixed) */}
         <div className="h-5 bg-gray-950 border-t border-gray-800">
             <div 
                ref={navigatorRef}
                onScroll={handleNavigatorScroll}
                className="w-full h-full overflow-x-auto overflow-y-hidden custom-scrollbar"
                title="Timeline Navigator"
             >
                <div style={{ width: timelineWidth, height: '1px' }}></div>
             </div>
         </div>
      </div>

      {/* Editors */}
      {editingTrack ? (
          <TrackEditor 
            track={editingTrack} 
            onUpdate={updateTrack} 
            onClose={() => setEditingTrackId(null)} 
          />
      ) : (
          <ClipEditor 
            clip={selectedClip} 
            onUpdate={updateClipProps} 
            onClose={() => setSelectedClipId(null)}
          />
      )}
    </div>
  );
}

export default App;
