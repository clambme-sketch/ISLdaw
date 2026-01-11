
import React from 'react';
import { Activity, Waves, Power, X } from 'lucide-react';

interface VisualizerConfig {
    mode: 'SPECTRUM' | 'WAVEFORM' | 'OFF';
    colorStart: string;
    colorEnd: string;
}

interface VisualizerSettingsProps {
    isOpen: boolean;
    onClose: () => void;
    config: VisualizerConfig;
    onChange: (config: VisualizerConfig) => void;
}

export const VisualizerSettings: React.FC<VisualizerSettingsProps> = ({ isOpen, onClose, config, onChange }) => {
    if (!isOpen) return null;

    const themes = [
        { name: 'Ocean', start: '#3b82f6', end: '#06b6d4' },
        { name: 'Sunset', start: '#f59e0b', end: '#ef4444' },
        { name: 'Matrix', start: '#10b981', end: '#059669' },
        { name: 'Neon', start: '#d946ef', end: '#8b5cf6' },
        { name: 'Monochrome', start: '#94a3b8', end: '#ffffff' },
    ];

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[200]" onClick={onClose}>
            <div className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl p-4 w-72" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider">Visualizer Settings</h3>
                    <button onClick={onClose} className="text-gray-500 hover:text-white"><X size={16} /></button>
                </div>

                <div className="space-y-4">
                    {/* Mode Selection */}
                    <div>
                        <div className="text-xs text-gray-500 mb-2 font-bold">MODE</div>
                        <div className="grid grid-cols-3 gap-2">
                            <button 
                                onClick={() => onChange({ ...config, mode: 'SPECTRUM' })}
                                className={`flex flex-col items-center gap-1 p-2 rounded border ${config.mode === 'SPECTRUM' ? 'bg-blue-600 border-blue-500 text-white' : 'bg-gray-800 border-gray-700 text-gray-400 hover:bg-gray-700'}`}
                            >
                                <Activity size={16} />
                                <span className="text-[9px]">Spectrum</span>
                            </button>
                            <button 
                                onClick={() => onChange({ ...config, mode: 'WAVEFORM' })}
                                className={`flex flex-col items-center gap-1 p-2 rounded border ${config.mode === 'WAVEFORM' ? 'bg-blue-600 border-blue-500 text-white' : 'bg-gray-800 border-gray-700 text-gray-400 hover:bg-gray-700'}`}
                            >
                                <Waves size={16} />
                                <span className="text-[9px]">Wave</span>
                            </button>
                            <button 
                                onClick={() => onChange({ ...config, mode: 'OFF' })}
                                className={`flex flex-col items-center gap-1 p-2 rounded border ${config.mode === 'OFF' ? 'bg-red-900/50 border-red-800 text-red-200' : 'bg-gray-800 border-gray-700 text-gray-400 hover:bg-gray-700'}`}
                            >
                                <Power size={16} />
                                <span className="text-[9px]">Off</span>
                            </button>
                        </div>
                    </div>

                    {/* Color Themes */}
                    {config.mode !== 'OFF' && (
                        <div>
                            <div className="text-xs text-gray-500 mb-2 font-bold">COLOR THEME</div>
                            <div className="grid grid-cols-2 gap-2">
                                {themes.map(theme => (
                                    <button
                                        key={theme.name}
                                        onClick={() => onChange({ ...config, colorStart: theme.start, colorEnd: theme.end })}
                                        className={`p-2 rounded border flex items-center gap-2 ${config.colorStart === theme.start ? 'border-white bg-gray-800' : 'border-gray-800 bg-gray-900 hover:bg-gray-800'}`}
                                    >
                                        <div className="w-4 h-4 rounded-full" style={{ background: `linear-gradient(to right, ${theme.start}, ${theme.end})` }}></div>
                                        <span className="text-xs text-gray-300">{theme.name}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
