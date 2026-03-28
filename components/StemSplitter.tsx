
import React, { useState } from 'react';
import { Upload, X, Loader2, Music, Layers, Sparkles, Server } from 'lucide-react';
import { audioService } from '../services/audioEngine';
import { PluginType, AudioPlugin } from '../types';
import { analyzeAudioStructure } from '../services/geminiService';

interface StemSplitterProps {
  isOpen: boolean;
  onClose: () => void;
  onStemsGenerated: (stems: {name: string, type: PluginType, buffer: AudioBuffer, plugins: AudioPlugin[]}[]) => void;
}

export const StemSplitter: React.FC<StemSplitterProps> = ({ isOpen, onClose, onStemsGenerated }) => {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string>("");

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleProcess = async () => {
    if (!file) return;
    setLoading(true);
    setStatus("Preparing for upload...");
    
    try {
        await audioService.resume();
        
        // 1. Get Snippet
        setStatus("Encoding for Google Cloud...");
        const base64Audio = await audioService.getAudioAnalysisInput(file);
        
        // 2. Identify Instruments
        setStatus("Gemini AI Analyzing Structure...");
        const detectedInstruments = await analyzeAudioStructure(base64Audio);
        
        // 3. Separate based on detection (Pass progress callback)
        const stems = await audioService.separateStemsAdvanced(file, detectedInstruments, (msg) => {
            setStatus(msg);
        });
        
        if (stems.length === 0) {
            alert("Could not separate audio. The file might be silent or corrupt.");
            setLoading(false);
            return;
        }
        
        setStatus("Finalizing...");
        onStemsGenerated(stems);
        setLoading(false);
        setFile(null);
        setStatus("");
        onClose();
        
    } catch (e) {
        console.error(e);
        alert("Failed to separate stems. The file might be too large or the format unsupported.");
        setLoading(false);
        setStatus("");
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
      <div className="bg-[#2d2d2d] border border-[#111] rounded-none shadow-none w-full max-w-md flex flex-col overflow-hidden transition-none">
        
        <div className="p-6 border-b border-[#111] bg-[#2d2d2d] flex justify-between items-center">
            <h2 className="text-xl font-bold text-[#d4d4d4] flex items-center gap-2">
                <Layers className="text-[#ff7b00]" /> AI Stem Splitter
            </h2>
            <button onClick={onClose} className="text-[#999] hover:text-[#d4d4d4]"><X size={20} /></button>
        </div>

        <div className="p-6 space-y-6">
            <div className="border-2 border-dashed border-[#444] rounded-none p-8 flex flex-col items-center justify-center text-center hover:border-[#ff7b00] transition-none bg-[#1e1e1e]">
                <input 
                    type="file" 
                    id="stem-upload" 
                    className="hidden" 
                    accept="audio/*,.aif,.aiff,.wav,.mp3,.flac,.ogg,.m4a"
                    onChange={handleFileChange}
                />
                
                {file ? (
                    <div className="flex flex-col items-center gap-2">
                        <div className="p-3 bg-[#ff7b00]/20 rounded-none text-[#ff7b00]">
                            <Music size={24} />
                        </div>
                        <span className="font-medium text-[#d4d4d4]">{file.name}</span>
                        <span className="text-xs text-[#999]">{(file.size / 1024 / 1024).toFixed(2)} MB</span>
                        <button onClick={() => setFile(null)} className="text-xs text-[#ef4444] hover:underline mt-2">Remove</button>
                    </div>
                ) : (
                    <label htmlFor="stem-upload" className="cursor-pointer flex flex-col items-center gap-2">
                        <Upload size={32} className="text-[#999]" />
                        <span className="text-sm text-[#d4d4d4] font-medium">Click to upload song</span>
                        <span className="text-xs text-[#999]">Supports MP3, WAV, FLAC</span>
                    </label>
                )}
            </div>

            <div className="bg-[#1e1e1e] p-4 rounded-none space-y-2 border border-[#111]">
                 <div className="flex gap-2 items-start">
                    <Server size={16} className="text-[#8b5cf6] shrink-0 mt-0.5" />
                    <div className="text-xs text-[#d4d4d4]">
                        <strong>Deep Analysis:</strong> Audio is sent to Google's Gemini AI to identify instruments, timestamps, and frequency maps.
                    </div>
                 </div>
                 <div className="flex gap-2 items-start">
                    <Sparkles size={16} className="text-[#f59e0b] shrink-0 mt-0.5" />
                    <div className="text-xs text-[#d4d4d4]">
                        <strong>Hi-Fi Engine:</strong> Uses Linkwitz-Riley crossovers and transient shapers for professional-grade isolation. Processing may take 1-2 minutes.
                    </div>
                 </div>
            </div>

            <button 
                onClick={handleProcess}
                disabled={!file || loading}
                className="w-full py-3 bg-[#ff7b00] hover:bg-[#ffaa00] disabled:opacity-50 disabled:cursor-not-allowed rounded-none text-black font-semibold flex items-center justify-center gap-2 transition-none"
            >
                {loading ? (
                    <>
                        <Loader2 className="animate-spin" size={18} />
                        {status || "Processing..."}
                    </>
                ) : (
                    "Upload & Separate"
                )}
            </button>
        </div>

      </div>
    </div>
  );
};
