
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { TrackControl } from './components/TrackControl';
import { Timeline } from './components/Timeline';
import { Transport } from './components/Transport';
import { ClipEditor } from './components/ClipEditor';
import { TrackEditor } from './components/TrackEditor';
import { MasterVisualizer } from './components/MasterVisualizer';
import { SettingsModal } from './components/SettingsModal';
import { VisualizerSettings } from './components/VisualizerSettings';
import { Track, AudioClip, PlaybackState, ToolType, HistoryState, AutomationPoint, LoopRegion } from './types';
import { TRACK_COLORS, TRACK_HEADER_WIDTH, TIMELINE_RULER_HEIGHT } from './constants';
import { audioService } from './services/audioEngine';
import { Plus } from 'lucide-react';

const INITIAL_TRACKS: Track[] = [
  { id: 'track-1', name: 'Drums', color: TRACK_COLORS[0], volume: 1.0, muted: false, soloed: false, plugins: [], automation: { volume: [] }, showAutomation: false, selectedAutomationId: 'volume' },
  { id: 'track-2', name: 'Bass', color: TRACK_COLORS[1], volume: 1.0, muted: false, soloed: false, plugins: [], automation: { volume: [] }, showAutomation: false, selectedAutomationId: 'volume' },
  { id: 'track-3', name: 'Melody', color: TRACK_COLORS[4], volume: 1.0, muted: false, soloed: false, plugins: [], automation: { volume: [] }, showAutomation: false, selectedAutomationId: 'volume' },
  { id: 'track-4', name: 'Vocals', color: TRACK_COLORS[5], volume: 1.0, muted: false, soloed: false, plugins: [], automation: { volume: [] }, showAutomation: false, selectedAutomationId: 'volume' },
];

