
import React, { useState, useEffect, useRef } from 'react';
import { X, Mic, Speaker, Layers, Timer, Download, Settings, Loader2, Activity } from 'lucide-react';
import { audioService } from '../services/audioEngine';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExportStems: () => void;
}

type Tab = 'AUDIO' | 'EXPORT' | 'CALIBRATION';

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, onExportStems }) => {
  const [activeTab, setActiveTab] = useState<Tab>('AUDIO');
  const [inputDevices, setInputDevices] = useState<MediaDeviceInfo[]>([]);
  const [outputDevices, setOutputDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedInput, setSelectedInput] = useState<string>('default');
  const [selectedOutput, setSelectedOutput] = useState<string>('default');
  
  // Calibration State
  const [isCalibrating, setIsCalibrating] = useState(false);
  const [calibrationStep, setCalibrationStep] = useState(0); // 0: Idle, 1: Playing/Recording, 2: Done
  const [latencyResult, setLatencyResult] = useState(audioService.latencySeconds * 1000);
  const [calibrationError, setCalibrationError] = useState('');
  const [detectedClaps, setDetectedClaps] = useState<number>(0);

  useEffect(() => {
    if (isOpen) {
       loadDevices();
    }
  }, [isOpen]);

  const loadDevices = async () => {
      const devices = await audioService.getAvailableDevices();
      setInputDevices(devices.inputs);
      setOutputDevices(devices.outputs);
  };

  const handleInputCheck = (e: React.ChangeEvent<HTMLSelectElement>) => {
      const id = e.target.value;
      setSelectedInput(id);
      audioService.setInputDevice(id);
  };

  const handleOutputCheck = (e: React.ChangeEvent<HTMLSelectElement>) => {
      const id = e.target.value;
      setSelectedOutput(id);
      audioService.setOutputDevice(id);
  };
  
  const startCalibration = async () => {
      setIsCalibrating(true);
      setCalibrationStep(1);
      setCalibrationError('');
      setDetectedClaps(0);
      
      try {
          // Resume context just in case
          await audioService.resume();

          // 1. Start Recording
          await audioService.startRecording();
          
          const ctx = audioService.getContext();
          const now = ctx.currentTime;
          
          // Configuration for multi-click test
          const bpm = 120;
          const beatInterval = 60 / bpm; // 0.5s
          const startDelay = 0.5; 
          const numberOfBeats = 8;
          
          const expectedTimes: number[] = [];
          
          // Schedule 8 clicks
          for (let i = 0; i < numberOfBeats; i++) {
              const time = now + startDelay + (i * beatInterval);
              // Store relative time for analysis
              expectedTimes.push(startDelay + (i * beatInterval));
              
              // Accent on the first beat of each bar (assuming 4/4)
              const isAccent = i % 4 === 0;
              audioService.playClick(time, isAccent); 
          }
          
          const totalDuration = startDelay + (numberOfBeats * beatInterval) + 1.0; // +1s tail
          
          // 2. Wait for sequence to finish
          setTimeout(async () => {
              const blob = await audioService.stopRecording();
              if (!blob) {
                  setCalibrationError("Recording failed.");
                  setIsCalibrating(false);
                  setCalibrationStep(0);
                  return;
              }
              
              const buffer = await audioService.decodeBlob(blob);
              const data = buffer.getChannelData(0);
              const sampleRate = buffer.sampleRate;
              
              const latencies: number[] = [];
              
              // Analyze each expected beat
              for (let i = 0; i < expectedTimes.length; i++) {
                  const expectedTime = expectedTimes[i];
                  
                  // Search Window: -100ms to +400ms around expected beat
                  const startWindow = Math.floor((expectedTime - 0.1) * sampleRate);
                  const endWindow = Math.floor((expectedTime + 0.4) * sampleRate);
                  
                  const startIdx = Math.max(0, startWindow);
                  const endIdx = Math.min(data.length, endWindow);
                  
                  // Find peak amplitude in window
                  let maxVal = 0;
                  let maxIdx = 0;
                  
                  for(let j = startIdx; j < endIdx; j++) {
                      const val = Math.abs(data[j]);
                      if (val > maxVal) {
                          maxVal = val;
                          maxIdx = j;
                      }
                  }
                  
                  // Threshold to detect a clap (adjust based on mic sensitivity, but 0.1 is reasonable for a clap)
                  if (maxVal > 0.1) {
                      const detectedTime = maxIdx / sampleRate;
                      const latency = detectedTime - expectedTime;
                      latencies.push(latency);
                  }
              }
              
              setDetectedClaps(latencies.length);

              if (latencies.length < 4) {
                   setCalibrationError(`Only detected ${latencies.length}/8 claps. Please clap louder and on beat.`);
                   setIsCalibrating(false);
                   setCalibrationStep(0);
                   return;
              }
              
              // Calculate Average Latency
              // We filter out extreme outliers if necessary, but for now simple average
              const sum = latencies.reduce((a, b) => a + b, 0);
              const avg = sum / latencies.length;
              
              // Latency shouldn't really be negative unless system clock is weird or user is rushing heavily
              const finalLatency = Math.max(0, avg);
              
              setLatencyResult(finalLatency * 1000); // ms
              audioService.latencySeconds = finalLatency;
              
              setCalibrationStep(2);
              setIsCalibrating(false);
              
          }, totalDuration * 1000);
          
      } catch (e) {
          console.error(e);
          setCalibrationError("Calibration failed. Check permissions.");
          setIsCalibrating(false);
          setCalibrationStep(0);
      }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-full max-w-2xl flex flex-col h-[500px] animate-slide-up">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-800 bg-gray-850">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Settings size={20} className="text-blue-400" /> Preferences
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X size={20} />
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
            {/* Sidebar */}
            <div className="w-48 bg-gray-900 border-r border-gray-800 flex flex-col p-2 space-y-1">
                <button 
                    onClick={() => setActiveTab('AUDIO')} 
                    className={`text-left px-4 py-3 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors ${activeTab === 'AUDIO' ? 'bg-blue-600/20 text-blue-400' : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'}`}
                >
                    <Speaker size={16} /> Audio
                </button>
                <button 
                    onClick={() => setActiveTab('EXPORT')} 
                    className={`text-left px-4 py-3 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors ${activeTab === 'EXPORT' ? 'bg-blue-600/20 text-blue-400' : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'}`}
                >
                    <Download size={16} /> Export
                </button>
                <button 
                    onClick={() => setActiveTab('CALIBRATION')} 
                    className={`text-left px-4 py-3 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors ${activeTab === 'CALIBRATION' ? 'bg-blue-600/20 text-blue-400' : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'}`}
                >
                    <Timer size={16} /> Latency
                </button>
            </div>

            {/* Content */}
            <div className="flex-1 p-6 overflow-y-auto bg-gray-900/50">
                
                {activeTab === 'AUDIO' && (
                    <div className="space-y-6 animate-fade-in">
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
                                <Mic size={16} /> Input Device
                            </label>
                            <select 
                                value={selectedInput} 
                                onChange={handleInputCheck}
                                className="w-full bg-gray-800 border border-gray-700 text-white text-sm rounded-lg p-2.5 outline-none focus:border-blue-500"
                            >
                                <option value="default">Default Input</option>
                                {inputDevices.map(d => (
                                    <option key={d.deviceId} value={d.deviceId}>{d.label || `Device ${d.deviceId.slice(0,5)}...`}</option>
                                ))}
                            </select>
                            <p className="mt-2 text-xs text-gray-500">Requires microphone permissions to list devices.</p>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
                                <Speaker size={16} /> Output Device
                            </label>
                            <select 
                                value={selectedOutput} 
                                onChange={handleOutputCheck}
                                className="w-full bg-gray-800 border border-gray-700 text-white text-sm rounded-lg p-2.5 outline-none focus:border-blue-500"
                            >
                                <option value="default">Default Output</option>
                                {outputDevices.map(d => (
                                    <option key={d.deviceId} value={d.deviceId}>{d.label || `Device ${d.deviceId.slice(0,5)}...`}</option>
                                ))}
                            </select>
                            <p className="mt-2 text-xs text-gray-500">Output routing is currently supported on Chrome and Edge.</p>
                        </div>
                    </div>
                )}

                {activeTab === 'EXPORT' && (
                    <div className="space-y-6 animate-fade-in">
                        <div className="p-4 bg-gray-800 rounded-lg border border-gray-700">
                             <h3 className="text-white font-medium mb-2">Export Stems</h3>
                             <p className="text-sm text-gray-400 mb-4">Export each track as a separate WAV file. Useful for mixing in other software.</p>
                             <button 
                                onClick={onExportStems}
                                className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-sm font-medium flex items-center gap-2"
                             >
                                <Layers size={16} /> Export All Stems
                             </button>
                        </div>
                        <div className="p-4 bg-gray-800 rounded-lg border border-gray-700 opacity-60">
                             <h3 className="text-white font-medium mb-2">Mixdown Settings</h3>
                             <p className="text-sm text-gray-400">Current Format: WAV 16-bit 44.1kHz (Fixed)</p>
                        </div>
                    </div>
                )}

                {activeTab === 'CALIBRATION' && (
                    <div className="space-y-6 animate-fade-in">
                        <div className="prose prose-invert prose-sm">
                            <h3 className="text-white m-0">Latency Compensation</h3>
                            <p className="text-gray-400">
                                If your recordings feel "late" or off-beat, calibrate your system latency here.
                            </p>
                        </div>

                        <div className="flex flex-col items-center justify-center p-8 bg-gray-800/50 rounded-xl border border-gray-700 gap-4 min-h-[200px]">
                            {calibrationStep === 0 && (
                                <button 
                                    onClick={startCalibration}
                                    className="px-6 py-3 bg-blue-600 hover:bg-blue-500 rounded-full text-white font-bold flex items-center gap-2 shadow-lg hover:scale-105 transition-all"
                                >
                                    Start Calibration Test
                                </button>
                            )}
                            
                            {calibrationStep === 1 && (
                                <div className="flex flex-col items-center gap-4 text-center">
                                    <div className="flex gap-2 mb-2">
                                        <Activity className="animate-pulse text-blue-500" size={32} />
                                    </div>
                                    <span className="font-mono text-lg font-bold text-yellow-400">Clap along to the beat (8 clicks)...</span>
                                    <div className="text-xs text-gray-500">We'll average your timing for better accuracy.</div>
                                    <Loader2 className="animate-spin text-gray-500 mt-2" size={20} />
                                </div>
                            )}

                            {calibrationStep === 2 && (
                                <div className="flex flex-col items-center gap-2 animate-fade-in">
                                     <div className="text-3xl font-bold text-green-400">{latencyResult.toFixed(1)} ms</div>
                                     <span className="text-sm text-gray-400">Average Latency ({detectedClaps} samples)</span>
                                     <button onClick={startCalibration} className="text-xs text-blue-400 hover:underline mt-2">Retest</button>
                                </div>
                            )}
                            
                            {calibrationError && (
                                <div className="text-red-400 text-sm font-bold bg-red-900/20 px-4 py-2 rounded">{calibrationError}</div>
                            )}
                        </div>

                        <div className="flex flex-col gap-2">
                            <label className="text-sm font-medium text-gray-300">Manual Offset (ms)</label>
                            <div className="flex gap-4 items-center">
                                <input 
                                    type="range" min="0" max="1000" 
                                    value={latencyResult}
                                    onChange={(e) => {
                                        const val = Number(e.target.value);
                                        setLatencyResult(val);
                                        audioService.latencySeconds = val / 1000;
                                    }}
                                    className="flex-1 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                                />
                                <input 
                                    type="number" 
                                    value={latencyResult.toFixed(0)}
                                    onChange={(e) => {
                                        const val = Number(e.target.value);
                                        setLatencyResult(val);
                                        audioService.latencySeconds = val / 1000;
                                    }}
                                    className="w-16 bg-gray-800 border border-gray-700 rounded p-1 text-white text-right outline-none focus:border-blue-500"
                                />
                            </div>
                            <p className="text-[10px] text-gray-500">Higher values shift the recorded clip to the left (earlier in time).</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
      </div>
    </div>
  );
};
