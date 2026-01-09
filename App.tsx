import React, { useState, useEffect, useCallback, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { TrackControl } from './components/TrackControl';
import { Timeline } from './components/Timeline';
import { Transport } from './components/Transport';
import { Track, AudioClip, PlaybackState } from './types';
import { TRACK_COLORS, TRACK_HEADER_WIDTH } from './constants';
import { audioService } from './services/audioEngine';
import { Plus } from 'lucide-react';

const INITIAL_TRACKS: Track[] = [
  { id: 'track-1', name: 'Drums', color: TRACK_COLORS[0], volume: 0.8, muted: false, soloed: false },
  { id: 'track-2', name: 'Bass', color: TRACK_COLORS[1], volume: 0.8, muted: false, soloed: false },
  { id: 'track-3', name: 'Melody', color: TRACK_COLORS[4], volume: 0.8, muted: false, soloed: false },
  { id: 'track-4', name: 'Vocals', color: TRACK_COLORS[5], volume: 0.8, muted: false, soloed: false },
];

function App() {
  const [tracks, setTracks] = useState<Track[]>(INITIAL_TRACKS);
  const [clips, setClips] = useState<AudioClip[]>([]);
  const [bpm, setBpm] = useState<number>(120);
  const [recordingTrackId, setRecordingTrackId] = useState<string | null>(null);
  const [playbackState, setPlaybackState] = useState<PlaybackState>({
    isPlaying: false,
    currentTime: 0
  });

  const rafRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0); 
  const pauseTimeRef = useRef<number>(0); 
  const recordStartTimeRef = useRef<number>(0);

  useEffect(() => {
    tracks.forEach(track => {
      audioService.createTrackNodes(track.id);
      audioService.updateTrackVolume(track.id, track.volume);
    });
  }, [tracks]);

  // --- Playback Logic ---

  const startPlayback = useCallback((startAt: number) => {
    audioService.play(clips, tracks, startAt);
    
    startTimeRef.current = audioService.getContext().currentTime;
    setPlaybackState(prev => ({ ...prev, isPlaying: true }));
    
    const animate = () => {
      const now = audioService.getContext().currentTime;
      const elapsed = now - startTimeRef.current;
      const newTime = startAt + elapsed;
      
      setPlaybackState(prev => ({ ...prev, currentTime: newTime }));
      rafRef.current = requestAnimationFrame(animate);
    };
    
    rafRef.current = requestAnimationFrame(animate);
  }, [clips, tracks]);

  const handlePlay = useCallback(async () => {
    await audioService.resume();
    startPlayback(pauseTimeRef.current);
  }, [startPlayback]);

  const handleStop = useCallback(async () => {
    audioService.stop();
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    
    // Stop recording if active
    if (recordingTrackId) {
       await finishRecording();
    }
    
    setPlaybackState(prev => {
        pauseTimeRef.current = prev.currentTime; 
        return { ...prev, isPlaying: false };
    });
  }, [recordingTrackId]);

  const handleSeek = (time: number) => {
      pauseTimeRef.current = time;
      setPlaybackState(prev => ({ ...prev, currentTime: time }));
      
      if (playbackState.isPlaying) {
          // Restart playback from new time
          audioService.stop();
          if (rafRef.current) cancelAnimationFrame(rafRef.current);
          startPlayback(time);
      }
  };

  const handleRewind = () => {
      const newTime = Math.max(0, playbackState.currentTime - 5);
      handleSeek(newTime);
  };

  const handleFastForward = () => {
      const newTime = playbackState.currentTime + 5;
      handleSeek(newTime);
  };

  // --- Recording Logic ---

  const finishRecording = async () => {
      if (!recordingTrackId) return;

      const blob = await audioService.stopRecording();
      const endTime = playbackState.currentTime;
      const startTime = recordStartTimeRef.current;
      
      if (blob) {
          try {
              const buffer = await audioService.decodeBlob(blob);
              const newClip: AudioClip = {
                  id: uuidv4(),
                  trackId: recordingTrackId,
                  buffer: buffer,
                  name: 'Recording',
                  startTime: startTime,
                  duration: buffer.duration,
                  offset: 0
              };
              setClips(prev => [...prev, newClip]);
          } catch (e) {
              console.error("Failed to process recording", e);
          }
      }

      setRecordingTrackId(null);
  };

  const handleRecordToggle = async (trackId: string) => {
      // If currently recording this track, stop it
      if (recordingTrackId === trackId) {
          await handleStop();
          return;
      }

      // If recording another track, don't allow switching mid-flight (for simplicity)
      if (recordingTrackId) return;

      // Start Recording
      try {
          await audioService.resume();
          await audioService.startRecording();
          setRecordingTrackId(trackId);
          
          recordStartTimeRef.current = pauseTimeRef.current;
          
          // Start playback if not already playing, so we can hear context
          if (!playbackState.isPlaying) {
              startPlayback(pauseTimeRef.current);
          }
      } catch (e) {
          alert("Could not start recording. Please allow microphone access.");
      }
  };

  // --- Track Management ---

  const addTrack = () => {
    const newTrack: Track = {
      id: `track-${Date.now()}`,
      name: `Track ${tracks.length + 1}`,
      color: TRACK_COLORS[tracks.length % TRACK_COLORS.length],
      volume: 0.8,
      muted: false,
      soloed: false,
    };
    setTracks([...tracks, newTrack]);
  };

  const updateTrack = (id: string, updates: Partial<Track>) => {
    setTracks(tracks.map(t => {
        if (t.id === id) {
            const updated = { ...t, ...updates };
            if (updates.volume !== undefined) audioService.updateTrackVolume(id, updates.volume);
            return updated;
        }
        return t;
    }));
  };

  const deleteTrack = (id: string) => {
    audioService.removeTrackNodes(id);
    setTracks(tracks.filter(t => t.id !== id));
    setClips(clips.filter(c => c.trackId !== id));
  };

  const handleFileDrop = async (file: File, trackId: string, time: number) => {
    try {
      const buffer = await audioService.loadFile(file);
      const newClip: AudioClip = {
        id: uuidv4(),
        trackId,
        buffer,
        name: file.name,
        startTime: time,
        duration: buffer.duration,
        offset: 0
      };
      setClips(prev => [...prev, newClip]);
    } catch (e) {
      console.error("Failed to load audio", e);
      alert("Could not load audio file. Ensure it is a valid format (mp3, wav).");
    }
  };

  const updateClip = (id: string, newTime: number, newTrackId?: string) => {
    setClips(prev => prev.map(c => 
        c.id === id 
        ? { ...c, startTime: newTime, trackId: newTrackId || c.trackId } 
        : c
    ));
    if (playbackState.isPlaying) {
        handleStop(); 
    }
  };

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-gray-950 text-white font-sans selection:bg-purple-500/30">
      <Transport 
        isPlaying={playbackState.isPlaying}
        onPlay={handlePlay}
        onStop={handleStop}
        onRewind={handleRewind}
        onFastForward={handleFastForward}
        currentTime={playbackState.currentTime}
        bpm={bpm}
        setBpm={setBpm}
      />

      <div className="flex flex-1 overflow-hidden relative">
        {/* Track Headers */}
        <div 
            className="flex-shrink-0 bg-gray-900 border-r border-gray-700 overflow-y-auto custom-scrollbar z-10 shadow-xl"
            style={{ width: TRACK_HEADER_WIDTH }}
        >
          {tracks.map(track => (
            <TrackControl 
              key={track.id} 
              track={track} 
              onUpdate={updateTrack}
              onDelete={deleteTrack}
              isRecording={recordingTrackId === track.id}
              onRecordToggle={handleRecordToggle}
            />
          ))}
          
          <div className="p-3">
             <button 
                onClick={addTrack}
                className="w-full py-3 border border-dashed border-gray-700 rounded-lg text-gray-500 hover:text-white hover:border-gray-500 hover:bg-gray-800 flex items-center justify-center gap-2 text-sm transition-all group"
             >
                <div className="p-1 rounded bg-gray-800 group-hover:bg-gray-700 transition-colors">
                    <Plus size={14} /> 
                </div>
                <span>Add New Track</span>
             </button>
          </div>
          
          <div className="h-64"></div>
        </div>

        {/* Timeline Area */}
        <Timeline 
          tracks={tracks}
          clips={clips}
          currentTime={playbackState.currentTime}
          onClipUpdate={updateClip}
          onFileDrop={handleFileDrop}
          setClips={setClips}
          onSeek={handleSeek}
        />
      </div>
    </div>
  );
}

export default App;