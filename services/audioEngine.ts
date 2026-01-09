import { AudioClip, Track } from '../types';

class AudioEngine {
  private context: AudioContext;
  private masterGain: GainNode;
  private activeSources: Map<string, AudioBufferSourceNode> = new Map();
  private trackNodes: Map<string, { gain: GainNode; panner: StereoPannerNode }> = new Map();
  
  // Recording
  private mediaRecorder: MediaRecorder | null = null;
  private recordingChunks: Blob[] = [];
  private recordingStream: MediaStream | null = null;

  constructor() {
    this.context = new (window.AudioContext || (window as any).webkitAudioContext)();
    this.masterGain = this.context.createGain();
    this.masterGain.connect(this.context.destination);
    this.masterGain.gain.value = 0.8;
  }

  public getContext() {
    return this.context;
  }

  public async resume() {
    if (this.context.state === 'suspended') {
      await this.context.resume();
    }
  }

  public async loadFile(file: File): Promise<AudioBuffer> {
    const arrayBuffer = await file.arrayBuffer();
    return await this.context.decodeAudioData(arrayBuffer);
  }

  public async decodeBlob(blob: Blob): Promise<AudioBuffer> {
    const arrayBuffer = await blob.arrayBuffer();
    return await this.context.decodeAudioData(arrayBuffer);
  }

  public updateTrackVolume(trackId: string, volume: number) {
    const nodes = this.trackNodes.get(trackId);
    if (nodes) {
      nodes.gain.gain.setTargetAtTime(volume, this.context.currentTime, 0.05);
    }
  }

  public createTrackNodes(trackId: string) {
    if (this.trackNodes.has(trackId)) return;

    const gain = this.context.createGain();
    const panner = this.context.createStereoPanner();
    
    // Chain: Panner -> Gain -> Master
    panner.connect(gain);
    gain.connect(this.masterGain);

    this.trackNodes.set(trackId, { gain, panner });
  }

  public removeTrackNodes(trackId: string) {
    const nodes = this.trackNodes.get(trackId);
    if (nodes) {
      nodes.gain.disconnect();
      nodes.panner.disconnect();
      this.trackNodes.delete(trackId);
    }
  }

  public play(clips: AudioClip[], tracks: Track[], startTime: number) {
    this.stop(); // Stop any currently playing audio first
    this.resume();

    const now = this.context.currentTime;

    clips.forEach(clip => {
      // Find track nodes
      let trackNodes = this.trackNodes.get(clip.trackId);
      if (!trackNodes) {
        this.createTrackNodes(clip.trackId);
        trackNodes = this.trackNodes.get(clip.trackId);
      }
      
      const track = tracks.find(t => t.id === clip.trackId);
      if (!track || track.muted) return; 

      // Timeline math
      const clipStartAbsolute = clip.startTime;
      const transportStartAbsolute = startTime;
      
      let whenToPlay = now + (clipStartAbsolute - transportStartAbsolute);
      let offset = clip.offset;
      let duration = clip.duration;

      // If playback started AFTER the clip started (mid-clip)
      if (whenToPlay < now) {
        const missedBy = now - whenToPlay;
        offset += missedBy;
        duration -= missedBy;
        whenToPlay = now;
      }

      if (duration > 0) {
        const source = this.context.createBufferSource();
        source.buffer = clip.buffer;
        
        if (trackNodes) {
            source.connect(trackNodes.panner);
        } else {
            source.connect(this.masterGain);
        }

        source.start(whenToPlay, offset, duration);
        this.activeSources.set(clip.id, source);

        source.onended = () => {
          this.activeSources.delete(clip.id);
        };
      }
    });
  }

  public stop() {
    this.activeSources.forEach(source => {
      try {
        source.stop();
      } catch (e) {
        // Ignore
      }
    });
    this.activeSources.clear();
  }

  // --- Recording Methods ---

  public async startRecording(): Promise<void> {
    try {
        this.recordingStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        this.mediaRecorder = new MediaRecorder(this.recordingStream);
        this.recordingChunks = [];

        this.mediaRecorder.ondataavailable = (e) => {
            if (e.data.size > 0) {
                this.recordingChunks.push(e.data);
            }
        };

        this.mediaRecorder.start();
    } catch (err) {
        console.error("Error starting recording:", err);
        throw err;
    }
  }

  public async stopRecording(): Promise<Blob | null> {
    return new Promise((resolve) => {
        if (!this.mediaRecorder || this.mediaRecorder.state === 'inactive') {
            resolve(null);
            return;
        }

        this.mediaRecorder.onstop = () => {
            const blob = new Blob(this.recordingChunks, { type: 'audio/webm' });
            this.recordingChunks = [];
            
            // Stop stream tracks to release mic
            if (this.recordingStream) {
                this.recordingStream.getTracks().forEach(track => track.stop());
                this.recordingStream = null;
            }
            this.mediaRecorder = null;
            resolve(blob);
        };

        this.mediaRecorder.stop();
    });
  }
}

export const audioService = new AudioEngine();