
import React, { useState } from 'react';
import { generateSongIdeas } from '../services/geminiService';
import { X, Sparkles, Loader2, Music2 } from 'lucide-react';

interface GeminiAssistantProps {
  isOpen: boolean;
  onClose: () => void;
}

export const GeminiAssistant: React.FC<GeminiAssistantProps> = ({ isOpen, onClose }) => {
  const [genre, setGenre] = useState('');
  const [mood, setMood] = useState('');
  const [existingLyrics, setExistingLyrics] = useState('');
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleGenerate = async () => {
    if (!genre && !mood) return;
    setLoading(true);
    setResult('');
    const ideas = await generateSongIdeas(genre, mood, existingLyrics);
    setResult(ideas);
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
      <div className="bg-[#2d2d2d] border border-[#111] rounded-none shadow-none w-full max-w-2xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between p-6 border-b border-[#111] bg-[#2d2d2d]">
            <div className="flex items-center gap-3">
                <div className="p-2 bg-[#ff7b00]/10 rounded-none">
                    <Sparkles className="text-[#ff7b00]" size={24} />
                </div>
                <div>
                    <h2 className="text-xl font-bold text-[#d4d4d4]">AI Songwriter</h2>
                    <p className="text-sm text-[#999]">Powered by Gemini 2.5 Flash</p>
                </div>
            </div>
          <button onClick={onClose} className="text-[#999] hover:text-[#d4d4d4]">
            <X size={24} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1 custom-scrollbar space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[#d4d4d4] mb-1">Genre</label>
              <input
                type="text"
                value={genre}
                onChange={(e) => setGenre(e.target.value)}
                placeholder="e.g. Synthwave, Trap, Lo-fi"
                className="w-full bg-[#111] border border-[#444] rounded-none px-4 py-2 text-[#d4d4d4] focus:border-[#ff7b00] outline-none transition-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#d4d4d4] mb-1">Mood</label>
              <input
                type="text"
                value={mood}
                onChange={(e) => setMood(e.target.value)}
                placeholder="e.g. Melancholic, Hype, Dreamy"
                className="w-full bg-[#111] border border-[#444] rounded-none px-4 py-2 text-[#d4d4d4] focus:border-[#ff7b00] outline-none transition-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-[#d4d4d4] mb-1">Existing Lyrics/Ideas (Optional)</label>
            <textarea
                value={existingLyrics}
                onChange={(e) => setExistingLyrics(e.target.value)}
                placeholder="Paste what you have so far..."
                className="w-full bg-[#111] border border-[#444] rounded-none px-4 py-2 text-[#d4d4d4] h-24 focus:border-[#ff7b00] outline-none transition-none resize-none"
            />
          </div>

          <button
            onClick={handleGenerate}
            disabled={loading || (!genre && !mood)}
            className="w-full py-3 bg-[#ff7b00] hover:bg-[#ffaa00] disabled:opacity-50 disabled:cursor-not-allowed rounded-none text-black font-semibold flex items-center justify-center gap-2 transition-none"
          >
            {loading ? <Loader2 className="animate-spin" size={20} /> : <Music2 size={20} />}
            Generate Concepts
          </button>

          {result && (
            <div className="bg-[#1e1e1e] rounded-none p-6 border border-[#111] mt-4 transition-none">
              <h3 className="text-[#ff7b00] font-medium mb-3 flex items-center gap-2">
                <Sparkles size={16} /> Result
              </h3>
              <div className="prose prose-invert prose-sm max-w-none whitespace-pre-wrap text-[#d4d4d4] font-mono leading-relaxed">
                {result}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
