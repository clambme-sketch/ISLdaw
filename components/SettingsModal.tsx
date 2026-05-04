import React, { useState, useEffect, useRef } from "react";
import {
  X,
  Mic,
  Speaker,
  Layers,
  Timer,
  Download,
  Settings,
  Loader2,
  Activity,
  Palette,
} from "lucide-react";
import { audioService } from "../services/audioEngine";
import { useTheme } from "../ThemeContext";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExportStems: () => void;
  showInputChannelSelector: boolean;
  setShowInputChannelSelector: (show: boolean) => void;
}

type Tab = "AUDIO" | "EXPORT" | "CALIBRATION" | "APPEARANCE";

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  onExportStems,
  showInputChannelSelector,
  setShowInputChannelSelector,
}) => {
  const [activeTab, setActiveTab] = useState<Tab>("AUDIO");
  const {
    accentColor,
    setAccentColor,
    backgroundColor,
    setBackgroundColor,
    fontSize,
    setFontSize,
    fontFamily,
    setFontFamily,
    backgroundImage,
    setBackgroundImage,
    bgPosX,
    setBgPosX,
    bgPosY,
    setBgPosY,
    bgZoom,
    setBgZoom,
    bgBlend,
    setBgBlend,
  } = useTheme();

  const [inputDevices, setInputDevices] = useState<MediaDeviceInfo[]>([]);
  const [outputDevices, setOutputDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedInput, setSelectedInput] = useState<string>("default");
  const [selectedOutput, setSelectedOutput] = useState<string>("default");
  const [isDraggingBg, setIsDraggingBg] = useState(false);
  const [isDraggingPreview, setIsDraggingPreview] = useState(false);
  const [previewDragStart, setPreviewDragStart] = useState({ x: 0, y: 0 });

  // Calibration State
  const [isCalibrating, setIsCalibrating] = useState(false);
  const [calibrationStep, setCalibrationStep] = useState(0); // 0: Idle, 1: Playing/Recording, 2: Done
  const [latencyResult, setLatencyResult] = useState(
    audioService.latencySeconds * 1000,
  );
  const [calibrationError, setCalibrationError] = useState("");
  const [detectedClaps, setDetectedClaps] = useState<number>(0);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingPreview) return;
      const dx = e.clientX - previewDragStart.x;
      const dy = e.clientY - previewDragStart.y;

      // Convert pixel drag to percentage drag
      // Sensitivity: 1 pixel = 0.5%
      setBgPosX((prev) => Math.max(0, Math.min(100, prev - dx * 0.2)));
      setBgPosY((prev) => Math.max(0, Math.min(100, prev - dy * 0.2)));
      setPreviewDragStart({ x: e.clientX, y: e.clientY });
    };

    const handleMouseUp = () => {
      setIsDraggingPreview(false);
    };

    if (isDraggingPreview) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    }
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDraggingPreview, previewDragStart, setBgPosX, setBgPosY]);

  useEffect(() => {
    if (isOpen) {
      loadDevices();
    }
  }, [isOpen]);

  const loadDevices = async () => {
    const devices = await audioService.getAvailableDevices(false);
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
    setCalibrationError("");
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
        const time = now + startDelay + i * beatInterval;
        // Store relative time for analysis
        expectedTimes.push(startDelay + i * beatInterval);

        // Accent on the first beat of each bar (assuming 4/4)
        const isAccent = i % 4 === 0;
        audioService.playClick(time, isAccent);
      }

      const totalDuration = startDelay + numberOfBeats * beatInterval + 1.0; // +1s tail

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

          for (let j = startIdx; j < endIdx; j++) {
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
          setCalibrationError(
            `Only detected ${latencies.length}/8 claps. Please clap louder and on beat.`,
          );
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
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
      <div className="bg-[#2d2d2d] border border-[#111] rounded-none shadow-none w-full max-w-2xl flex flex-col h-[500px] transition-none">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[#111] bg-[#2d2d2d]">
          <h2 className="text-lg font-bold text-[#d4d4d4] flex items-center gap-2">
            <Settings size={20} className="text-[#ff7b00]" /> Preferences
          </h2>
          <button
            onClick={onClose}
            className="text-[#999] hover:text-[#d4d4d4]"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar */}
          <div className="w-48 bg-[#1e1e1e] border-r border-[#111] flex flex-col p-2 space-y-1">
            <button
              onClick={() => setActiveTab("AUDIO")}
              className={`text-left px-4 py-3 rounded-none text-sm font-medium flex items-center gap-2 transition-none ${activeTab === "AUDIO" ? "bg-[#ff7b00] text-black" : "text-[#999] hover:bg-[#444] hover:text-[#d4d4d4]"}`}
            >
              <Speaker size={16} /> Audio
            </button>
            <button
              onClick={() => setActiveTab("EXPORT")}
              className={`text-left px-4 py-3 rounded-none text-sm font-medium flex items-center gap-2 transition-none ${activeTab === "EXPORT" ? "bg-[#ff7b00] text-black" : "text-[#999] hover:bg-[#444] hover:text-[#d4d4d4]"}`}
            >
              <Download size={16} /> Export
            </button>
            <button
              onClick={() => setActiveTab("CALIBRATION")}
              className={`text-left px-4 py-3 rounded-none text-sm font-medium flex items-center gap-2 transition-none ${activeTab === "CALIBRATION" ? "bg-[#ff7b00] text-black" : "text-[#999] hover:bg-[#444] hover:text-[#d4d4d4]"}`}
            >
              <Timer size={16} /> Latency
            </button>
            <button
              onClick={() => setActiveTab("APPEARANCE")}
              className={`text-left px-4 py-3 rounded-none text-sm font-medium flex items-center gap-2 transition-none ${activeTab === "APPEARANCE" ? "bg-[#ff7b00] text-black" : "text-[#999] hover:bg-[#444] hover:text-[#d4d4d4]"}`}
            >
              <Palette size={16} /> Appearance
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 p-6 overflow-y-auto bg-[#2d2d2d]">
            {activeTab === "AUDIO" && (
              <div className="space-y-6 transition-none">
                <div>
                  <label className="block text-sm font-medium text-[#d4d4d4] mb-2 flex items-center gap-2">
                    <Mic size={16} /> Input Device
                  </label>
                  <select
                    value={selectedInput}
                    onChange={handleInputCheck}
                    className="w-full bg-[#111] border border-[#444] text-[#d4d4d4] text-sm rounded-none p-2.5 outline-none focus:border-[#ff7b00]"
                  >
                    <option value="default">Default Input</option>
                    {inputDevices.map((d) => (
                      <option key={d.deviceId} value={d.deviceId}>
                        {d.label || `Device ${d.deviceId.slice(0, 5)}...`}
                      </option>
                    ))}
                  </select>
                  <p className="mt-2 text-xs text-[#999]">
                    Requires microphone permissions to list devices.
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-[#d4d4d4] mb-2 flex items-center gap-2">
                    <Speaker size={16} /> Output Device
                  </label>
                  <select
                    value={selectedOutput}
                    onChange={handleOutputCheck}
                    className="w-full bg-[#111] border border-[#444] text-[#d4d4d4] text-sm rounded-none p-2.5 outline-none focus:border-[#ff7b00]"
                  >
                    <option value="default">Default Output</option>
                    {outputDevices.map((d) => (
                      <option key={d.deviceId} value={d.deviceId}>
                        {d.label || `Device ${d.deviceId.slice(0, 5)}...`}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-3 mt-4">
                  <input
                    type="checkbox"
                    id="showInputChannel"
                    checked={showInputChannelSelector}
                    onChange={(e) =>
                      setShowInputChannelSelector(e.target.checked)
                    }
                    className="w-4 h-4 accent-[#ff7b00]"
                  />
                  <label
                    htmlFor="showInputChannel"
                    className="text-sm font-medium text-[#d4d4d4] select-none hover:text-white cursor-pointer"
                  >
                    Show Input Channel Selector on Tracks
                  </label>
                </div>
              </div>
            )}

            {activeTab === "EXPORT" && (
              <div className="space-y-6 transition-none">
                <div className="p-4 bg-[#1e1e1e] rounded-none border border-[#111]">
                  <h3 className="text-[#d4d4d4] font-medium mb-2">
                    Export Stems
                  </h3>
                  <p className="text-sm text-[#999] mb-4">
                    Export each track as a separate WAV file. Useful for mixing
                    in other software.
                  </p>
                  <button
                    onClick={onExportStems}
                    className="px-4 py-2 bg-[#ff7b00] hover:bg-[#ffaa00] text-black rounded-none text-sm font-medium flex items-center gap-2 transition-none"
                  >
                    <Layers size={16} /> Export All Stems
                  </button>
                </div>
                <div className="p-4 bg-[#1e1e1e] rounded-none border border-[#111] opacity-60">
                  <h3 className="text-[#d4d4d4] font-medium mb-2">
                    Mixdown Settings
                  </h3>
                  <p className="text-sm text-[#999]">
                    Current Format: WAV 16-bit 44.1kHz (Fixed)
                  </p>
                </div>
              </div>
            )}

            {activeTab === "CALIBRATION" && (
              <div className="space-y-6 transition-none">
                <div className="prose prose-invert prose-sm">
                  <h3 className="text-[#d4d4d4] m-0">Latency Compensation</h3>
                  <p className="text-[#999]">
                    If your recordings feel "late" or off-beat, calibrate your
                    system latency here.
                  </p>
                </div>

                <div className="flex flex-col items-center justify-center p-8 bg-[#1e1e1e] rounded-none border border-[#111] gap-4 min-h-[200px]">
                  {calibrationStep === 0 && (
                    <button
                      onClick={startCalibration}
                      className="px-6 py-3 bg-[#ff7b00] hover:bg-[#ffaa00] rounded-none text-black font-bold flex items-center gap-2 shadow-none transition-none"
                    >
                      Start Calibration Test
                    </button>
                  )}

                  {calibrationStep === 1 && (
                    <div className="flex flex-col items-center gap-4 text-center">
                      <div className="flex gap-2 mb-2">
                        <Activity
                          className="animate-pulse text-[#ff7b00]"
                          size={32}
                        />
                      </div>
                      <span className="font-mono text-lg font-bold text-[#ffaa00]">
                        Clap along to the beat (8 clicks)...
                      </span>
                      <div className="text-xs text-[#999]">
                        We'll average your timing for better accuracy.
                      </div>
                      <Loader2
                        className="animate-spin text-[#999] mt-2"
                        size={20}
                      />
                    </div>
                  )}

                  {calibrationStep === 2 && (
                    <div className="flex flex-col items-center gap-2 transition-none">
                      <div className="text-3xl font-bold text-[#10b981]">
                        {latencyResult.toFixed(1)} ms
                      </div>
                      <span className="text-sm text-[#999]">
                        Average Latency ({detectedClaps} samples)
                      </span>
                      <button
                        onClick={startCalibration}
                        className="text-xs text-[#ff7b00] hover:underline mt-2"
                      >
                        Retest
                      </button>
                    </div>
                  )}

                  {calibrationError && (
                    <div className="text-[#ef4444] text-sm font-bold bg-[#ef4444]/20 px-4 py-2 rounded-none">
                      {calibrationError}
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium text-[#d4d4d4]">
                    Manual Offset (ms)
                  </label>
                  <div className="flex gap-4 items-center">
                    <input
                      type="range"
                      min="0"
                      max="1000"
                      value={latencyResult}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        setLatencyResult(val);
                        audioService.latencySeconds = val / 1000;
                      }}
                      className="flex-1 h-2 bg-[#111] rounded-none appearance-none cursor-pointer accent-[#ff7b00]"
                    />
                    <input
                      type="number"
                      value={latencyResult.toFixed(0)}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        setLatencyResult(val);
                        audioService.latencySeconds = val / 1000;
                      }}
                      className="w-16 bg-[#111] border border-[#444] rounded-none p-1 text-[#d4d4d4] text-right outline-none focus:border-[#ff7b00]"
                    />
                  </div>
                  <p className="text-[10px] text-[#999]">
                    Higher values shift the recorded clip to the left (earlier
                    in time).
                  </p>
                </div>
              </div>
            )}

            {activeTab === "APPEARANCE" && (
              <div className="space-y-6 transition-none">
                <div>
                  <label className="block text-sm font-medium text-[#d4d4d4] mb-2">
                    Accent Color
                  </label>
                  <div className="flex items-center gap-4">
                    <input
                      type="color"
                      value={accentColor}
                      onChange={(e) => setAccentColor(e.target.value)}
                      className="w-12 h-12 p-0 border-0 bg-transparent cursor-pointer"
                    />
                    <input
                      type="text"
                      value={accentColor}
                      onChange={(e) => setAccentColor(e.target.value)}
                      className="w-24 bg-[#111] border border-[#444] text-[#d4d4d4] text-sm rounded-none p-2 outline-none focus:border-[#ff7b00]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-[#d4d4d4] mb-2">
                    Background Color
                  </label>
                  <div className="flex items-center gap-4">
                    <input
                      type="color"
                      value={backgroundColor}
                      onChange={(e) => setBackgroundColor(e.target.value)}
                      className="w-12 h-12 p-0 border-0 bg-transparent cursor-pointer"
                    />
                    <input
                      type="text"
                      value={backgroundColor}
                      onChange={(e) => setBackgroundColor(e.target.value)}
                      className="w-24 bg-[#111] border border-[#444] text-[#d4d4d4] text-sm rounded-none p-2 outline-none focus:border-[#ff7b00]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-[#d4d4d4] mb-2">
                    Base Font Size (px)
                  </label>
                  <div className="flex items-center gap-4">
                    <input
                      type="range"
                      min="12"
                      max="24"
                      value={fontSize}
                      onChange={(e) => setFontSize(Number(e.target.value))}
                      className="flex-1 h-2 bg-[#111] rounded-none appearance-none cursor-pointer accent-[#ff7b00]"
                    />
                    <input
                      type="number"
                      value={fontSize}
                      onChange={(e) => setFontSize(Number(e.target.value))}
                      className="w-16 bg-[#111] border border-[#444] rounded-none p-1 text-[#d4d4d4] text-right outline-none focus:border-[#ff7b00]"
                    />
                  </div>
                  <p className="mt-2 text-xs text-[#999]">
                    Adjusts the overall scale of the UI typography.
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-[#d4d4d4] mb-2">
                    Font Family
                  </label>
                  <select
                    value={fontFamily}
                    onChange={(e) => setFontFamily(e.target.value)}
                    className="w-full bg-[#111] border border-[#444] text-[#d4d4d4] text-sm rounded-none p-2.5 outline-none focus:border-[#ff7b00]"
                  >
                    <option
                      value='-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
                      style={{
                        fontFamily:
                          '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
                      }}
                    >
                      Apple System (SF Pro)
                    </option>
                    <option
                      value='"Inter", sans-serif'
                      style={{ fontFamily: '"Inter", sans-serif' }}
                    >
                      Inter
                    </option>
                    <option
                      value='"Roboto", sans-serif'
                      style={{ fontFamily: '"Roboto", sans-serif' }}
                    >
                      Roboto
                    </option>
                    <option
                      value='"Helvetica Neue", Helvetica, Arial, sans-serif'
                      style={{
                        fontFamily:
                          '"Helvetica Neue", Helvetica, Arial, sans-serif',
                      }}
                    >
                      Helvetica Neue
                    </option>
                    <option
                      value='"Courier New", Courier, monospace'
                      style={{
                        fontFamily: '"Courier New", Courier, monospace',
                      }}
                    >
                      Courier New (Monospace)
                    </option>
                    <option
                      value='"Dancing Script", cursive'
                      style={{ fontFamily: '"Dancing Script", cursive' }}
                    >
                      Dancing Script (Calligraphy)
                    </option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-[#d4d4d4] mb-2">
                    Custom Background Image
                  </label>
                  <div
                    className={`border-2 border-dashed rounded-none p-6 flex flex-col items-center justify-center text-center transition-colors cursor-pointer relative ${isDraggingBg ? "border-[#ff7b00] bg-[#ff7b00]/10" : "border-[#444] bg-[#111] hover:border-[#ff7b00]"}`}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setIsDraggingBg(true);
                    }}
                    onDragLeave={() => setIsDraggingBg(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setIsDraggingBg(false);
                      if (
                        e.dataTransfer.files &&
                        e.dataTransfer.files.length > 0
                      ) {
                        const file = e.dataTransfer.files[0];
                        if (file.type.startsWith("image/")) {
                          const reader = new FileReader();
                          reader.onload = (ev) => {
                            if (ev.target?.result) {
                              setBackgroundImage(ev.target.result as string);
                            }
                          };
                          reader.readAsDataURL(file);
                        }
                      }
                    }}
                    onClick={() => {
                      const input = document.createElement("input");
                      input.type = "file";
                      input.accept = "image/*";
                      input.onchange = (e: any) => {
                        if (e.target.files && e.target.files.length > 0) {
                          const file = e.target.files[0];
                          const reader = new FileReader();
                          reader.onload = (ev) => {
                            if (ev.target?.result) {
                              setBackgroundImage(ev.target.result as string);
                            }
                          };
                          reader.readAsDataURL(file);
                        }
                      };
                      input.click();
                    }}
                  >
                    {backgroundImage ? (
                      <div className="flex flex-col items-center gap-2 relative w-full pt-2">
                        <div
                          className={`w-full max-w-[240px] h-32 rounded-none overflow-hidden border border-[#444] shadow-inner ${isDraggingPreview ? "cursor-grabbing" : "cursor-grab"}`}
                          style={{
                            backgroundImage: `url("${backgroundImage}")`,
                            backgroundPosition: `${bgPosX}% ${bgPosY}%`,
                            backgroundSize: `${bgZoom}%`,
                          }}
                          onMouseDown={(e) => {
                            e.stopPropagation();
                            setIsDraggingPreview(true);
                            setPreviewDragStart({ x: e.clientX, y: e.clientY });
                          }}
                          onClick={(e) => e.stopPropagation()}
                          title="Drag to reposition background"
                        />
                        <div
                          className="w-full max-w-[240px] flex items-center justify-between gap-3 mt-1"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <span className="text-[10px] text-[#999]">Zoom</span>
                          <input
                            type="range"
                            min="10"
                            max="300"
                            value={bgZoom}
                            onChange={(e) =>
                              setBgZoom(parseInt(e.target.value, 10))
                            }
                            className="flex-1 accent-[#ff7b00]"
                          />
                          <span className="text-[10px] text-[#999] w-8 text-right">
                            {bgZoom}%
                          </span>
                        </div>
                        <div
                          className="w-full max-w-[240px] flex items-center justify-between gap-3 mt-1"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <span className="text-[10px] text-[#999]">Blend</span>
                          <input
                            type="range"
                            min="0"
                            max="100"
                            value={bgBlend}
                            onChange={(e) =>
                              setBgBlend(parseInt(e.target.value, 10))
                            }
                            className="flex-1 accent-[#ff7b00]"
                          />
                          <span className="text-[10px] text-[#999] w-8 text-right">
                            {bgBlend}%
                          </span>
                        </div>
                        <span className="text-xs text-[#d4d4d4] mt-2">
                          Click area outside preview to replace image
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setBackgroundImage(null);
                          }}
                          className="mt-1 text-xs text-[#ff7b00] hover:underline"
                        >
                          Remove Image
                        </button>
                      </div>
                    ) : (
                      <>
                        <Palette size={24} className="text-[#999] mb-2" />
                        <span className="text-sm font-medium text-[#d4d4d4]">
                          Drag and drop an image here
                        </span>
                        <span className="text-xs text-[#999] mt-1">
                          or click to browse
                        </span>
                      </>
                    )}
                  </div>
                </div>

                <div className="pt-2 border-t border-[#111] mt-6 flex justify-end">
                  <button
                    onClick={() => {
                        setAccentColor("#00a8ff");
                        setBackgroundColor("#1e1e1e");
                        setFontSize(16);
                        setFontFamily('-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, Helvetica, Arial, sans-serif');
                        setBackgroundImage(null);
                        setBgPosX(50);
                        setBgPosY(50);
                        setBgZoom(100);
                        setBgBlend(70);
                    }}
                    className="w-full md:w-auto text-xs text-[#999] hover:text-white px-4 py-2 border border-[#444] hover:bg-[#444] transition-colors uppercase tracking-wider rounded-none"
                  >
                    Restore Defaults
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
