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
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between p-6 border-b border-gray-800">
            <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-500/10 rounded-lg">
                    <Sparkles className="text-purple-400" size={24} />
                </div>
                <div>
                    <h2 className="text-xl font-bold text-white">AI Songwriter</h2>
                    <p className="text-sm text-gray-400">Powered by Gemini 2.5 Flash</p>
                </div>
            </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X size={24} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1 custom-scrollbar space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Genre</label>
              <input
                type="text"
                value={genre}
                onChange={(e) => setGenre(e.target.value)}
                placeholder="e.g. Synthwave, Trap, Lo-fi"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Mood</label>
              <input
                type="text"
                value={mood}
                onChange={(e) => setMood(e.target.value)}
                placeholder="e.g. Melancholic, Hype, Dreamy"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Existing Lyrics/Ideas (Optional)</label>
            <textarea
                value={existingLyrics}
                onChange={(e) => setExistingLyrics(e.target.value)}
                placeholder="Paste what you have so far..."
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white h-24 focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all resize-none"
            />
          </div>

          <button
            onClick={handleGenerate}
            disabled={loading || (!genre && !mood)}
            className="w-full py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-white font-semibold flex items-center justify-center gap-2 transition-all"
          >
            {loading ? <Loader2 className="animate-spin" size={20} /> : <Music2 size={20} />}
            Generate Concepts
          </button>

          {result && (
            <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700/50 mt-4 animate-fade-in">
              <h3 className="text-purple-400 font-medium mb-3 flex items-center gap-2">
                <Sparkles size={16} /> Result
              </h3>
              <div className="prose prose-invert prose-sm max-w-none whitespace-pre-wrap text-gray-300 font-mono leading-relaxed">
                {result}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};