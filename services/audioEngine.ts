
import { AudioClip, Track, AudioPlugin, AutomationPoint, PluginType } from '../types';

interface ActiveSource {
  source: AudioBufferSourceNode;
  gain: GainNode;
  panner: StereoPannerNode;
}

interface TrackNodes {
  input: GainNode;     
  output: GainNode;    
  panner: StereoPannerNode;
  fader: GainNode;     
  analyser: AnalyserNode; 
  pluginNodes: AudioNode[];
  pluginMap: Map<string, AudioNode | any>; 
}

class AudioEngine {
  private context: AudioContext;
  
  private masterInput: GainNode;
  private masterFader: GainNode;
  private masterAnalyser: AnalyserNode;
  private masterPluginNodes: AudioNode[] = [];
  
  private activeSources: Map<string, ActiveSource> = new Map();
  private trackNodes: Map<string, TrackNodes> = new Map();
  private metronomeNodes: AudioNode[] = [];
  
  private mediaRecorder: MediaRecorder | null = null;
  private recordingChunks: Blob[] = [];
  private recordingStream: MediaStream | null = null;
  
  // Monitoring & Devices
  private monitorStream: MediaStream | null = null;
  private monitorSource: MediaStreamAudioSourceNode | null = null;
  private monitorAnalyser: AnalyserNode | null = null;
  private monitorGain: GainNode | null = null;
  private monitorTrackId: string | null = null;
  
  private currentInputDeviceId: string = 'default';
  public latencySeconds: number = 0.025; // Default 25ms manual offset

  constructor() {
    this.context = new (window.AudioContext || (window as any).webkitAudioContext)({
        latencyHint: 'interactive'
    });
    
    this.masterFader = this.context.createGain();
    this.masterAnalyser = this.context.createAnalyser();
    this.masterAnalyser.fftSize = 256;
    this.masterAnalyser.smoothingTimeConstant = 0.8;
    
    this.masterFader.connect(this.masterAnalyser);
    this.masterAnalyser.connect(this.context.destination);
    
    this.masterInput = this.context.createGain();
    this.masterInput.connect(this.masterFader);
  }

  public getContext() {
    return this.context;
  }

  public async resume() {
    if (this.context.state === 'suspended') {
      await this.context.resume();
    }
  }

  // --- Device Management ---

  public async getAvailableDevices() {
      // Ensure we have permissions first to get labels
      try {
        await navigator.mediaDevices.getUserMedia({ audio: true }).then(s => s.getTracks().forEach(t => t.stop()));
      } catch (e) {
          console.warn("Could not get permission for enumerating devices");
      }
      
      const devices = await navigator.mediaDevices.enumerateDevices();
      return {
          inputs: devices.filter(d => d.kind === 'audioinput'),
          outputs: devices.filter(d => d.kind === 'audiooutput')
      };
  }

  public setInputDevice(deviceId: string) {
      this.currentInputDeviceId = deviceId;
      // If currently monitoring, restart stream
      if (this.monitorStream) {
          const trackId = this.monitorTrackId;
          this.disableMonitoring();
          if (trackId) this.enableMonitoring(trackId);
      }
  }

