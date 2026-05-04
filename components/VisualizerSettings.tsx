
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
        { name: 'Ableton', start: '#ff7b00', end: '#ffaa00' },
        { name: 'Ocean', start: '#3b82f6', end: '#06b6d4' },
        { name: 'Matrix', start: '#10b981', end: '#059669' },
        { name: 'Neon', start: '#d946ef', end: '#8b5cf6' },
        { name: 'Monochrome', start: '#94a3b8', end: '#ffffff' },
    ];

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[200]" onClick={onClose}>
            <div className="bg-[#2d2d2d] border border-[#111] rounded-none shadow-none p-4 w-72" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-sm font-bold text-[#d4d4d4] uppercase tracking-wider">Visualizer Settings</h3>
                    <button onClick={onClose} className="text-[#999] hover:text-white"><X size={16} /></button>
                </div>

                <div className="space-y-4">
                    {/* Mode Selection */}
                    <div>
                        <div className="text-xs text-[#999] mb-2 font-bold">MODE</div>
                        <div className="grid grid-cols-3 gap-2">
                            <button 
                                onClick={() => onChange({ ...config, mode: 'SPECTRUM' })}
                                className={`flex flex-col items-center gap-1 p-2 rounded-none border ${config.mode === 'SPECTRUM' ? 'bg-[#ff7b00] border-[#ff7b00] text-black' : 'bg-[#1e1e1e] border-[#111] text-[#999] hover:bg-[#444]'}`}
                            >
                                <Activity size={16} />
                                <span className="text-[9px]">Spectrum</span>
                            </button>
                            <button 
                                onClick={() => onChange({ ...config, mode: 'WAVEFORM' })}
                                className={`flex flex-col items-center gap-1 p-2 rounded-none border ${config.mode === 'WAVEFORM' ? 'bg-[#ff7b00] border-[#ff7b00] text-black' : 'bg-[#1e1e1e] border-[#111] text-[#999] hover:bg-[#444]'}`}
                            >
                                <Waves size={16} />
                                <span className="text-[9px]">Wave</span>
                            </button>
                            <button 
                                onClick={() => onChange({ ...config, mode: 'OFF' })}
                                className={`flex flex-col items-center gap-1 p-2 rounded-none border ${config.mode === 'OFF' ? 'bg-[#ef4444] border-[#ef4444] text-white' : 'bg-[#1e1e1e] border-[#111] text-[#999] hover:bg-[#444]'}`}
                            >
                                <Power size={16} />
                                <span className="text-[9px]">Off</span>
                            </button>
                        </div>
                    </div>

                    {/* Color Themes */}
                    {config.mode !== 'OFF' && (
                        <div>
                            <div className="text-xs text-[#999] mb-2 font-bold">COLOR THEME</div>
                            <div className="grid grid-cols-2 gap-2">
                                {themes.map(theme => (
                                    <button
                                        key={theme.name}
                                        onClick={() => onChange({ ...config, colorStart: theme.start, colorEnd: theme.end })}
                                        className={`p-2 rounded-none border flex items-center gap-2 ${config.colorStart === theme.start ? 'border-[#ff7b00] bg-[#444]' : 'border-[#111] bg-[#1e1e1e] hover:bg-[#444]'}`}
                                    >
                                        <div className="w-4 h-4 rounded-none" style={{ background: `linear-gradient(to right, ${theme.start}, ${theme.end})` }}></div>
                                        <span className="text-xs text-[#d4d4d4]">{theme.name}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                    
                    <div className="pt-2 border-t border-[#111] mt-2">
                        <button
                            onClick={() => onChange({ mode: 'OFF', colorStart: '#3b82f6', colorEnd: '#ef4444' })}
                            className="w-full text-xs text-[#999] hover:text-white p-2 border border-[#444] hover:bg-[#444] transition-colors uppercase tracking-wider"
                        >
                            Restore Defaults
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