const MASTER_TRACK: Track = {
    id: 'master',
    name: 'Master',
    color: '#1e293b',
    volume: 1.0,
    muted: false,
    soloed: false,
    plugins: [
        {
            id: 'master-limiter',
            type: 'LIMITER',
            enabled: true,
            params: { threshold: -0.1, release: 0.1 }
        }
    ],
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
  const [bpm, setBpm] = useState<number>(90);
  const [zoom, setZoom] = useState<number>(50); // Pixels per second
  const [snap, setSnap] = useState<boolean>(true);
  const [tool, setTool] = useState<ToolType>('MOVE');
  const [isExporting, setIsExporting] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [timeMarkers, setTimeMarkers] = useState<{time: number, label: string}[]>([]);
  
  // Transport Display State
  const [followPlayhead, setFollowPlayhead] = useState(true);
  const [timeDisplayFormat, setTimeDisplayFormat] = useState<'TIME' | 'BARS'>('TIME');
  
  // Refs for transport state to be accessible in animation loop
  const followPlayheadRef = useRef(followPlayhead);
  const zoomRef = useRef(zoom);

  useEffect(() => { followPlayheadRef.current = followPlayhead; }, [followPlayhead]);
  useEffect(() => { zoomRef.current = zoom; }, [zoom]);
  
  // Visualizer Config
  const [isVisualizerSettingsOpen, setIsVisualizerSettingsOpen] = useState(false);
  const [visualizerConfig, setVisualizerConfig] = useState<{mode: 'SPECTRUM' | 'WAVEFORM' | 'OFF', colorStart: string, colorEnd: string}>({
      mode: 'OFF',
      colorStart: '#3b82f6',
      colorEnd: '#ef4444'
  });

  // Metronome State
  const [isMetronomeOn, setIsMetronomeOn] = useState(false);
  const [countInMeasures, setCountInMeasures] = useState(1);
  
  // Loop State (Default measures 1-4 -> 0s to 8s at 120bpm)
  const [loopRegion, setLoopRegion] = useState<LoopRegion>({ start: 0, end: 8, enabled: false });
  // Ref for loop region to access in RAF without re-binding
  const loopRegionRef = useRef(loopRegion);
  const markersRef = useRef(timeMarkers);
  
  useEffect(() => {
      loopRegionRef.current = loopRegion;
  }, [loopRegion]);
  
  useEffect(() => {
      markersRef.current = timeMarkers;
  }, [timeMarkers]);

  // Recording State
  const [armedTrackId, setArmedTrackId] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  
  // Selection State (Multi-select)
  const [selectedClipIds, setSelectedClipIds] = useState<string[]>([]);
  const [isClipEditorOpen, setIsClipEditorOpen] = useState(false); // Only open on double click
  const [clipboardClips, setClipboardClips] = useState<AudioClip[]>([]);
  const [editingTrackId, setEditingTrackId] = useState<string | null>(null);

  // --- Refs ---
  const scrollContainerRef = useRef<HTMLDivElement>(null);
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
  const recordStartTimeRef = useRef<number>(0); // Timeline position where recording block starts
  const recordPreRollRef = useRef<number>(0); // How much physical audio was captured BEFORE timeline start
  
  // Initialize Audio Nodes
  useEffect(() => {
    tracks.forEach(track => {
      audioService.createTrackNodes(track.id, track.isMaster);
      audioService.updateTrackVolume(track.id, track.volume);
      audioService.updateTrackPlugins(track.id, track.plugins);
    });
  }, []); 

  useEffect(() => {
    audioService.setBpm(bpm);
  }, [bpm]);

  // --- Navigator Scroll Sync ---
  const handleMainScroll = () => {
      if (scrollContainerRef.current && navigatorRef.current) {
          navigatorRef.current.scrollLeft = scrollContainerRef.current.scrollLeft;
      }
  };

  const handleNavigatorScroll = (e: React.UIEvent<HTMLDivElement>) => {
      const target = e.target as HTMLDivElement;
      if (scrollContainerRef.current) {
          scrollContainerRef.current.scrollLeft = target.scrollLeft;
      }
  };
  
  // --- Smart Zoom Handling ---
  const handleZoomChange = useCallback((newZoom: number) => {
      const clampedZoom = Math.max(1, Math.min(1000, newZoom));
      setZoom(clampedZoom);

      // Center playhead logic
      if (scrollContainerRef.current) {
          requestAnimationFrame(() => {
              if (scrollContainerRef.current) {
                  const containerWidth = scrollContainerRef.current.clientWidth;
                  const playheadX = playbackState.currentTime * clampedZoom;
                  // Center playhead: target scroll is playheadX - halfWidth
                  const targetScroll = Math.max(0, playheadX - (containerWidth / 2));
                  scrollContainerRef.current.scrollLeft = targetScroll;
              }
          });
      }
  }, [playbackState.currentTime]);
  
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
      
      // Auto-Scroll / Follow Playhead
      if (followPlayheadRef.current && scrollContainerRef.current) {
          const containerWidth = scrollContainerRef.current.clientWidth;
          const currentZoom = zoomRef.current;
          const playheadX = newTime * currentZoom;
          // Center the playhead
          const targetScroll = playheadX - (containerWidth / 2);
          
          // Only scroll if strictly increasing to avoid jitter, or just set it
          if (Math.abs(scrollContainerRef.current.scrollLeft - targetScroll) > 1) {
              scrollContainerRef.current.scrollLeft = Math.max(0, targetScroll);
          }
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
              // Critical: Await monitoring setup BEFORE updating state to ensure visualizer is ready
              await audioService.enableMonitoring(trackId); 
              setArmedTrackId(trackId);
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

            // 1. Start Recording Physically FIRST to capture pre-roll/setup
            await audioService.startRecording();
            const sysRecordStart = audioService.getContext().currentTime;

            // 2. Count-In Logic (if enabled)
            if (countInMeasures > 0) {
                 await audioService.playCountIn(bpm, countInMeasures);
            } else {
                 // Even without count-in, wait a tiny bit to ensure we capture the transient of the first beat
                 await new Promise(r => setTimeout(r, 100));
            }
            
            // 3. Start Playback Transport
            const sysPlaybackStart = audioService.getContext().currentTime;
            
            // Calculate how much audio we captured before the transport actually started
            const preRollDuration = sysPlaybackStart - sysRecordStart;

            setIsRecording(true);
            recordStartTimeRef.current = pauseTimeRef.current;
            recordPreRollRef.current = preRollDuration;
            
            startPlayback(pauseTimeRef.current);
          } catch(e) {
              console.error("Recording failed to start", e);
              alert("Failed to start recording. Please check microphone permissions.");
          }
      }
  };

  const finishRecording = async () => {
      if (!armedTrackId) {
          setIsRecording(false);
          return;
      }
      const blob = await audioService.stopRecording();
      const timelineStart = recordStartTimeRef.current;
      const preRoll = recordPreRollRef.current;
      
      if (blob && blob.size > 0) {
          try {
              const buffer = await audioService.decodeBlob(blob);
              
              // --- Latency Compensation & Placement ---
              const latency = audioService.latencySeconds;
              
              // The buffer contains [PreRoll] + [Performance].
              // The Performance started at buffer time = preRoll + latency (approx).
              // We want this point to align with `timelineStart`.
              
              // Theoretical Offset into buffer for T=timelineStart
              let targetOffset = preRoll + latency;
              
              // Safety: Reveal a bit of the pre-roll to catch early transients (rushing).
              // We shift the clip START TIME back by `safetyMargin` and reduce OFFSET by same amount.
              const safetyMargin = Math.min(preRoll, 0.2); // Up to 200ms
              
              const finalClipStart = timelineStart - safetyMargin;
              const finalClipOffset = targetOffset - safetyMargin;

              // Duration needs to be calculated based on what's left in the buffer
              // Buffer Duration - Offset = Playable Length
              // But we added safetyMargin to length by reducing offset.
              const finalDuration = Math.max(0, buffer.duration - finalClipOffset);

              const newClip: AudioClip = {
                  id: uuidv4(),
                  trackId: armedTrackId,
                  buffer: buffer,
                  name: 'Recording',
                  startTime: finalClipStart, // Can be negative or < timelineStart
                  duration: finalDuration,
                  offset: Math.max(0, finalClipOffset),
                  gain: 1,
                  pan: 0,
                  playbackRate: 1,
                  loop: false
              };
              
              if (finalDuration > 0) {
                  updateStateWithHistory(tracks, [...clips, newClip]);
              }
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
      volume: 1.0,
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

  // Batch Update for moving multiple clips
  const updateClips = (updates: { id: string, startTime: number, trackId?: string }[]) => {
      const newClips = clips.map(c => {
          const update = updates.find(u => u.id === c.id);
          if (update) {
              // Prevent moving to master track
              if (update.trackId === 'master') return c;
              return { ...c, startTime: update.startTime, trackId: update.trackId || c.trackId };
          }
          return c;
      });
      setClips(newClips);
  };
  
  const updateClipProps = (id: string, updates: Partial<AudioClip>) => {
      const newClips = clips.map(c => {
          if (c.id === id) {
              const updatedClip = { ...c, ...updates };
              // If playbackRate changed, adjust duration to match the new rate
              if (updates.playbackRate !== undefined && updates.playbackRate !== c.playbackRate) {
                  const ratio = c.playbackRate / updates.playbackRate;
                  updatedClip.duration = c.duration * ratio;
              }
              return updatedClip;
          }
          return c;
      });
      setClips(newClips);
      if (playbackState.isPlaying) startPlayback(playbackState.currentTime); 
  };
  
  // Refactored to handle Left/Right resizing
  const handleClipResize = (clipId: string, newStartTime: number, newDuration: number, newOffset: number) => {
      const newClips = clips.map(c => {
          if (c.id === clipId) {
             return { 
                 ...c, 
                 startTime: newStartTime, 
                 duration: newDuration, 
                 offset: newOffset 
             };
          }
          return c;
      });
      setClips(newClips);
  };
  
  const handleAutoAlign = () => {
      if (selectedClipIds.length !== 2) return;
      
      const clipA = clips.find(c => c.id === selectedClipIds[0]);
      const clipB = clips.find(c => c.id === selectedClipIds[1]);
      
      if (!clipA || !clipB) return;
      
      // Determine Reference (Upper Track)
      const trackIdxA = tracks.findIndex(t => t.id === clipA.trackId);
      const trackIdxB = tracks.findIndex(t => t.id === clipB.trackId);
      
      let refClip = clipA;
      let targetClip = clipB;
      
      // If B is above A, B is ref. If same track, Left is ref.
      if (trackIdxB < trackIdxA) {
          refClip = clipB;
          targetClip = clipA;
      } else if (trackIdxA === trackIdxB) {
          if (clipB.startTime < clipA.startTime) {
              refClip = clipB;
              targetClip = clipA;
          }
      }
      
      // Calculate Overlap Region
      const overlapStart = Math.max(refClip.startTime, targetClip.startTime);
      const overlapEnd = Math.min(refClip.startTime + refClip.duration, targetClip.startTime + targetClip.duration);
      const duration = overlapEnd - overlapStart;
      
      if (duration < 0.2) {
          alert("Selected clips do not overlap enough to align.");
          return;
      }
      
      // Extract Audio Data from Overlap
      // Limit analysis to 3 seconds to keep UI responsive
      const analysisDuration = Math.min(duration, 3.0);
      const sampleRate = refClip.buffer.sampleRate; // Assume matching sample rates for simplicity
      
      const getClipData = (clip: AudioClip) => {
           // Calculate start sample in buffer
           // Time from clip start to overlap start
           const relativeStart = overlapStart - clip.startTime;
           // Add internal offset
           const bufferTimeStart = relativeStart + clip.offset;
           
           const startSample = Math.floor(bufferTimeStart * sampleRate);
           const lengthSamples = Math.floor(analysisDuration * sampleRate);
           
           // Handle case where we might go out of bounds (though overlap check should prevent most)
           const channelData = clip.buffer.getChannelData(0); // Mono correlation
           if (startSample + lengthSamples > channelData.length) {
               return channelData.slice(startSample);
           }
           return channelData.slice(startSample, startSample + lengthSamples);
      };
      
      const refData = getClipData(refClip);
      const targetData = getClipData(targetClip);
      
      // Calculate Lag
      const offsetSeconds = audioService.calculateAlignmentLag(refData, targetData, sampleRate);
      
      if (Math.abs(offsetSeconds) < 0.0005) {
          // alert("Already aligned!");
          return; 
      }
      
      // Apply offset to target clip
      // If offsetSeconds is negative (target is late), we move target clip EARLIER (subtract from startTime)
      // New Start Time = Current Start Time + offsetSeconds
      // (Wait, logic check: if offset is -0.01s, we want to move clip left by 0.01s. So += offsetSeconds works)
      
      const newStartTime = targetClip.startTime + offsetSeconds;
      
      const newClips = clips.map(c => c.id === targetClip.id ? { ...c, startTime: newStartTime } : c);
      updateStateWithHistory(tracks, newClips);
  };

  // --- Batch Operations (Delete, Duplicate, Copy, Paste) ---

  const deleteClips = (ids: string[]) => {
      const newClips = clips.filter(c => !ids.includes(c.id));
      setSelectedClipIds([]);
      updateStateWithHistory(tracks, newClips);
  };

  const duplicateClips = (ids: string[]) => {
      const clipsToDuplicate = clips.filter(c => ids.includes(c.id));
      if (clipsToDuplicate.length === 0) return;

      const newClips = [...clips];
      const newIds: string[] = [];

      clipsToDuplicate.forEach(original => {
          const newId = uuidv4();
          newIds.push(newId);
          newClips.push({
              ...original,
              id: newId,
              // Per user request: Place immediately after original
              startTime: original.startTime + original.duration, 
              name: `${original.name} (Copy)`
          });
      });

      updateStateWithHistory(tracks, newClips);
      setSelectedClipIds(newIds);
  };
  
  const handleFlattenClip = async (id: string) => {
      const clip = clips.find(c => c.id === id);
      if (!clip) return;
      
      try {
          const newBuffer = await audioService.bounceClip(clip);
          const newClip: AudioClip = {
              ...clip,
              buffer: newBuffer,
              offset: 0,
              duration: clip.duration, 
              playbackRate: 1, 
              name: `${clip.name} (Flattened)`,
              loop: false 
          };
          
          const newClips = clips.map(c => c.id === id ? newClip : c);
          updateStateWithHistory(tracks, newClips);
          // Keep selection
          if (selectedClipIds.includes(id)) {
              // no-op, still selected
          }
      } catch (e) {
          console.error("Flatten failed", e);
          alert("Could not flatten clip.");
      }
  };

  const renameClip = (id: string, newName: string) => {
      const newClips = clips.map(c => c.id === id ? { ...c, name: newName } : c);
      updateStateWithHistory(tracks, newClips);
  };

  const handleSplitClip = (clipId: string, splitTime: number) => {
      const clip = clips.find(c => c.id === clipId);
      if (!clip) return;
      
      const relativeSplit = splitTime - clip.startTime;
      // Adjusted bounds check to allow splitting near edges but not exact edges
      if (relativeSplit <= 0.01 || relativeSplit >= (clip.duration - 0.01)) return;
      
      const leftDuration = relativeSplit; // Visual duration
      const rightDuration = clip.duration - leftDuration;
      
      // Calculate buffer offset for right clip
      // clip.offset is where the current clip starts in the buffer.
      // split happens at leftDuration * playbackRate into the visible clip.
      const splitPointInBuffer = leftDuration * clip.playbackRate;
      const rightOffset = clip.offset + splitPointInBuffer;

      const leftClip: AudioClip = { 
          ...clip, 
          id: uuidv4(), 
          duration: leftDuration, 
          name: clip.name 
      };
      
      const rightClip: AudioClip = { 
          ...clip, 
          id: uuidv4(), 
          startTime: splitTime, 
          offset: rightOffset, 
          duration: rightDuration, 
          name: clip.name 
      };

      const newClips = clips.filter(c => c.id !== clipId);
      newClips.push(leftClip, rightClip);
      
      // Update selection to the new clips if original was selected
      if (selectedClipIds.includes(clipId)) {
          setSelectedClipIds([leftClip.id, rightClip.id]);
      }
      
      updateStateWithHistory(tracks, newClips);
  };
  
  const handleCopyClips = (ids: string[]) => {
      const selected = clips.filter(c => ids.includes(c.id));
      if (selected.length > 0) setClipboardClips(selected);
  };
  
  const handlePasteClips = (time: number, targetTrackId: string) => {
      if (clipboardClips.length === 0 || targetTrackId === 'master') return;
      
      // Calculate relative offsets based on the earliest clip in clipboard
      const minStartTime = Math.min(...clipboardClips.map(c => c.startTime));
      
      const newClips = [...clips];
      const newIds: string[] = [];

      clipboardClips.forEach(clip => {
          const relativeTime = clip.startTime - minStartTime;
          const newId = uuidv4();
          newIds.push(newId);
          
          newClips.push({
              ...clip,
              id: newId,
              startTime: time + relativeTime,
              trackId: targetTrackId, // Collapse to the track where user right-clicked for now
              name: `${clip.name} (Paste)`
          });
      });
      
      updateStateWithHistory(tracks, newClips);
      setSelectedClipIds(newIds);
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

  const handleExportStems = async () => {
      setIsExporting(true);
      if (playbackState.isPlaying) handleStop();
      try {
          for (const track of tracks) {
             if (track.isMaster) continue;
             const trackClips = clips.filter(c => c.trackId === track.id);
             if (trackClips.length === 0) continue;

             const blob = await audioService.renderOffline(trackClips, [track, MASTER_TRACK]);
             
             const url = URL.createObjectURL(blob);
             const a = document.createElement('a');
             a.href = url;
             a.download = `${track.name}_Stem.wav`;
             a.click();
             URL.revokeObjectURL(url);
             
             await new Promise(r => setTimeout(r, 500));
          }
      } catch (e) {
          console.error("Stem Export failed", e);
          alert("Stem Export failed.");
      } finally {
          setIsExporting(false);
          setIsSettingsOpen(false);
      }
  };

  // --- Derived State & Variables ---
  const regularTracks = tracks.filter(t => !t.isMaster);
  const masterTrack = tracks.find(t => t.isMaster) || MASTER_TRACK;
  
  // Only show editor if exactly one clip is selected
  const selectedClip = selectedClipIds.length === 1 
      ? clips.find(c => c.id === selectedClipIds[0]) || null
      : null;
      
  const editingTrack = tracks.find(t => t.id === editingTrackId) || null;

  const totalDuration = Math.max(300, ...clips.map(c => c.startTime + c.duration));
  const secondsPerBeat = 60 / bpm;
  const secondsPerBar = secondsPerBeat * 4; 
  const totalBars = Math.ceil(totalDuration / secondsPerBar) + 5;
  const pixelsPerBar = secondsPerBar * zoom;
  const timelineWidth = totalBars * pixelsPerBar;
  
  const masterHeightClass = visualizerConfig.mode === 'OFF' ? 'h-[135px]' : 'h-44';

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-[#1e1e1e] text-[#d4d4d4] font-sans selection:bg-[#ff7b00]/30">
      <SettingsModal 
          isOpen={isSettingsOpen} 
          onClose={() => setIsSettingsOpen(false)}
          onExportStems={handleExportStems}
      />
      
      <VisualizerSettings 
          isOpen={isVisualizerSettingsOpen}
          onClose={() => setIsVisualizerSettingsOpen(false)}
          config={visualizerConfig}
          onChange={setVisualizerConfig}
      />

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
        setBpm={(newBpm) => {
            setBpm(newBpm);
        }}
        tool={tool}
        setTool={setTool}
        zoom={zoom}
        setZoom={handleZoomChange}
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
        onOpenSettings={() => setIsSettingsOpen(true)}
        
        followPlayhead={followPlayhead}
        setFollowPlayhead={setFollowPlayhead}
        timeDisplayFormat={timeDisplayFormat}
        setTimeDisplayFormat={setTimeDisplayFormat}
      />

      {/* Main Workspace: Single Unified Scroll Container */}
      <div 
        className="flex-1 overflow-auto relative custom-scrollbar-hidden" 
        ref={scrollContainerRef}
        onScroll={handleMainScroll}
      >
        <div className="flex min-w-max">
            {/* Sticky Left Column (Headers) */}
            <div 
                className="sticky left-0 z-40 bg-[#2d2d2d] border-r border-[#111] flex flex-col flex-shrink-0"
                style={{ width: TRACK_HEADER_WIDTH }}
            >
                 {/* Sticky Top-Left Corner */}
                 <div 
                    className="sticky top-0 z-50 bg-[#2d2d2d] border-b border-[#111] flex-shrink-0"
                    style={{ height: TIMELINE_RULER_HEIGHT }}
                 />
                 
                 {/* Track Headers List */}
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
                        className="w-full py-3 border border-dashed border-[#555] rounded-none text-[#999] hover:text-[#d4d4d4] hover:border-[#888] hover:bg-[#444] flex items-center justify-center gap-2 text-sm transition-all group"
                        title="Add a new audio track"
                     >
                        <div className="p-1 rounded-none bg-[#444] group-hover:bg-[#555] transition-colors"><Plus size={14} /></div>
                        <span>Add Track</span>
                     </button>
                 </div>
                 
                 {/* Bottom Spacer */}
                 <div className="h-64 bg-[#2d2d2d]" />
            </div>

            {/* Main Timeline Area (Scrolls with parent) */}
            <div className="flex flex-col flex-1">
                {/* Timeline Component - renders Ruler (sticky inside) and Tracks */}
                <Timeline 
                    tracks={regularTracks}
                    clips={clips}
                    currentTime={playbackState.currentTime}
                    followPlayhead={followPlayhead}
                    setFollowPlayhead={setFollowPlayhead}
                    onClipsUpdate={updateClips} // Batch update
                    onFileDrop={handleFileDrop}
                    setClips={setClips}
                    onSeek={handleSeek}
                    bpm={bpm}
                    zoom={zoom}
                    setZoom={handleZoomChange}
                    snap={snap}
                    tool={tool}
                    
                    selectedClipIds={selectedClipIds}
                    setSelectedClipIds={setSelectedClipIds}
                    
                    onDeleteClips={deleteClips}
                    onDuplicateClips={duplicateClips}
                    onCopyClips={handleCopyClips}
                    onPasteClips={handlePasteClips}
                    canPaste={clipboardClips.length > 0}
                    
                    onRenameClip={renameClip}
                    onSplitClip={handleSplitClip}
                    onAddAutomationPoint={handleAddAutomationPoint}
                    onClipResize={handleClipResize}
                    onLoopClip={handleLoopToggle}
                    onFlattenClip={handleFlattenClip}
                    onClipDoubleClick={(id) => { setIsClipEditorOpen(true); setSelectedClipIds([id]); }}
                    onAutoAlign={handleAutoAlign}
                    
                    loopRegion={loopRegion}
                    setLoopRegion={setLoopRegion}
                    onImportAudio={handleFileDrop}
                    markers={timeMarkers}
                    onAddMarker={(time, label, type, value) => setTimeMarkers([...timeMarkers, {time, label, type, value}])}
                    setBpm={setBpm}
                />
            </div>
        </div>
      </div>

      {/* Fixed Bottom Master Section */}
      <div className={`${masterHeightClass} bg-[#2d2d2d] border-t border-[#111] flex flex-col z-50 transition-all duration-300 ease-in-out`}>
         {/* Master Row */}
         <div className="flex flex-1 overflow-hidden">
             {/* Master Control (Left) */}
             <div className="flex-shrink-0 border-r border-[#111]" style={{ width: TRACK_HEADER_WIDTH }}>
                <TrackControl 
                  track={masterTrack}
                  onUpdate={updateTrack}
                  onDelete={() => {}}
                  isArmed={false}
                  isRecordingGlobal={false}
                  onArmToggle={() => {}}
                  onOpenEditor={setEditingTrackId}
                  onToggleAutomation={() => {}}
                  onOpenVisualizerSettings={() => setIsVisualizerSettingsOpen(true)}
                />
             </div>
             {/* Master Visualizer (Right) */}
             <div className="flex-1 p-2 bg-[#1e1e1e] flex items-center justify-center">
                 <MasterVisualizer 
                    isPlaying={playbackState.isPlaying} 
                    config={visualizerConfig}
                 />
             </div>
         </div>

         {/* Navigator / Scrollbar (Bottom Fixed) */}
         <div className="h-5 bg-[#111] border-t border-[#111]">
             <div 
                ref={navigatorRef}
                onScroll={handleNavigatorScroll}
                className="w-full h-full overflow-x-auto overflow-y-hidden custom-scrollbar"
                title="Timeline Navigator"
             >
                <div style={{ width: timelineWidth + TRACK_HEADER_WIDTH, height: '1px' }}></div>
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
            clip={isClipEditorOpen ? selectedClip : null} 
            onUpdate={updateClipProps} 
            onClose={() => setIsClipEditorOpen(false)}
            projectBpm={bpm}
          />
      )}
    </div>
  );
}

export default App;