  public async setOutputDevice(deviceId: string) {
      // Experimental: setSinkId
      if ('setSinkId' in this.context.destination) {
          try {
              await (this.context.destination as any).setSinkId(deviceId);
          } catch (e) {
              console.error("Failed to set output device", e);
          }
      } else {
          console.warn("Output device selection not supported in this browser");
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

  // --- Metronome & Calibration ---
  public scheduleMetronome(bpm: number, startTime: number, duration: number = 600) {
      const beatDuration = 60 / bpm;
      const totalBeats = Math.floor(duration / beatDuration);
      
      const metronomeGain = this.context.createGain();
      metronomeGain.gain.value = 0.3;
      metronomeGain.connect(this.context.destination);
      this.metronomeNodes.push(metronomeGain);

      for(let i = 0; i < totalBeats; i++) {
          const time = startTime + (i * beatDuration);
          const isDownbeat = i % 4 === 0;
          
          this.playClick(time, isDownbeat, metronomeGain);
      }
  }

  public playClick(time: number, isHigh: boolean = false, destination: AudioNode = this.context.destination) {
      const osc = this.context.createOscillator();
      osc.type = 'square';
      osc.frequency.value = isHigh ? 1000 : 800;
      
      const envelope = this.context.createGain();
      envelope.gain.setValueAtTime(0, time);
      envelope.gain.linearRampToValueAtTime(1, time + 0.001);
      envelope.gain.exponentialRampToValueAtTime(0.001, time + 0.1);
      
      osc.connect(envelope);
      envelope.connect(destination);
      
      osc.start(time);
      osc.stop(time + 0.1);
      
      if (destination === this.context.destination) {
          // Track ephemeral nodes if not part of main metronome loop
          // (In a real engine we'd manage this better, for now we let GC handle oneshots)
      } else {
          this.metronomeNodes.push(osc);
          this.metronomeNodes.push(envelope);
      }
  }
  
  public playCountIn(bpm: number, measures: number): Promise<void> {
      return new Promise((resolve) => {
          const now = this.context.currentTime;
          const beatDuration = 60 / bpm;
          const totalBeats = measures * 4;
          
          this.scheduleMetronome(bpm, now, totalBeats * beatDuration + 0.1);
          
          setTimeout(() => {
              resolve();
          }, totalBeats * beatDuration * 1000);
      });
  }

  // --- Track Node Management ---

  public createTrackNodes(trackId: string, isMaster: boolean = false) {
    if (this.trackNodes.has(trackId)) return;
    
    if (isMaster) return; 

    const input = this.context.createGain();
    const output = this.context.createGain();
    const panner = this.context.createStereoPanner();
    const fader = this.context.createGain();
    const analyser = this.context.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.8;
    
    input.connect(output);
    output.connect(panner);
    panner.connect(fader);
    fader.connect(analyser);
    analyser.connect(this.masterInput);

    this.trackNodes.set(trackId, { 
      input, 
      output, 
      panner, 
      fader, 
      analyser,
      pluginNodes: [],
      pluginMap: new Map()
    });
  }

  public removeTrackNodes(trackId: string) {
    const nodes = this.trackNodes.get(trackId);
    if (nodes) {
      nodes.input.disconnect();
      nodes.output.disconnect();
      nodes.panner.disconnect();
      nodes.fader.disconnect();
      nodes.analyser.disconnect();
      nodes.pluginNodes.forEach(n => {
         if (n instanceof AudioNode) n.disconnect();
         else (n as any).output.disconnect();
      });
      this.trackNodes.delete(trackId);
    }
  }

  public getTrackAnalyser(trackId: string): AnalyserNode | null {
      if (trackId === 'master') return this.masterAnalyser;
      return this.trackNodes.get(trackId)?.analyser || null;
  }

  public getTrackMonitorAnalyser(trackId: string): AnalyserNode | null {
      if (this.monitorTrackId === trackId) {
          return this.monitorAnalyser;
      }
      return null;
  }

  public async enableMonitoring(trackId: string) {
      if (this.monitorStream) {
          this.disableMonitoring();
      }

      try {
          this.monitorStream = await navigator.mediaDevices.getUserMedia({ 
              audio: { 
                  deviceId: this.currentInputDeviceId !== 'default' ? { exact: this.currentInputDeviceId } : undefined,
                  echoCancellation: false, 
                  autoGainControl: false, 
                  noiseSuppression: false,
                  latency: 0 
              } as any
          });
          
          this.monitorSource = this.context.createMediaStreamSource(this.monitorStream);
          this.monitorAnalyser = this.context.createAnalyser();
          this.monitorAnalyser.fftSize = 256;
          this.monitorAnalyser.smoothingTimeConstant = 0.8;

          // Create a mute gain node to keep the graph active without feedback
          this.monitorGain = this.context.createGain();
          this.monitorGain.gain.value = 0;

          this.monitorSource.connect(this.monitorAnalyser);
          this.monitorAnalyser.connect(this.monitorGain);
          this.monitorGain.connect(this.context.destination);
          
          this.monitorTrackId = trackId;
      } catch (err) {
          console.error("Error enabling monitoring:", err);
          throw err;
      }
  }

  public disableMonitoring() {
      if (this.monitorSource) {
          this.monitorSource.disconnect();
          this.monitorSource = null;
      }
      if (this.monitorAnalyser) {
          this.monitorAnalyser.disconnect();
          this.monitorAnalyser = null;
      }
      if (this.monitorGain) {
          this.monitorGain.disconnect();
          this.monitorGain = null;
      }
      if (this.monitorStream) {
          this.monitorStream.getTracks().forEach(t => t.stop());
          this.monitorStream = null;
      }
      this.monitorTrackId = null;
  }

  public updateTrackVolume(trackId: string, volume: number) {
    if (trackId === 'master') {
      this.masterFader.gain.setTargetAtTime(volume, this.context.currentTime, 0.02);
      return;
    }
    const nodes = this.trackNodes.get(trackId);
    if (nodes) {
      nodes.fader.gain.setTargetAtTime(volume, this.context.currentTime, 0.02);
    }
  }

  public applyRealtimeSoloMute(tracks: Track[]) {
      const anySolo = tracks.some(t => t.soloed);
      const now = this.context.currentTime;

      tracks.forEach(track => {
          if (track.isMaster) return;
          
          const nodes = this.trackNodes.get(track.id);
          if (!nodes) return;

          const isAudible = anySolo ? track.soloed : !track.muted;
          const targetGain = isAudible ? track.volume : 0;
          
          nodes.fader.gain.cancelScheduledValues(now);
          nodes.fader.gain.setTargetAtTime(targetGain, now, 0.01);
      });
  }

  public updateTrackPlugins(trackId: string, plugins: AudioPlugin[]) {
    if (trackId === 'master') {
      this.rebuildMasterChain(plugins);
    } else {
      this.rebuildTrackChain(trackId, plugins);
    }
  }

  // --- Plugin Factory ---

  private createPluginNode(context: BaseAudioContext, plugin: AudioPlugin): AudioNode | { input: AudioNode, output: AudioNode, [key: string]: any } {
    switch (plugin.type) {
      case 'DELAY':
        const delay = context.createDelay();
        delay.delayTime.value = plugin.params.time || 0.3;
        (delay as any)._time = delay.delayTime;
        return delay;
        
      case 'DISTORTION':
        const waveShaper = context.createWaveShaper();
        waveShaper.curve = this.makeDistortionCurve(plugin.params.drive || 0);
        waveShaper.oversample = '4x';
        return waveShaper;
        
      case 'HIGHPASS':
        const hp = context.createBiquadFilter();
        hp.type = 'highpass';
        hp.frequency.value = plugin.params.frequency || 1000;
        (hp as any)._frequency = hp.frequency;
        return hp;
        
      case 'LOWPASS':
        const lp = context.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.value = plugin.params.frequency || 1000;
        (lp as any)._frequency = lp.frequency;
        return lp;
        
      case 'REVERB':
         const inputNode = context.createGain();
         const outputNode = context.createGain();
         const dryGain = context.createGain();
         const wetGain = context.createGain();
         const convolver = context.createConvolver();
         
         const mix = plugin.params.mix ?? 0.5;
         const type = plugin.params.type ?? 0;
         const decay = plugin.params.decay || 2.0;

         dryGain.gain.value = 1 - mix;
         wetGain.gain.value = mix;

         convolver.buffer = this.getReverbBuffer(context, type, decay);
         
         inputNode.connect(dryGain);
         dryGain.connect(outputNode);
         
         inputNode.connect(convolver);
         convolver.connect(wetGain);
         wetGain.connect(outputNode);

         return { 
             input: inputNode, 
             output: outputNode, 
             _mix: wetGain.gain, 
             _dry: dryGain.gain
         };
         
      default:
        return context.createGain();
    }
  }

  private rebuildTrackChain(trackId: string, plugins: AudioPlugin[]) {
    const nodes = this.trackNodes.get(trackId);
    if (!nodes) return;

    nodes.input.disconnect();
    nodes.pluginNodes.forEach(n => {
        if (n instanceof AudioNode) n.disconnect();
        else { (n as any).output.disconnect(); }
    });
    nodes.pluginNodes = [];
    nodes.pluginMap.clear();

    let previousOutput: AudioNode = nodes.input;

    plugins.forEach(plugin => {
        if (!plugin.enabled) return;
        const nodeOrGraph = this.createPluginNode(this.context, plugin);
        
        let input: AudioNode;
        let output: AudioNode;

        if (nodeOrGraph instanceof AudioNode) {
            input = nodeOrGraph;
            output = nodeOrGraph;
            nodes.pluginNodes.push(input);
        } else {
            input = nodeOrGraph.input;
            output = nodeOrGraph.output;
            nodes.pluginNodes.push(output); 
        }

        nodes.pluginMap.set(plugin.id, nodeOrGraph);
        previousOutput.connect(input);
        previousOutput = output;
    });

    previousOutput.connect(nodes.output);
  }

  private rebuildMasterChain(plugins: AudioPlugin[]) {
      this.masterInput.disconnect();
      this.masterPluginNodes.forEach(n => {
          if (n instanceof AudioNode) n.disconnect();
          else { (n as any).output.disconnect(); }
      });
      this.masterPluginNodes = [];

      let previousOutput: AudioNode = this.masterInput;

      plugins.forEach(plugin => {
          if (!plugin.enabled) return;
          const nodeOrGraph = this.createPluginNode(this.context, plugin);
          
          let input: AudioNode;
          let output: AudioNode;

          if (nodeOrGraph instanceof AudioNode) {
              input = nodeOrGraph;
              output = nodeOrGraph;
              this.masterPluginNodes.push(input);
          } else {
              input = nodeOrGraph.input;
              output = nodeOrGraph.output;
              this.masterPluginNodes.push(output);
          }

          previousOutput.connect(input);
          previousOutput = output;
      });

      previousOutput.connect(this.masterFader);
  }

  // --- DSP Utilities ---

  private makeDistortionCurve(amount: number) {
    const k = typeof amount === 'number' ? amount : 50;
    const n_samples = 44100;
    const curve = new Float32Array(n_samples);
    const deg = Math.PI / 180;
    for (let i = 0; i < n_samples; ++i) {
      const x = (i * 2) / n_samples - 1;
      curve[i] = ((3 + k) * x * 20 * deg) / (Math.PI + k * Math.abs(x));
    }
    return curve;
  }

  private getReverbBuffer(context: BaseAudioContext, type: number, decayTime: number) {
      const sampleRate = context.sampleRate;
      const length = sampleRate * decayTime;
      const impulse = context.createBuffer(2, length, sampleRate);
      const left = impulse.getChannelData(0);
      const right = impulse.getChannelData(1);

      for (let i = 0; i < length; i++) {
          let decay = 0;
          if (type === 0) decay = Math.pow(1 - i / length, decayTime * 1.5);
          else if (type === 1) decay = Math.pow(1 - i / length, decayTime * 4);
          else decay = Math.pow(1 - i / length, decayTime * 2);

          left[i] = (Math.random() * 2 - 1) * decay;
          right[i] = (Math.random() * 2 - 1) * decay;
      }
      return impulse;
  }

  // --- Playback & Automation ---

  public play(clips: AudioClip[], tracks: Track[], startTime: number) {
    this.stop(); 
    this.resume();
    const now = this.context.currentTime;
    
    const anySolo = tracks.some(t => t.soloed);

    this.scheduleClips(this.context, clips, tracks, startTime, now, anySolo, (clip, source, gain, panner) => {
        const trackNodes = this.trackNodes.get(clip.trackId);
        if (trackNodes) {
            gain.connect(trackNodes.input);
        } else {
            gain.connect(this.masterInput);
        }
        
        this.activeSources.set(clip.id, { source, gain, panner });
        source.onended = () => {
             const current = this.activeSources.get(clip.id);
             if (current && current.source === source) {
                  this.activeSources.delete(clip.id);
             }
        };
    });
    
    this.scheduleAutomation(tracks, startTime, now);
  }
  
  private scheduleAutomation(tracks: Track[], startTime: number, now: number) {
      tracks.forEach(track => {
          if (!track.automation) return;
          const nodes = this.trackNodes.get(track.id);
          if (!nodes) return;

          Object.keys(track.automation).forEach(paramId => {
              const points = track.automation[paramId];
              if (!points || points.length === 0) return;

              let param: AudioParam | null = null;
              
              if (paramId === 'volume') {
                  param = nodes.fader.gain;
                  param.cancelScheduledValues(now);
                  param.setValueAtTime(track.volume, now);
              } else if (paramId === 'pan') {
                  param = nodes.panner.pan;
                  param.cancelScheduledValues(now);
                  param.setValueAtTime(0, now);
              } else if (paramId.includes(':')) {
                  const [pluginId, paramName] = paramId.split(':');
                  const pluginNode = nodes.pluginMap.get(pluginId);
                  const internalProp = `_${paramName}`;
                  if (pluginNode && pluginNode[internalProp]) {
                      param = pluginNode[internalProp] as AudioParam;
                      param.cancelScheduledValues(now);
                      param.setValueAtTime(param.value, now);
                  }
              }

              if (param) {
                  points.forEach(point => {
                      const absoluteTime = now + (point.time - startTime);
                      if (absoluteTime >= now) {
                          const scaledValue = this.scaleAutomationValue(paramId, point.value);
                          // Use exponential ramp for natural sounding filter sweeps, linear for volume
                          if (paramId.includes('frequency')) {
                              param!.exponentialRampToValueAtTime(Math.max(0.01, scaledValue), absoluteTime);
                          } else {
                              param!.linearRampToValueAtTime(scaledValue, absoluteTime);
                          }
                      }
                  });
              }
          });
      });
  }

  private scaleAutomationValue(paramId: string, normalizedValue: number): number {
      if (paramId === 'volume') return normalizedValue; // 0 to 1
      if (paramId === 'pan') return (normalizedValue * 2) - 1; // -1 to 1
      
      const paramName = paramId.split(':')[1];
      if (!paramName) return normalizedValue;

      if (paramName === 'frequency') {
          // Logarithmic mapping 20Hz -> 20kHz
          const min = 20;
          const max = 20000;
          // Math.pow(max/min, normalized) * min
          return min * Math.pow(max / min, normalizedValue);
      }
      if (paramName === 'mix') return normalizedValue;
      if (paramName === 'time') return normalizedValue * 1.0; 
      if (paramName === 'drive') return normalizedValue * 100;
      if (paramName === 'decay') return normalizedValue * 10;
      
      return normalizedValue;
  }
  
  private scheduleClips(
      ctx: BaseAudioContext, 
      clips: AudioClip[], 
      tracks: Track[], 
      transportStart: number, 
      now: number,
      anySolo: boolean,
      onNodeCreated: (clip: AudioClip, source: AudioBufferSourceNode, gain: GainNode, panner: StereoPannerNode) => void
  ) {
      clips.forEach(clip => {
          const track = tracks.find(t => t.id === clip.trackId);
          if (!track) return;
          
          const isAudible = anySolo ? track.soloed : !track.muted;
          
          const clipStartAbsolute = clip.startTime;
          let whenToPlay = now + (clipStartAbsolute - transportStart);
          let offset = clip.offset;
          
          // CRITICAL: use the timeline duration for playback stopping, but buffer logic for looping
          let playDuration = clip.duration; 

          if (whenToPlay < now) {
            const timePassed = now - whenToPlay;
            if (timePassed > playDuration && !clip.loop) return;
            
            // Adjust offset for start
            // Note: For looped clips, we need to mod the offset by buffer duration
            if (clip.loop) {
                 const bufferDur = clip.buffer.duration / clip.playbackRate;
                 offset = (offset + (timePassed * clip.playbackRate)) % clip.buffer.duration;
            } else {
                 offset += timePassed * clip.playbackRate;
            }
            
            playDuration -= timePassed;
            whenToPlay = now;
          }

          if (playDuration <= 0 && !clip.loop) return;

          const source = ctx.createBufferSource();
          source.buffer = clip.buffer;
          source.playbackRate.value = clip.playbackRate;
          source.loop = clip.loop;
          
          if (clip.loop) {
              source.loopStart = 0;
              source.loopEnd = clip.buffer.duration;
          }

          const clipGain = ctx.createGain();
          clipGain.gain.value = clip.gain;
          const clipPanner = ctx.createStereoPanner();
          clipPanner.pan.value = clip.pan;

          source.connect(clipPanner);
          clipPanner.connect(clipGain);
          
          if (clip.loop) {
              // Play indefinitely (looping) but stop exactly at clip duration end
              source.start(whenToPlay, offset);
              // Stop it when the timeline block ends
              source.stop(whenToPlay + playDuration);
          } else {
              if (playDuration > 0) source.start(whenToPlay, offset, playDuration * clip.playbackRate); // playDuration is in timeline time, start() duration arg is somewhat tricky with playbackRate, but usually safe to omit if not looping or rely on stop()
          }
          
          const nodes = this.trackNodes.get(track.id);
          if (nodes) {
              nodes.fader.gain.value = isAudible ? track.volume : 0;
          }

          onNodeCreated(clip, source, clipGain, clipPanner);
      });
  }

  public stop() {
    this.activeSources.forEach(({ source, gain, panner }) => {
      try {
        source.stop();
        source.disconnect();
        gain.disconnect();
        panner.disconnect();
      } catch (e) { }
    });
    this.activeSources.clear();

    // Stop Metronome
    this.metronomeNodes.forEach(node => {
        try {
            node.disconnect();
            if (node instanceof OscillatorNode) node.stop();
        } catch(e) {}
    });
    this.metronomeNodes = [];
    
    this.trackNodes.forEach(nodes => {
        nodes.fader.gain.cancelScheduledValues(this.context.currentTime);
        nodes.panner.pan.cancelScheduledValues(this.context.currentTime);
        nodes.pluginMap.forEach(node => {
            ['_frequency', '_mix', '_time', '_decay', '_dry'].forEach(p => {
                if (node[p]) (node[p] as AudioParam).cancelScheduledValues(this.context.currentTime);
            });
        });
    });
  }

  public stopPlayback() {
      this.stop();
  }

  // --- Bounce / Flatten ---
  
  public async bounceClip(clip: AudioClip): Promise<AudioBuffer> {
      // The duration of the new buffer matches the timeline duration of the clip
      const duration = clip.duration;
      const sampleRate = this.context.sampleRate;
      
      const offlineCtx = new OfflineAudioContext(2, duration * sampleRate, sampleRate);
      
      const source = offlineCtx.createBufferSource();
      source.buffer = clip.buffer;
      source.playbackRate.value = clip.playbackRate;
      
      // Calculate start offset in buffer time (seconds)
      const offset = clip.offset;
      
      // Schedule to play EXACTLY what is audible
      // Note: playbackRate affects how fast we consume the buffer.
      // To fill 'duration' seconds of output at rate 'R', we need 'duration * R' seconds of source.
      
      source.connect(offlineCtx.destination);
      source.start(0, offset, duration * clip.playbackRate);
      
      return await offlineCtx.startRendering();
  }

  // --- Export / Render ---

  public async renderOffline(clips: AudioClip[], tracks: Track[]): Promise<Blob> {
      const totalDuration = Math.max(...clips.map(c => c.startTime + c.duration)) + 1;
      const sampleRate = 44100;
      
      const offlineCtx = new OfflineAudioContext(2, totalDuration * sampleRate, sampleRate);
      
      const offlineTrackInputs = new Map<string, GainNode>();
      const offlineMasterFader = offlineCtx.createGain();
      offlineMasterFader.connect(offlineCtx.destination);
      
      const masterTrack = tracks.find(t => t.isMaster);
      offlineMasterFader.gain.value = masterTrack ? masterTrack.volume : 1.0;
      
      tracks.forEach(track => {
          if (track.isMaster) return;
          
          const input = offlineCtx.createGain();
          const panner = offlineCtx.createStereoPanner();
          const fader = offlineCtx.createGain();
          
          let prev: AudioNode = input;
          track.plugins.forEach(p => {
              if (p.enabled) {
                  const nodeOrGraph = this.createPluginNode(offlineCtx, p);
                  if (nodeOrGraph instanceof AudioNode) {
                    prev.connect(nodeOrGraph);
                    prev = nodeOrGraph;
                  } else {
                    prev.connect(nodeOrGraph.input);
                    prev = nodeOrGraph.output;
                  }
              }
          });
          
          prev.connect(panner);
          panner.connect(fader);
          fader.connect(offlineMasterFader);
          
          fader.gain.value = track.volume;
          
          offlineTrackInputs.set(track.id, input);
      });
      
      const anySolo = tracks.some(t => t.soloed);
      
      this.scheduleClips(offlineCtx, clips, tracks, 0, 0, anySolo, (clip, source, gain, panner) => {
          const input = offlineTrackInputs.get(clip.trackId);
          if (input) gain.connect(input);
      });
      
      const renderedBuffer = await offlineCtx.startRendering();
      return this.bufferToWav(renderedBuffer);
  }
  
  private bufferToWav(buffer: AudioBuffer): Blob {
      const numOfChan = buffer.numberOfChannels;
      const length = buffer.length * numOfChan * 2 + 44;
      const bufferArr = new ArrayBuffer(length);
      const view = new DataView(bufferArr);
      const channels = [];
      let i;
      let sample;
      let offset = 0;
      let pos = 0;
  
      setUint32(0x46464952); // "RIFF"
      setUint32(length - 8); // file length - 8
      setUint32(0x45564157); // "WAVE"
  
      setUint32(0x20746d66); // "fmt " chunk
      setUint32(16); // length = 16
      setUint16(1); // PCM
      setUint16(numOfChan);
      setUint32(buffer.sampleRate);
      setUint32(buffer.sampleRate * 2 * numOfChan); // avg. bytes/sec
      setUint16(numOfChan * 2); // block-align
      setUint16(16); // 16-bit
  
      setUint32(0x61746164); // "data"
      setUint32(length - pos - 4); // chunk length
  
      for(i = 0; i < buffer.numberOfChannels; i++)
        channels.push(buffer.getChannelData(i));
  
      while(pos < buffer.length) {
        for(i = 0; i < numOfChan; i++) {
          sample = Math.max(-1, Math.min(1, channels[i][pos])); 
          sample = (0.5 + sample < 0 ? sample * 32768 : sample * 32767)|0; 
          view.setInt16(44 + offset, sample, true);
          offset += 2;
        }
        pos++;
      }
  
      return new Blob([bufferArr], { type: "audio/wav" });
  
      function setUint16(data: any) {
        view.setUint16(pos, data, true);
        pos += 2;
      }
      function setUint32(data: any) {
        view.setUint32(pos, data, true);
        pos += 4;
      }
  }

  // --- Recording ---

  public async startRecording(): Promise<void> {
    try {
        // Reuse monitor stream if available to avoid hardware conflict
        let stream = this.monitorStream;
        
        if (!stream) {
            console.log("No monitor stream found, requesting new stream");
            this.recordingStream = await navigator.mediaDevices.getUserMedia({ 
                audio: {
                    deviceId: this.currentInputDeviceId !== 'default' ? { exact: this.currentInputDeviceId } : undefined
                } 
            });
            stream = this.recordingStream;
        }

        this.mediaRecorder = new MediaRecorder(stream);
        this.recordingChunks = [];
        this.mediaRecorder.ondataavailable = (e) => {
            if (e.data.size > 0) this.recordingChunks.push(e.data);
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
            
            // Only stop the stream if we created it locally (not monitoring)
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

  // --- Analysis & Stem Splitting ---

  public async getAudioAnalysisInput(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
  }

  public async separateStemsAdvanced(
    file: File, 
    instruments: string[], 
    onProgress: (msg: string) => void
  ): Promise<{name: string, type: PluginType, buffer: AudioBuffer, plugins: AudioPlugin[]}[]> {
      onProgress("Decoding audio for processing...");
      const originalBuffer = await this.loadFile(file);
      
      const results: {name: string, type: PluginType, buffer: AudioBuffer, plugins: AudioPlugin[]}[] = [];
      
      for (const inst of instruments) {
          const lowerName = inst.toLowerCase();
          onProgress(`Extracting ${inst}...`);
          
          let buffer: AudioBuffer;
          let type: PluginType = 'LOWPASS'; 
          const plugins: AudioPlugin[] = [];

          if (lowerName.includes('bass')) {
             buffer = await this.renderFiltered(originalBuffer, 'LOW');
             type = 'LOWPASS';
          } else if (lowerName.includes('drum') || lowerName.includes('percussion')) {
             buffer = await this.renderFiltered(originalBuffer, 'DRUMS');
             type = 'DISTORTION'; // Just using as a placeholder for track type or similar
          } else if (lowerName.includes('vocal')) {
             buffer = await this.renderFiltered(originalBuffer, 'MID');
             type = 'REVERB';
             plugins.push({
                 id: Math.random().toString(36).substr(2, 9),
                 type: 'REVERB',
                 enabled: true,
                 params: { mix: 0.3, decay: 1.5, type: 0 }
             });
          } else {
             buffer = await this.renderFiltered(originalBuffer, 'HIGH');
             type = 'HIGHPASS';
          }

          results.push({
              name: inst,
              type: type,
              buffer: buffer,
              plugins: plugins
          });
      }
      
      return results;
  }

  private async renderFiltered(sourceBuffer: AudioBuffer, profile: 'LOW' | 'MID' | 'HIGH' | 'DRUMS'): Promise<AudioBuffer> {
        const length = sourceBuffer.length;
        const sampleRate = sourceBuffer.sampleRate;
        const offlineCtx = new OfflineAudioContext(sourceBuffer.numberOfChannels, length, sampleRate);
        
        const source = offlineCtx.createBufferSource();
        source.buffer = sourceBuffer;
        
        let head: AudioNode = source;
        
        if (profile === 'LOW') {
            const f = offlineCtx.createBiquadFilter();
            f.type = 'lowpass';
            f.frequency.value = 300;
            head.connect(f);
            head = f;
        } else if (profile === 'MID') {
            const hp = offlineCtx.createBiquadFilter();
            hp.type = 'highpass';
            hp.frequency.value = 300;
            const lp = offlineCtx.createBiquadFilter();
            lp.type = 'lowpass';
            lp.frequency.value = 5000;
            head.connect(hp);
            hp.connect(lp);
            head = lp;
        } else if (profile === 'HIGH') {
            const f = offlineCtx.createBiquadFilter();
            f.type = 'highpass';
            f.frequency.value = 5000;
            head.connect(f);
            head = f;
        } else if (profile === 'DRUMS') {
            // Scoop mids for drums
            const lows = offlineCtx.createBiquadFilter();
            lows.type = 'lowshelf';
            lows.frequency.value = 200;
            lows.gain.value = 4;
            
            const mids = offlineCtx.createBiquadFilter();
            mids.type = 'peaking';
            mids.frequency.value = 1000;
            mids.Q.value = 1;
            mids.gain.value = -6;

            const highs = offlineCtx.createBiquadFilter();
            highs.type = 'highshelf';
            highs.frequency.value = 6000;
            highs.gain.value = 3;
            
            head.connect(lows);
            lows.connect(mids);
            mids.connect(highs);
            head = highs;
        }
        
        head.connect(offlineCtx.destination);
        source.start();
        return await offlineCtx.startRendering();
  }
}

export const audioService = new AudioEngine();
