import {
  AudioClip,
  Track,
  AudioPlugin,
  AutomationPoint,
  PluginType,
} from "../types";
import { analyze } from "web-audio-beat-detector";

interface ActiveSource {
  source: AudioBufferSourceNode;
  gain: GainNode;
  panner: StereoPannerNode;
  trackId: string;
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
  private monitorSplitter: ChannelSplitterNode | null = null;
  private monitorTrackId: string | null = null;

  private recordingSource: MediaStreamAudioSourceNode | null = null;
  private recordingSplitter: ChannelSplitterNode | null = null;
  private recordingDest: MediaStreamAudioDestinationNode | null = null;
  private recordingGain: GainNode | null = null;

  private currentInputDeviceId: string = "default";
  public latencySeconds: number = 0.025; // Default 25ms manual offset
  private bpm: number = 120;

  constructor() {
    this.context = new (
      window.AudioContext || (window as any).webkitAudioContext
    )({
      latencyHint: "interactive",
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

  public setBpm(bpm: number) {
    this.bpm = bpm;
  }

  public getContext() {
    return this.context;
  }

  public async resume() {
    if (this.context.state === "suspended") {
      await this.context.resume();
    }
  }

  // --- Device Management ---

  public async getAvailableDevices(requestPermission: boolean = false) {
    // Ensure we have permissions first to get labels if requested
    if (requestPermission) {
      try {
        await navigator.mediaDevices
          .getUserMedia({ audio: true })
          .then((s) => s.getTracks().forEach((t) => t.stop()));
      } catch (e) {
        console.warn("Could not get permission for enumerating devices");
      }
    }

    const devices = await navigator.mediaDevices.enumerateDevices();
    return {
      inputs: devices.filter((d) => d.kind === "audioinput"),
      outputs: devices.filter((d) => d.kind === "audiooutput"),
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
    if ("setSinkId" in this.context.destination) {
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
    try {
      const arrayBuffer = await file.arrayBuffer();
      return await this.context.decodeAudioData(arrayBuffer);
    } catch (e) {
      console.error("AudioEngine: Error decoding file", file.name, e);
      throw new Error(
        `Could not decode audio from ${file.name}. Ensure it is a supported audio or video format.`,
      );
    }
  }

  public async decodeBlob(blob: Blob): Promise<AudioBuffer> {
    try {
      const arrayBuffer = await blob.arrayBuffer();
      return await this.context.decodeAudioData(arrayBuffer);
    } catch (e) {
      console.error("AudioEngine: Error decoding blob", e);
      throw new Error("Could not decode recorded audio blob.");
    }
  }

  // --- Metronome & Calibration ---
  public scheduleMetronome(
    bpm: number,
    startTime: number,
    duration: number = 600,
  ) {
    const beatDuration = 60 / bpm;
    const totalBeats = Math.floor(duration / beatDuration);

    const metronomeGain = this.context.createGain();
    metronomeGain.gain.value = 0.3;
    metronomeGain.connect(this.context.destination);
    this.metronomeNodes.push(metronomeGain);

    for (let i = 0; i < totalBeats; i++) {
      const time = startTime + i * beatDuration;
      const isDownbeat = i % 4 === 0;

      this.playClick(time, isDownbeat, metronomeGain);
    }
  }

  public playClick(
    time: number,
    isHigh: boolean = false,
    destination: AudioNode = this.context.destination,
  ) {
    const osc = this.context.createOscillator();
    osc.type = "square";
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

      setTimeout(
        () => {
          resolve();
        },
        totalBeats * beatDuration * 1000,
      );
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
      pluginMap: new Map(),
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
      nodes.pluginNodes.forEach((n) => {
        if (n instanceof AudioNode) n.disconnect();
        else (n as any).output.disconnect();
      });
      this.trackNodes.delete(trackId);
    }
  }

  public getTrackAnalyser(trackId: string): AnalyserNode | null {
    if (trackId === "master") return this.masterAnalyser;
    return this.trackNodes.get(trackId)?.analyser || null;
  }

  public getTrackMonitorAnalyser(trackId: string): AnalyserNode | null {
    if (this.monitorTrackId === trackId) {
      return this.monitorAnalyser;
    }
    return null;
  }

  public async enableMonitoring(trackId: string, inputChannel: number = 1) {
    if (this.monitorStream) {
      this.disableMonitoring();
    }

    try {
      const deviceToUse = this.currentInputDeviceId;
      this.monitorStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          deviceId:
            deviceToUse !== "default" && deviceToUse
              ? { exact: deviceToUse }
              : undefined,
          echoCancellation: false,
          autoGainControl: false,
          noiseSuppression: false,
          latency: 0,
          channelCount: { ideal: 8 }, // Request multi-channel if available
        } as any,
      });

      this.monitorSource = this.context.createMediaStreamSource(
        this.monitorStream,
      );

      const streamChannels =
        this.monitorStream.getAudioTracks()[0]?.getSettings().channelCount || 2;
      this.monitorSplitter = this.context.createChannelSplitter(
        Math.max(streamChannels, 8),
      );

      this.monitorAnalyser = this.context.createAnalyser();
      this.monitorAnalyser.fftSize = 256;
      this.monitorAnalyser.smoothingTimeConstant = 0.8;

      // Create a mute gain node to keep the graph active without feedback
      this.monitorGain = this.context.createGain();
      this.monitorGain.gain.value = 0;

      this.monitorSource.connect(this.monitorSplitter);

      // Map 1-based channel to 0-based index, clamp to available outputs
      const channelIndex = Math.max(
        0,
        Math.min(
          inputChannel - 1,
          (this.monitorSplitter.numberOfOutputs || 8) - 1,
        ),
      );

      this.monitorSplitter.connect(this.monitorAnalyser, channelIndex, 0);
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
    if (this.monitorSplitter) {
      this.monitorSplitter.disconnect();
      this.monitorSplitter = null;
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
      this.monitorStream.getTracks().forEach((t) => t.stop());
      this.monitorStream = null;
    }
    this.monitorTrackId = null;
  }

  public updateTrackVolume(trackId: string, volume: number) {
    if (trackId === "master") {
      this.masterFader.gain.setTargetAtTime(
        volume,
        this.context.currentTime,
        0.02,
      );
      return;
    }
    const nodes = this.trackNodes.get(trackId);
    if (nodes) {
      nodes.fader.gain.setTargetAtTime(volume, this.context.currentTime, 0.02);
    }
  }

  public applyRealtimeSoloMute(tracks: Track[]) {
    const anySolo = tracks.some((t) => t.soloed);
    const now = this.context.currentTime;

    tracks.forEach((track) => {
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
    if (trackId === "master") {
      this.rebuildMasterChain(plugins);
    } else {
      this.rebuildTrackChain(trackId, plugins);
    }
  }

  // --- Plugin Factory ---

  private createPluginNode(
    context: BaseAudioContext,
    plugin: AudioPlugin,
  ): AudioNode | { input: AudioNode; output: AudioNode; [key: string]: any } {
    switch (plugin.type) {
      case "DELAY":
        const delayInput = context.createGain();
        const delayOutput = context.createGain();
        const delayNode = context.createDelay(5.0); // max delay 5s
        const feedbackNode = context.createGain();
        const delayDry = context.createGain();
        const delayWet = context.createGain();

        // Add filters for color/character
        const lpFilter = context.createBiquadFilter();
        lpFilter.type = "lowpass";
        lpFilter.frequency.value = Number(plugin.params.lowpassFreq) || 20000;

        const hpFilter = context.createBiquadFilter();
        hpFilter.type = "highpass";
        hpFilter.frequency.value = Number(plugin.params.highpassFreq) || 20;

        delayNode.delayTime.value = Number(plugin.params.time) || 0.3;
        if (plugin.params.syncToTempo) {
          const beatDuration = 60 / this.bpm;
          delayNode.delayTime.value =
            beatDuration * (Number(plugin.params.tempoMultiplier) || 1);
        }
        feedbackNode.gain.value = Number(plugin.params.feedback) || 0.4;

        const dMix = Number(plugin.params.mix ?? 0.5);
        delayDry.gain.value = 1 - dMix;
        delayWet.gain.value = dMix;

        delayInput.connect(delayDry);
        delayDry.connect(delayOutput);

        delayInput.connect(delayNode);
        delayNode.connect(hpFilter);
        hpFilter.connect(lpFilter);
        lpFilter.connect(delayWet);
        delayWet.connect(delayOutput);

        // Feedback from after filters so each repetition gets more filtered (analog style!)
        lpFilter.connect(feedbackNode);
        feedbackNode.connect(delayNode);

        return {
          input: delayInput,
          output: delayOutput,
          _time: delayNode.delayTime,
          _feedback: feedbackNode.gain,
          _mix: delayWet.gain,
          _dry: delayDry.gain,
          _lpFreq: lpFilter.frequency,
          _hpFreq: hpFilter.frequency,
        };

      case "DISTORTION": {
        // A more professional distortion circuit:
        // Input -> Pre-Gain -> Highpass (tighten low end) -> WaveShaper -> Lowpass (Tone) -> Output Gain (compensate) -> Mix
        const distInput = context.createGain();
        const distOutput = context.createGain();

        const preGain = context.createGain();
        const hpfDist = context.createBiquadFilter();
        hpfDist.type = "highpass";

        const waveShaper = context.createWaveShaper();
        waveShaper.oversample = "4x";

        const lpfDist = context.createBiquadFilter();
        lpfDist.type = "lowpass";

        const postGain = context.createGain();

        const distDry = context.createGain();
        const distWet = context.createGain();

        // set values
        const drive = Number(plugin.params.drive || 50);
        const tone = Number(plugin.params.tone || 5000);
        const mixDist = Number(plugin.params.mix ?? 1.0);
        const distType = String(plugin.params.distType || "soft");

        hpfDist.frequency.value = Number(plugin.params.tight || 150);
        lpfDist.frequency.value = tone;

        // Drive controls the input gain into the waveshaper
        preGain.gain.value = 1 + drive / 10;

        waveShaper.curve = this.makeDistortionCurve(drive, distType);

        // Auto-gain compensation (rough approximation)
        postGain.gain.value = 1 / (1 + drive / 20);

        distDry.gain.value = 1 - mixDist;
        distWet.gain.value = mixDist;

        distInput.connect(distDry);
        distDry.connect(distOutput);

        distInput.connect(preGain);
        preGain.connect(hpfDist);
        hpfDist.connect(waveShaper);
        waveShaper.connect(lpfDist);
        lpfDist.connect(postGain);
        postGain.connect(distWet);
        distWet.connect(distOutput);

        return {
          input: distInput,
          output: distOutput,
          _tone: lpfDist.frequency,
          _mix: distWet.gain,
          _dry: distDry.gain,
          _tight: hpfDist.frequency,
        };
      }

      case "FILTER": {
        const filtInput = context.createGain();
        const filtOutput = context.createGain();

        const preGain = context.createGain();
        const filter = context.createBiquadFilter();
        const filtShaper = context.createWaveShaper();
        const postGain = context.createGain();

        const filtDry = context.createGain();
        const filtWet = context.createGain();

        // params
        const type =
          (plugin.params.filterType as BiquadFilterType) || "lowpass";
        const freq = Number(plugin.params.frequency) || 1000;
        const q = Number(plugin.params.q || plugin.params.Q || 1); // fallback
        const drive = Number(plugin.params.drive || 0); // 0 to 100
        const mix = Number(plugin.params.mix ?? 1.0);

        filter.type = type;
        filter.frequency.value = freq;
        filter.Q.value = q;

        // Drive saturates the output of the filter
        filtShaper.curve = this.makeDistortionCurve(drive, "soft");
        preGain.gain.value = 1 + drive / 20; // slightly boost into filter
        postGain.gain.value = 1 / (1 + drive / 15); // compensate

        filtDry.gain.value = 1 - mix;
        filtWet.gain.value = mix;

        filtInput.connect(filtDry);
        filtDry.connect(filtOutput);

        filtInput.connect(preGain);
        preGain.connect(filter);
        filter.connect(filtShaper);
        filtShaper.connect(postGain);
        postGain.connect(filtWet);
        filtWet.connect(filtOutput);

        return {
          input: filtInput,
          output: filtOutput,
          _frequency: filter.frequency,
          _Q: filter.Q,
          _type: type,
          _mix: filtWet.gain,
          _dry: filtDry.gain,
        };
      }

      case "TAPE_SATURATION": {
        const tapeInput = context.createGain();
        const tapeOutput = context.createGain();
        const tapeDry = context.createGain();
        const tapeWet = context.createGain();

        const inputDrive = context.createGain();

        // Emulate head bump
        const headBump = context.createBiquadFilter();
        headBump.type = "peaking";

        // Saturation
        const tapeShaper = context.createWaveShaper();
        tapeShaper.oversample = "4x";

        // HF Roll-off
        const hfRollOff = context.createBiquadFilter();
        hfRollOff.type = "lowpass";

        const outputTrim = context.createGain();

        const driveDb = Number(plugin.params.drive ?? 0); // 0 to 24 dB
        const bias = Number(plugin.params.bias ?? 0.0); // -1.0 to 1.0 (asymmetry)
        const ips = Number(plugin.params.ips ?? 15); // 7.5, 15, 30
        const mix = Number(plugin.params.mix ?? 1.0);
        const makeupDb = Number(plugin.params.makeup ?? 0);

        // Config based on IPS (speed)
        if (ips >= 30) {
          headBump.frequency.value = 35;
          headBump.Q.value = 0.5;
          headBump.gain.value = 1.0;
          hfRollOff.frequency.value = 20000;
        } else if (ips <= 7.5) {
          headBump.frequency.value = 40;
          headBump.Q.value = 1.2;
          headBump.gain.value = 3.0;
          hfRollOff.frequency.value = 8000;
        } else {
          // 15 ips
          headBump.frequency.value = 60;
          headBump.Q.value = 1.0;
          headBump.gain.value = 2.0;
          hfRollOff.frequency.value = 15000;
        }

        inputDrive.gain.value = Math.pow(10, driveDb / 20);

        // crude auto-makeup: more drive = more compression/clipping = lower average peak
        const autoMakeup = Math.pow(10, driveDb / 40);
        outputTrim.gain.value = Math.pow(10, makeupDb / 20) / autoMakeup;

        // Create asymmetric tanh-like curve
        const n_samples = 4096;
        const curve = new Float32Array(n_samples);
        for (let i = 0; i < n_samples; ++i) {
          let x = (i * 2) / n_samples - 1;
          // add bias
          x += bias * 0.2;

          // soft clip
          let val = Math.atan(x * 1.5) / Math.atan(1.5);
          // remove DC offset introduced by bias roughly
          val -= bias * 0.1;

          curve[i] = val;
        }
        tapeShaper.curve = curve;

        tapeDry.gain.value = 1 - mix;
        tapeWet.gain.value = mix;

        tapeInput.connect(tapeDry);
        tapeDry.connect(tapeOutput);

        tapeInput.connect(inputDrive);
        inputDrive.connect(headBump);
        headBump.connect(tapeShaper);
        tapeShaper.connect(hfRollOff);
        hfRollOff.connect(outputTrim);
        outputTrim.connect(tapeWet);
        tapeWet.connect(tapeOutput);

        return {
          input: tapeInput,
          output: tapeOutput,
          _drive: inputDrive.gain,
          _makeup: outputTrim.gain,
          _dry: tapeDry.gain,
          _mix: tapeWet.gain,
        };
      }

      case "REVERB":
        const inputNode = context.createGain();
        const outputNode = context.createGain();
        const dryGain = context.createGain();
        const wetGain = context.createGain();
        const convolver = context.createConvolver();

        const preDelay = context.createDelay(1.0);
        const hpfRev = context.createBiquadFilter();
        hpfRev.type = "highpass";
        const lpfRev = context.createBiquadFilter();
        lpfRev.type = "lowpass";

        const mix = Number(plugin.params.mix ?? 0.5);
        const reverbType = Number(plugin.params.reverbType ?? 0);
        const decay = Number(plugin.params.decay || 2.0);
        const preDelayTime = Number(plugin.params.preDelay || 0);

        hpfRev.frequency.value = Number(plugin.params.highpassFreq || 20);
        lpfRev.frequency.value = Number(plugin.params.lowpassFreq || 20000);
        preDelay.delayTime.value = preDelayTime / 1000.0;

        dryGain.gain.value = 1 - mix;
        wetGain.gain.value = mix;

        convolver.buffer = this.getReverbBuffer(context, reverbType, decay);

        inputNode.connect(dryGain);
        dryGain.connect(outputNode);

        inputNode.connect(preDelay);
        preDelay.connect(hpfRev);
        hpfRev.connect(lpfRev);
        lpfRev.connect(convolver);
        convolver.connect(wetGain);
        wetGain.connect(outputNode);

        return {
          input: inputNode,
          output: outputNode,
          _mix: wetGain.gain,
          _dry: dryGain.gain,
          _preDelay: preDelay.delayTime,
          _hpf: hpfRev.frequency,
          _lpf: lpfRev.frequency,
        };

        // Web Audio API doesn't have native pitch correction.
        // This creates a "Travis Scott/Kanye" vocal chain approximation:
        // Highpass -> Saturation -> Comb Filter (Robotic Tone) -> Chorus Widener -> EQ
        const atInput = context.createGain();
        const atOutput = context.createGain();

        // 1. Highpass to remove mud
        const atHp = context.createBiquadFilter();
        atHp.type = "highpass";
        atHp.frequency.value = 120;

        // 2. Crisp Saturation
        const atDist = context.createWaveShaper();
        atDist.curve = this.makeDistortionCurve(15);

        // 3. Comb filter for robotic resonance
        const atDelay = context.createDelay();
        const pitchOffset = Number(plugin.params.pitch) || 0;

        const keyStr = (plugin.params.key as string) || "C";
        const keys = [
          "C",
          "C#",
          "D",
          "D#",
          "E",
          "F",
          "F#",
          "G",
          "G#",
          "A",
          "A#",
          "B",
        ];
        const keyIndex = Math.max(0, keys.indexOf(keyStr));

        // Base frequency for C2 is 65.406 Hz. Apply pitch offset.
        const baseFreq = 65.406 * Math.pow(2, (keyIndex + pitchOffset) / 12);

        // Target a harmonic in the vocal range (e.g., C4)
        let targetFreq = baseFreq * 4;
        // Prevent delay time from going too low or high
        targetFreq = Math.max(50, Math.min(targetFreq, 2000));

        atDelay.delayTime.value = 1.0 / targetFreq;

        const atFeedback = context.createGain();
        atFeedback.gain.value = 0.85;

        // 4. EQ to boost presence
        const atFilter = context.createBiquadFilter();
        atFilter.type = "peaking";
        atFilter.frequency.value = targetFreq * 4; // Boost higher harmonics
        atFilter.Q.value = 1.5;
        atFilter.gain.value = 5; // Boost presence

        // 5. Chorus/Widener
        const chorusDelay = context.createDelay();
        chorusDelay.delayTime.value = 0.02;
        const lfo = context.createOscillator();
        lfo.type = "sine";
        lfo.frequency.value = (Number(plugin.params.speed) || 0.1) * 50; // Speed controls LFO rate
        const lfoGain = context.createGain();
        lfoGain.gain.value = 0.002;
        lfo.connect(lfoGain);
        lfoGain.connect(chorusDelay.delayTime);
        lfo.start();

        const atMix = Number(plugin.params.mix ?? 1.0);
        const atDry = context.createGain();
        const atWet = context.createGain();
        atDry.gain.value = 1 - atMix;
        atWet.gain.value = atMix;

        // Routing
        atInput.connect(atDry);
        atDry.connect(atOutput);

        atInput.connect(atHp);
        atHp.connect(atDist);

        // Comb filter loop
        atDist.connect(atDelay);
        atDelay.connect(atFeedback);
        atFeedback.connect(atDelay);

        atDelay.connect(atFilter);

        // Split to chorus and direct
        atFilter.connect(atWet);
        atFilter.connect(chorusDelay);
        chorusDelay.connect(atWet);

        atWet.connect(atOutput);

        return {
          input: atInput,
          output: atOutput,
          _mix: atWet.gain,
          _dry: atDry.gain,
        };

      case "LIMITER": {
        const limInput = context.createGain();
        const limOutput = context.createGain();

        const limDrive = context.createGain();
        const limComp = context.createDynamicsCompressor();
        const limClipper = context.createWaveShaper();
        const limCeiling = context.createGain();

        const driveDb = Number(plugin.params.drive || 0); // 0 to 24 dB
        const ceilingDb = Number(plugin.params.ceiling ?? -0.1); // -24 to 0 dB
        const releaseMs = Number(plugin.params.release || 100); // 1 to 500 ms
        const mode = String(plugin.params.mode || "transparent");

        // Convert dB to linear gain
        limDrive.gain.value = Math.pow(10, driveDb / 20);
        limCeiling.gain.value = Math.pow(10, ceilingDb / 20);

        limComp.threshold.value = -0.5; // Threshold near 0dB
        limComp.attack.value = 0.001; // Fast as possible
        limComp.release.value = releaseMs / 1000;

        if (mode === "transparent") {
          limComp.ratio.value = 20;
          limComp.knee.value = 5;
          limClipper.curve = this.makeDistortionCurve(5, "soft"); // gentle safety
        } else if (mode === "punchy") {
          limComp.ratio.value = 10;
          limComp.knee.value = 0;
          limComp.attack.value = 0.005; // let transients through
          limClipper.curve = this.makeDistortionCurve(10, "hard"); // catch peaks hard
        } else if (mode === "aggressive") {
          limComp.ratio.value = 50;
          limComp.knee.value = 0;
          limClipper.curve = this.makeDistortionCurve(20, "soft"); // add saturation
        } else {
          limComp.ratio.value = 20;
          limComp.knee.value = 0;
          limClipper.curve = this.makeDistortionCurve(10, "hard");
        }

        limInput.connect(limDrive);
        limDrive.connect(limComp);
        limComp.connect(limClipper);
        limClipper.connect(limCeiling);
        limCeiling.connect(limOutput);

        return {
          input: limInput,
          output: limOutput,
          _drive: limDrive.gain,
          _ceiling: limCeiling.gain,
          _release: limComp.release,
        };
      }

      case "COMPRESSOR": {
        const compInput = context.createGain();
        const compOutput = context.createGain();

        const compDry = context.createGain();
        const compWet = context.createGain();

        const compNode = context.createDynamicsCompressor();
        const makeupGain = context.createGain();

        const thresDb = Number(plugin.params.threshold ?? -20);
        const ratio = Number(plugin.params.ratio ?? 4);
        const attackMs = Number(plugin.params.attack ?? 10);
        const releaseMs = Number(plugin.params.release ?? 100);
        const knee = Number(plugin.params.knee ?? 10);
        const makeupDb = Number(plugin.params.makeup ?? 0);
        const mixVal = Number(plugin.params.mix ?? 1.0);

        compNode.threshold.value = thresDb;
        compNode.ratio.value = ratio;
        compNode.attack.value = attackMs / 1000;
        compNode.release.value = releaseMs / 1000;
        compNode.knee.value = knee;

        makeupGain.gain.value = Math.pow(10, makeupDb / 20);

        compDry.gain.value = 1 - mixVal;
        compWet.gain.value = mixVal;

        compInput.connect(compDry);
        compDry.connect(compOutput);

        compInput.connect(compNode);
        compNode.connect(makeupGain);
        makeupGain.connect(compWet);
        compWet.connect(compOutput);

        return {
          input: compInput,
          output: compOutput,
          _makeup: makeupGain.gain,
          _dry: compDry.gain,
          _mix: compWet.gain,
        };
      }

      case "SIDECHAIN": {
        const scInput = context.createGain(); // Target track input
        const scOutput = context.createGain(); // Target track output

        // This gain will do the ducking
        const duckingGain = context.createGain();
        duckingGain.gain.value = 1.0;

        // The external sidechain signal arrives here
        const externalInput = context.createGain();

        // Boost/drive the external signal to hit the threshold better
        const scDrive = context.createGain();
        scDrive.gain.value = 1.0;

        // Rectifier and Threshold
        const detector = context.createWaveShaper();
        const n_samples = 4096;
        const curve = new Float32Array(n_samples);
        const thresholdDb = Number(plugin.params.threshold ?? -20);
        const thresholdLin = Math.pow(10, thresholdDb / 20);
        
        // Aggressive multiplier for hard pumping
        const sidechainDrive = 15.0;

        for (let i = 0; i < n_samples; i++) {
          const x = (i * 2) / n_samples - 1;
          const absX = Math.abs(x);
          if (absX > thresholdLin) {
             let env = (absX - thresholdLin) * sidechainDrive;
             // Clamp to 1.0 to prevent phase inversion when ducking
             if (env > 1.0) env = 1.0;
             curve[i] = env;
          } else {
             curve[i] = 0;
          }
        }
        detector.curve = curve;

        // Envelope Smoothing
        const envFilter = context.createBiquadFilter();
        envFilter.type = "lowpass";
        // freq = 1 / (2 * pi * release_in_seconds)
        const attackMs = Number(plugin.params.attack || 10);
        const releaseMs = Number(plugin.params.release || 100);
        const avgTimeMs = (attackMs + releaseMs) / 2; // approximation for biquad
        const freq = 1000 / (2 * Math.PI * Math.max(1, avgTimeMs));
        envFilter.frequency.value = Math.max(0.1, freq);
        envFilter.Q.value = 0.5; // critically damped

        // Map positive envelope to negative gain change
        const depth = Number(plugin.params.depth ?? 80) / 100;
        const inverter = context.createGain();
        // Since we clamped the envelope to 1.0 max, 
        // a depth of 100% means the gain will drop to 1.0 - 1.0 = 0.0
        inverter.gain.value = -depth;

        // Connections
        scInput.connect(duckingGain);
        duckingGain.connect(scOutput);

        externalInput.connect(scDrive);
        scDrive.connect(detector);
        detector.connect(envFilter);
        envFilter.connect(inverter);
        inverter.connect(duckingGain.gain); // modulates the gain!

        return {
          input: scInput,
          output: scOutput,
          compressor: externalInput, // The engine connects source track to node.compressor!
          _filter: envFilter,
          _inverter: inverter.gain,
        };
      }

      case "EQ": {
        const eqInput = context.createGain();
        const eqOutput = context.createGain();
        let prev: AudioNode = eqInput;
        const filters: BiquadFilterNode[] = [];

        for (let i = 0; i < 8; i++) {
          const active = plugin.params[`band${i}_active`] !== false; // defaults to true
          if (!active) continue; // Skip creating/connecting this filter if not active!

          const f = context.createBiquadFilter();
          f.type =
            (plugin.params[`band${i}_type`] as BiquadFilterType) || "peaking";
          f.frequency.value =
            Number(plugin.params[`band${i}_freq`]) || 100 * Math.pow(2, i);
          f.gain.value = Number(plugin.params[`band${i}_gain`]) || 0;
          f.Q.value = Number(plugin.params[`band${i}_q`]) || 1;

          prev.connect(f);
          prev = f;
          filters.push(f);
        }

        prev.connect(eqOutput);

        // Return structured node dict so it doesn't break parameter mapping if any
        return {
          input: eqInput,
          output: eqOutput,
          filters,
          ...filters.reduce(
            (acc, f, i) => ({
              ...acc,
              [`_b${i}_f`]: f.frequency,
              [`_b${i}_g`]: f.gain,
              [`_b${i}_q`]: f.Q,
            }),
            {},
          ),
        };
      }

      case "BITCRUSHER": {
        const bcInput = context.createGain();
        const bcOutput = context.createGain();
        const bcDry = context.createGain();
        const bcWet = context.createGain();

        const bcDrive = context.createGain();
        const bcPreFilter = context.createBiquadFilter();
        const bcShaper = context.createWaveShaper();
        const bcPostFilter = context.createBiquadFilter();

        const bits = Number(plugin.params.bits ?? 8);
        const driveDb = Number(plugin.params.drive ?? 0);
        const preCut = Number(plugin.params.preCut ?? 20);
        const postCut = Number(plugin.params.postCut ?? 20000);
        const bcMix = Number(plugin.params.mix ?? 1.0);

        bcDrive.gain.value = Math.pow(10, driveDb / 20);

        bcPreFilter.type = "highpass";
        bcPreFilter.frequency.value = preCut;

        bcPostFilter.type = "lowpass";
        bcPostFilter.frequency.value = postCut;

        // Bitcrush simulation using waveshaper
        if (bits >= 24) {
          bcShaper.curve = null;
        } else {
          const steps = Math.pow(2, bits);
          const bcCurve = new Float32Array(4096);
          for (let i = 0; i < 4096; i++) {
            const x = (i / 4096) * 2 - 1;
            // Basic quantization
            let val = Math.round(x * (steps / 2)) / (steps / 2);
            bcCurve[i] = val;
          }
          bcShaper.curve = bcCurve;
        }

        bcDry.gain.value = 1 - bcMix;
        bcWet.gain.value = bcMix;

        bcInput.connect(bcDry);
        bcDry.connect(bcOutput);

        bcInput.connect(bcPreFilter);
        bcPreFilter.connect(bcDrive);
        bcDrive.connect(bcShaper);
        bcShaper.connect(bcPostFilter);
        bcPostFilter.connect(bcWet);
        bcWet.connect(bcOutput);

        return {
          input: bcInput,
          output: bcOutput,
          _drive: bcDrive.gain,
          _pre: bcPreFilter.frequency,
          _post: bcPostFilter.frequency,
          _dry: bcDry.gain,
          _mix: bcWet.gain,
        };
      }

      default:
        return context.createGain();
    }
  }

  private rebuildTrackChain(trackId: string, plugins: AudioPlugin[]) {
    const nodes = this.trackNodes.get(trackId);
    if (!nodes) return;

    nodes.input.disconnect();
    nodes.pluginNodes.forEach((n) => {
      if (n instanceof AudioNode) n.disconnect();
      else {
        (n as any).output.disconnect();
      }
    });
    nodes.pluginNodes = [];
    nodes.pluginMap.clear();

    let previousOutput: AudioNode = nodes.input;

    plugins.forEach((plugin) => {
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

      if (plugin.type === "SIDECHAIN" && plugin.params.sourceTrackId) {
        const sourceTrackId = plugin.params.sourceTrackId as string;
        const sourceNodes = this.trackNodes.get(sourceTrackId);
        if (sourceNodes && (nodeOrGraph as any).compressor) {
          sourceNodes.output.connect((nodeOrGraph as any).compressor);
        }
      }
    });

    previousOutput.connect(nodes.output);
  }

  private rebuildMasterChain(plugins: AudioPlugin[]) {
    this.masterInput.disconnect();
    this.masterPluginNodes.forEach((n) => {
      if (n instanceof AudioNode) n.disconnect();
      else {
        (n as any).output.disconnect();
      }
    });
    this.masterPluginNodes = [];

    let previousOutput: AudioNode = this.masterInput;

    plugins.forEach((plugin) => {
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

  private makeDistortionCurve(amount: number, type: string = "soft") {
    const k = typeof amount === "number" ? amount : 50;
    const n_samples = 44100;
    const curve = new Float32Array(n_samples);
    const deg = Math.PI / 180;
    for (let i = 0; i < n_samples; ++i) {
      const x = (i * 2) / n_samples - 1;

      if (type === "hard") {
        // Hard clipping
        const threshold = Math.max(0.01, 1 - (k / 100) * 0.95);
        curve[i] = x > threshold ? threshold : x < -threshold ? -threshold : x;
        curve[i] = curve[i] * (1 / threshold) * 0.8;
      } else if (type === "fuzz") {
        // Fuzz (Asymmetrical heavy clipping)
        const driveAmount = Math.max(1, k * 2);
        const offset = 0.05 * (k / 100);
        curve[i] =
          Math.sign(x + offset) *
          (1 - Math.exp(-driveAmount * Math.abs(x + offset)));
      } else {
        // Soft clipping
        curve[i] = ((3 + k) * x * 20 * deg) / (Math.PI + k * Math.abs(x));
      }
    }
    return curve;
  }

  private getReverbBuffer(
    context: BaseAudioContext,
    type: number,
    decayTime: number,
  ) {
    const sampleRate = context.sampleRate;
    const length = Math.max(1, Math.floor(sampleRate * decayTime));
    const impulse = context.createBuffer(2, length, sampleRate);
    const left = impulse.getChannelData(0);
    const right = impulse.getChannelData(1);

    // Type 0: Hall (long, dark)
    // Type 1: Room (short, bright)
    // Type 2: Plate (dense, medium bright)
    // Type 3: Spring (boingy, metallic)

    let lpFreq = 5000;
    let decayFactor = 1.5;
    let isSpring = false;

    if (type === 0) {
      // Hall
      lpFreq = 3000;
      decayFactor = decayTime * 1.5;
    } else if (type === 1) {
      // Room
      lpFreq = 8000;
      decayFactor = decayTime * 4;
    } else if (type === 2) {
      // Plate
      lpFreq = 6000;
      decayFactor = decayTime * 2;
    } else if (type === 3) {
      // Spring
      lpFreq = 4000;
      decayFactor = decayTime * 3;
      isSpring = true;
    }

    // Simple one-pole lowpass filter coefficient
    const dt = 1.0 / sampleRate;
    const rc = 1.0 / (2.0 * Math.PI * lpFreq);
    const alpha = dt / (rc + dt);

    let lastL = 0;
    let lastR = 0;

    for (let i = 0; i < length; i++) {
      let decay = Math.pow(1 - i / length, decayFactor);

      // Generate noise
      let noiseL = Math.random() * 2 - 1;
      let noiseR = Math.random() * 2 - 1;

      // Spring effect: add some periodic "boing"
      if (isSpring) {
        const boing = Math.sin(i * 0.05) * Math.exp(-i * 0.001);
        noiseL += boing * 0.5;
        noiseR += boing * 0.5;
      }

      // Apply lowpass filter
      lastL = lastL + alpha * (noiseL - lastL);
      lastR = lastR + alpha * (noiseR - lastR);

      left[i] = lastL * decay;
      right[i] = lastR * decay;
    }

    return impulse;
  }

  // --- Analysis & Alignment ---

  public calculateAlignmentLag(
    refData: Float32Array,
    targetData: Float32Array,
    sampleRate: number,
  ): number {
    // 1. Downsample to ~4kHz for performance speedup
    // Comparing 4096 samples instead of 44100
    const ratio = Math.floor(sampleRate / 4000);
    const len = Math.floor(Math.min(refData.length, targetData.length) / ratio);

    if (len < 50) return 0;

    const smallRef = new Float32Array(len);
    const smallTgt = new Float32Array(len);

    for (let i = 0; i < len; i++) {
      smallRef[i] = refData[i * ratio];
      smallTgt[i] = targetData[i * ratio];
    }

    // 2. Cross Correlation
    // Search Range: +/- 200ms
    const maxShift = Math.floor(0.2 * 4000); // approx 800 samples at 4kHz

    let bestShift = 0;
    let maxCorr = -Infinity;

    for (let shift = -maxShift; shift <= maxShift; shift++) {
      let sum = 0;
      let count = 0;
      for (let i = 0; i < len; i++) {
        const j = i + shift;
        if (j >= 0 && j < len) {
          sum += smallRef[i] * smallTgt[j];
          count++;
        }
      }

      // Normalize for number of overlaps to avoid biasing towards zero shift
      if (count > 0) {
        const avg = sum / count;
        if (avg > maxCorr) {
          maxCorr = avg;
          bestShift = shift;
        }
      }
    }

    // Convert shift back to seconds
    // Negative shift means Target is late relative to Reference
    // We return the time value to SUBTRACT from Target's start time to align it.
    // If shift is +10 samples: Ref[i] matches Tgt[i+10]. Tgt is delayed.
    // To align, we need to move Tgt left (earlier).
    // offset = -(10 / rate)

    return -(bestShift / 4000);
  }

  // --- Playback & Automation ---

  public play(clips: AudioClip[], tracks: Track[], startTime: number) {
    this.stop();
    this.resume();
    const now = this.context.currentTime;

    const anySolo = tracks.some((t) => t.soloed);

    this.scheduleClips(
      this.context,
      clips,
      tracks,
      startTime,
      now,
      anySolo,
      (clip, source, gain, panner) => {
        const trackNodes = this.trackNodes.get(clip.trackId);
        if (trackNodes) {
          gain.connect(trackNodes.input);
        } else {
          gain.connect(this.masterInput);
        }

        this.activeSources.set(clip.id, { source, gain, panner, trackId: clip.trackId });
        source.onended = () => {
          const current = this.activeSources.get(clip.id);
          if (current && current.source === source) {
            this.activeSources.delete(clip.id);
          }
        };
      },
    );

    this.scheduleAutomation(tracks, startTime, now);
  }

  public updateAutomationLive(tracks: Track[], currentTime: number) {
    if (this.context.state !== "running") return;
    this.scheduleAutomation(tracks, currentTime, this.context.currentTime);
  }

  private getInterpolatedValueAtTime(
    points: AutomationPoint[],
    time: number,
  ): number {
    if (!points || points.length === 0) return 0;
    const sorted = [...points].sort((a, b) => a.time - b.time);
    const afterIdx = sorted.findIndex((p) => p.time >= time);
    if (afterIdx === 0) {
      return sorted[0].value;
    } else if (afterIdx === -1) {
      return sorted[sorted.length - 1].value;
    } else {
      const p1 = sorted[afterIdx - 1];
      const p2 = sorted[afterIdx];
      const ratio = (time - p1.time) / (p2.time - p1.time);
      return p1.value + ratio * (p2.value - p1.value);
    }
  }

  private scheduleAutomation(tracks: Track[], startTime: number, now: number) {
    tracks.forEach((track) => {
      if (!track.automation) return;
      const nodes = this.trackNodes.get(track.id);
      if (!nodes) return;

      Object.keys(track.automation).forEach((paramId) => {
        const points = track.automation[paramId];
        if (!points || points.length === 0) return;

        let param: AudioParam | null = null;
        const interpolatedNorm = this.getInterpolatedValueAtTime(
          points,
          startTime,
        );
        const initialValue = this.scaleAutomationValue(
          paramId,
          interpolatedNorm,
        );

        if (paramId === "volume") {
          param = nodes.fader.gain;
          param.cancelScheduledValues(now);
          param.setValueAtTime(initialValue, now);
        } else if (paramId === "playbackRate") {
          // Playback rate applies to all ACTIVE clip sources for this track
          const sorted = [...points].sort((a, b) => a.time - b.time);
          for (const active of this.activeSources.values()) {
            if (active.trackId === track.id) {
               const pbdParam = active.source.playbackRate;
               pbdParam.cancelScheduledValues(now);
               pbdParam.setValueAtTime(initialValue, now);
               sorted.forEach((point) => {
                 const absoluteTime = now + (point.time - startTime);
                 if (absoluteTime >= now) {
                    const scaledValue = this.scaleAutomationValue(paramId, point.value);
                    pbdParam.linearRampToValueAtTime(Math.max(0.001, scaledValue), Math.max(now + 0.001, absoluteTime));
                 }
               });
            }
          }
        } else if (paramId === "pan") {
          param = nodes.panner.pan;
          param.cancelScheduledValues(now);
          param.setValueAtTime(initialValue, now);
        } else if (paramId.includes(":")) {
          const [pluginId, paramName] = paramId.split(":");
          const pluginNode = nodes.pluginMap.get(pluginId);
          const internalProp = `_${paramName}`;
          if (pluginNode && pluginNode[internalProp]) {
            param = pluginNode[internalProp] as AudioParam;
            param.cancelScheduledValues(now);
            param.setValueAtTime(initialValue, now);
          }
        }

        if (param) {
          const sorted = [...points].sort((a, b) => a.time - b.time);
          sorted.forEach((point) => {
            const absoluteTime = now + (point.time - startTime);
            if (absoluteTime >= now) {
              const scaledValue = this.scaleAutomationValue(
                paramId,
                point.value,
              );
              // Use exponential ramp for natural sounding filter sweeps, linear for volume
              if (paramId.includes("frequency")) {
                // Filter frequency cannot be 0, provide min value
                param!.exponentialRampToValueAtTime(
                  Math.max(10, scaledValue),
                  Math.max(now + 0.001, absoluteTime),
                );
              } else {
                param!.linearRampToValueAtTime(
                  scaledValue,
                  Math.max(now + 0.001, absoluteTime),
                );
              }
            }
          });
        }
      });
    });
  }

  private scaleAutomationValue(
    paramId: string,
    normalizedValue: number,
  ): number {
    if (paramId === "volume") {
      let db = -60;
      if (normalizedValue <= 0.5) {
        db = -60 + normalizedValue * 2 * 60; // 0 -> -60dB, 0.5 -> 0dB
      } else {
        db = (normalizedValue - 0.5) * 2 * 24; // 0.5 -> 0dB, 1.0 -> +24dB
      }
      return db <= -60 ? 0 : Math.pow(10, db / 20);
    }
    if (paramId === "playbackRate") {
       // 0 -> 0x (stop), 0.5 -> 1x (normal), 1.0 -> 2x (double speed)
       return normalizedValue * 2.0;
    }
    if (paramId === "pan") return normalizedValue * 2 - 1; // -1 to 1

    const paramName = paramId.split(":")[1];
    if (!paramName) return normalizedValue;

    if (paramName === "frequency") {
      // Logarithmic mapping 20Hz -> 20kHz
      const min = 20;
      const max = 20000;
      // Math.pow(max/min, normalized) * min
      return min * Math.pow(max / min, normalizedValue);
    }
    if (paramName === "mix") return normalizedValue;
    if (paramName === "time") return normalizedValue * 1.0;
    if (paramName === "drive") return normalizedValue * 100;
    if (paramName === "decay") return normalizedValue * 10;

    return normalizedValue;
  }

  private scheduleClips(
    ctx: BaseAudioContext,
    clips: AudioClip[],
    tracks: Track[],
    transportStart: number,
    now: number,
    anySolo: boolean,
    onNodeCreated: (
      clip: AudioClip,
      source: AudioBufferSourceNode,
      gain: GainNode,
      panner: StereoPannerNode,
    ) => void,
  ) {
    clips.forEach((clip) => {
      const track = tracks.find((t) => t.id === clip.trackId);
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
          offset =
            (offset + timePassed * clip.playbackRate) % clip.buffer.duration;
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
        if (playDuration > 0)
          source.start(whenToPlay, offset, playDuration * clip.playbackRate); // playDuration is in timeline time, start() duration arg is somewhat tricky with playbackRate, but usually safe to omit if not looping or rely on stop()
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
      } catch (e) {}
    });
    this.activeSources.clear();

    // Stop Metronome
    this.metronomeNodes.forEach((node) => {
      try {
        node.disconnect();
        if (node instanceof OscillatorNode) node.stop();
      } catch (e) {}
    });
    this.metronomeNodes = [];

    this.trackNodes.forEach((nodes) => {
      nodes.fader.gain.cancelScheduledValues(this.context.currentTime);
      nodes.panner.pan.cancelScheduledValues(this.context.currentTime);
      nodes.pluginMap.forEach((node) => {
        ["_frequency", "_mix", "_time", "_decay", "_dry"].forEach((p) => {
          if (node[p])
            (node[p] as AudioParam).cancelScheduledValues(
              this.context.currentTime,
            );
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

    const offlineCtx = new OfflineAudioContext(
      2,
      duration * sampleRate,
      sampleRate,
    );

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

  public async renderOffline(
    clips: AudioClip[],
    tracks: Track[],
  ): Promise<Blob> {
    const totalDuration =
      Math.max(...clips.map((c) => c.startTime + c.duration)) + 1;
    const sampleRate = 44100;

    const offlineCtx = new OfflineAudioContext(
      2,
      totalDuration * sampleRate,
      sampleRate,
    );

    const offlineTrackInputs = new Map<string, GainNode>();
    const offlineMasterFader = offlineCtx.createGain();
    const offlineMasterPanner = offlineCtx.createStereoPanner();
    offlineMasterFader.connect(offlineMasterPanner);
    offlineMasterPanner.connect(offlineCtx.destination);

    const offlineNodesMap = new Map<string, any>(); // { fader: GainNode, panner: StereoPannerNode, pluginMap: Map }

    const masterTrack = tracks.find((t) => t.isMaster);
    offlineMasterFader.gain.value = masterTrack ? masterTrack.volume : 1.0;
    
    if (masterTrack) {
        const masterPluginsMap = new Map<string, any>();
        let masterPrev: AudioNode = offlineMasterPanner;
        
        masterTrack.plugins.forEach(p => {
           if (p.enabled) {
              const nodeOrGraph = this.createPluginNode(offlineCtx, p);
              masterPluginsMap.set(p.id, nodeOrGraph);
              if (nodeOrGraph instanceof AudioNode) {
                 masterPrev.connect(nodeOrGraph);
                 masterPrev = nodeOrGraph;
              } else {
                 masterPrev.connect(nodeOrGraph.input);
                 masterPrev = nodeOrGraph.output;
              }
           }
        });
        masterPrev.connect(offlineCtx.destination);
        offlineMasterPanner.disconnect();
        offlineMasterPanner.connect(masterPluginsMap.size > 0 ? masterPluginsMap.values().next().value instanceof AudioNode ? masterPluginsMap.values().next().value : masterPluginsMap.values().next().value.input : offlineCtx.destination);

        offlineNodesMap.set(masterTrack.id, { fader: offlineMasterFader, panner: offlineMasterPanner, pluginMap: masterPluginsMap });
    }

    tracks.forEach((track) => {
      if (track.isMaster) return;

      const input = offlineCtx.createGain();
      const panner = offlineCtx.createStereoPanner();
      const fader = offlineCtx.createGain();
      const pluginMap = new Map<string, any>();

      let prev: AudioNode = input;
      track.plugins.forEach((p) => {
        if (p.enabled) {
          const nodeOrGraph = this.createPluginNode(offlineCtx, p);
          pluginMap.set(p.id, nodeOrGraph);
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
      offlineNodesMap.set(track.id, { fader, panner, pluginMap });
    });

    const anySolo = tracks.some((t) => t.soloed);
    const offlineActiveSources: {trackId: string, source: AudioBufferSourceNode}[] = [];

    this.scheduleClips(
      offlineCtx,
      clips,
      tracks,
      0,
      0,
      anySolo,
      (clip, source, gain, panner) => {
        const input = offlineTrackInputs.get(clip.trackId);
        if (input) gain.connect(input);
        offlineActiveSources.push({ trackId: clip.trackId, source });
      },
    );

    // Schedule offline automation
    tracks.forEach(track => {
        if (!track.automation) return;
        const nodes = offlineNodesMap.get(track.id);
        if (!nodes) return;

        Object.keys(track.automation).forEach(paramId => {
            const points = track.automation[paramId];
            if (!points || points.length === 0) return;

            let param: AudioParam | null = null;
            const initialValue = this.scaleAutomationValue(paramId, this.getInterpolatedValueAtTime(points, 0));

            if (paramId === 'volume') {
                param = nodes.fader.gain;
                param.setValueAtTime(initialValue, 0);
            } else if (paramId === 'playbackRate') {
                const sorted = [...points].sort((a,b) => a.time - b.time);
                offlineActiveSources.forEach(active => {
                    if (active.trackId === track.id) {
                        const pbdParam = active.source.playbackRate;
                        pbdParam.setValueAtTime(initialValue, 0);
                        sorted.forEach(point => {
                            const scaledValue = this.scaleAutomationValue(paramId, point.value);
                            pbdParam.linearRampToValueAtTime(Math.max(0.001, scaledValue), Math.max(0.001, point.time));
                        });
                    }
                });
            } else if (paramId === 'pan') {
                param = nodes.panner.pan;
                param.setValueAtTime(initialValue, 0);
            } else if (paramId.includes(':')) {
                const [pluginId, paramName] = paramId.split(':');
                const pluginNode = nodes.pluginMap.get(pluginId);
                const internalProp = paramName + 'Node';
                if (pluginNode && pluginNode[internalProp]) {
                    param = pluginNode[internalProp] as AudioParam;
                    param.setValueAtTime(initialValue, 0);
                }
            }

            if (param) {
                const sorted = [...points].sort((a,b) => a.time - b.time);
                sorted.forEach(point => {
                    const scaledValue = this.scaleAutomationValue(paramId, point.value);
                    if (paramId.includes('frequency')) {
                        param!.exponentialRampToValueAtTime(Math.max(10, scaledValue), Math.max(0.001, point.time));
                    } else {
                        param!.linearRampToValueAtTime(scaledValue, Math.max(0.001, point.time));
                    }
                });
            }
        });
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

    for (i = 0; i < buffer.numberOfChannels; i++)
      channels.push(buffer.getChannelData(i));

    while (pos < buffer.length) {
      for (i = 0; i < numOfChan; i++) {
        sample = Math.max(-1, Math.min(1, channels[i][pos]));
        sample = (0.5 + sample < 0 ? sample * 32768 : sample * 32767) | 0;
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

  public async startRecording(inputChannel: number = 1): Promise<void> {
    try {
      // Reuse monitor stream if available to avoid hardware conflict
      let stream = this.monitorStream;

      if (!stream) {
        console.log("No monitor stream found, requesting new stream");
        const deviceToUse = this.currentInputDeviceId;
        this.recordingStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            deviceId:
              deviceToUse !== "default" && deviceToUse
                ? { exact: deviceToUse }
                : undefined,
            channelCount: { ideal: 8 },
          } as any,
        });
        stream = this.recordingStream;
      }

      // Use existing monitor nodes if available to avoid creating multiple MediaStreamAudioSourceNodes
      if (
        this.monitorSource &&
        this.monitorSplitter &&
        stream === this.monitorStream
      ) {
        this.recordingSource = null;
        this.recordingSplitter = null;
        this.recordingDest = this.context.createMediaStreamDestination();

        const channelIndex = Math.max(0, Math.min(inputChannel - 1, 7));

        // Connect the specific channel to the destination
        // We use a gain node to mix the mono channel to both L and R of the destination
        this.recordingGain = this.context.createGain();
        this.recordingGain.channelCount = 1;
        this.recordingGain.channelCountMode = "explicit";

        this.monitorSplitter.connect(this.recordingGain, channelIndex, 0);
        this.recordingGain.connect(this.recordingDest);
      } else {
        this.recordingSource = this.context.createMediaStreamSource(stream);

        // Note: MediaStreamAudioSourceNode's channelCount is read-only and follows the stream.
        // We use the ChannelSplitter to handle whatever count we got.
        const streamChannels =
          stream.getAudioTracks()[0]?.getSettings().channelCount || 2;
        this.recordingSplitter = this.context.createChannelSplitter(
          Math.max(streamChannels, 8),
        );
        this.recordingSource.connect(this.recordingSplitter);

        this.recordingDest = this.context.createMediaStreamDestination();
        const channelIndex = Math.max(
          0,
          Math.min(
            inputChannel - 1,
            (this.recordingSplitter.numberOfOutputs || 8) - 1,
          ),
        );

        this.recordingGain = this.context.createGain();
        this.recordingGain.channelCount = 1;
        this.recordingGain.channelCountMode = "explicit";

        this.recordingSplitter.connect(this.recordingGain, channelIndex, 0);
        this.recordingGain.connect(this.recordingDest);
      }

      this.mediaRecorder = new MediaRecorder(this.recordingDest.stream);
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
      if (!this.mediaRecorder || this.mediaRecorder.state === "inactive") {
        resolve(null);
        return;
      }
      this.mediaRecorder.onstop = () => {
        const blob = new Blob(this.recordingChunks, { type: "audio/webm" });
        this.recordingChunks = [];

        // Only stop the stream if we created it locally (not monitoring)
        if (this.recordingStream) {
          this.recordingStream.getTracks().forEach((track) => track.stop());
          this.recordingStream = null;
        }

        // Cleanup recording nodes
        if (this.recordingSource) {
          this.recordingSource.disconnect();
          this.recordingSource = null;
        }
        if (this.recordingSplitter) {
          this.recordingSplitter.disconnect();
          this.recordingSplitter = null;
        }
        if (this.recordingGain) {
          this.recordingGain.disconnect();
          this.recordingGain = null;
        }
        if (this.recordingDest) {
          this.recordingDest.disconnect();
          this.recordingDest = null;
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
    onProgress: (msg: string) => void,
  ): Promise<
    {
      name: string;
      type: PluginType;
      buffer: AudioBuffer;
      plugins: AudioPlugin[];
    }[]
  > {
    onProgress("Decoding audio for processing...");
    const originalBuffer = await this.loadFile(file);

    const results: {
      name: string;
      type: PluginType;
      buffer: AudioBuffer;
      plugins: AudioPlugin[];
    }[] = [];

    for (const inst of instruments) {
      const lowerName = inst.toLowerCase();
      onProgress(`Extracting ${inst}...`);

      let buffer: AudioBuffer;
      let type: PluginType = "FILTER";
      const plugins: AudioPlugin[] = [];

      if (lowerName.includes("bass")) {
        buffer = await this.renderFiltered(originalBuffer, "LOW");
        type = "FILTER";
      } else if (
        lowerName.includes("drum") ||
        lowerName.includes("percussion")
      ) {
        buffer = await this.renderFiltered(originalBuffer, "DRUMS");
        type = "DISTORTION"; // Just using as a placeholder for track type or similar
      } else if (lowerName.includes("vocal")) {
        buffer = await this.renderFiltered(originalBuffer, "MID");
        type = "REVERB";
        plugins.push({
          id: Math.random().toString(36).substr(2, 9),
          type: "REVERB",
          enabled: true,
          params: { mix: 0.3, decay: 1.5, type: 0 },
        });
      } else {
        buffer = await this.renderFiltered(originalBuffer, "HIGH");
        type = "FILTER";
      }

      results.push({
        name: inst,
        type: type,
        buffer: buffer,
        plugins: plugins,
      });
    }

    return results;
  }

  private async renderFiltered(
    sourceBuffer: AudioBuffer,
    profile: "LOW" | "MID" | "HIGH" | "DRUMS",
  ): Promise<AudioBuffer> {
    const length = sourceBuffer.length;
    const sampleRate = sourceBuffer.sampleRate;
    const offlineCtx = new OfflineAudioContext(
      sourceBuffer.numberOfChannels,
      length,
      sampleRate,
    );

    const source = offlineCtx.createBufferSource();
    source.buffer = sourceBuffer;

    let head: AudioNode = source;

    if (profile === "LOW") {
      const f = offlineCtx.createBiquadFilter();
      f.type = "lowpass";
      f.frequency.value = 300;
      head.connect(f);
      head = f;
    } else if (profile === "MID") {
      const hp = offlineCtx.createBiquadFilter();
      hp.type = "highpass";
      hp.frequency.value = 300;
      const lp = offlineCtx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = 5000;
      head.connect(hp);
      hp.connect(lp);
      head = lp;
    } else if (profile === "HIGH") {
      const f = offlineCtx.createBiquadFilter();
      f.type = "highpass";
      f.frequency.value = 5000;
      head.connect(f);
      head = f;
    } else if (profile === "DRUMS") {
      // Scoop mids for drums
      const lows = offlineCtx.createBiquadFilter();
      lows.type = "lowshelf";
      lows.frequency.value = 200;
      lows.gain.value = 4;

      const mids = offlineCtx.createBiquadFilter();
      mids.type = "peaking";
      mids.frequency.value = 1000;
      mids.Q.value = 1;
      mids.gain.value = -6;

      const highs = offlineCtx.createBiquadFilter();
      highs.type = "highshelf";
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
  public async detectTempo(buffer: AudioBuffer): Promise<number> {
    try {
      const tempo = await analyze(buffer);
      return Math.round(tempo);
    } catch (err) {
      console.error(
        "web-audio-beat-detector failed, falling back to simple detection",
        err,
      );
      // Fallback to simple peak detection algorithm for BPM
      const channelData = buffer.getChannelData(0);
      const sampleRate = buffer.sampleRate;

      // 1. Compute envelope (low-pass filter on squared signal)
      const blockSize = Math.floor(sampleRate / 100); // 10ms blocks
      const blocks = Math.floor(channelData.length / blockSize);
      const envelope = new Float32Array(blocks);

      for (let i = 0; i < blocks; i++) {
        let sum = 0;
        for (let j = 0; j < blockSize; j++) {
          const sample = channelData[i * blockSize + j];
          sum += sample * sample;
        }
        envelope[i] = Math.sqrt(sum / blockSize);
      }

      // 2. Find peaks
      const peaks: number[] = [];
      const threshold = 0.1; // Adjust as needed
      for (let i = 1; i < blocks - 1; i++) {
        if (
          envelope[i] > envelope[i - 1] &&
          envelope[i] > envelope[i + 1] &&
          envelope[i] > threshold
        ) {
          peaks.push((i * blockSize) / sampleRate); // Peak time in seconds
        }
      }

      // 3. Calculate intervals
      const intervals: Record<number, number> = {};
      for (let i = 0; i < peaks.length; i++) {
        for (let j = i + 1; j < Math.min(i + 10, peaks.length); j++) {
          const interval = peaks[j] - peaks[i];
          const bpm = Math.round(60 / interval);
          if (bpm >= 60 && bpm <= 200) {
            intervals[bpm] = (intervals[bpm] || 0) + 1;
          }
        }
      }

      // 4. Find most common BPM
      let bestBpm = 120;
      let maxCount = 0;
      for (const [bpmStr, count] of Object.entries(intervals)) {
        if (count > maxCount) {
          maxCount = count;
          bestBpm = parseInt(bpmStr);
        }
      }

      return bestBpm;
    }
  }
}

export const audioService = new AudioEngine();
