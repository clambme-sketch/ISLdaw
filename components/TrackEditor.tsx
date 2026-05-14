
import React, { useState } from 'react';
import { Track, AudioPlugin, PluginType } from '../types';
import { X, Plus, Power, Trash2, Sliders, Waves, Box, Disc, Activity, Zap, Volume2, ArrowDownToLine, ArrowUpFromLine, Scissors, Layers } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { useTrackColor } from './useTrackColor';
import EQUI from './EQUI';

const PLUGIN_STYLES: Record<PluginType, { color: string, icon: any }> = {
    DELAY: { color: '#0ea5e9', icon: Waves }, // sky-500
    REVERB: { color: '#d946ef', icon: Box }, // fuchsia-500
    DISTORTION: { color: '#ef4444', icon: Zap }, // red-500
    FILTER: { color: '#22c55e', icon: ArrowUpFromLine }, // green-500
    LIMITER: { color: '#eab308', icon: Volume2 }, // yellow-500
    COMPRESSOR: { color: '#f59e0b', icon: Activity }, // amber-500
    SIDECHAIN: { color: '#6366f1', icon: Layers }, // indigo-500
    EQ: { color: '#10b981', icon: Sliders }, // emerald-500
    BITCRUSHER: { color: '#ec4899', icon: Scissors }, // pink-500
    TAPE_SATURATION: { color: '#f43f5e', icon: Disc }, // rose-500
};

interface TrackEditorProps {
  track: Track;
  tracks: Track[];
  onUpdate: (trackId: string, updates: Partial<Track>) => void;
  onClose: () => void;
}

export const TrackEditor: React.FC<TrackEditorProps> = ({ track, tracks, onUpdate, onClose }) => {
  const getTrackColor = useTrackColor();
  const [isAdding, setIsAdding] = useState(false);

  const addPlugin = (type: PluginType) => {
    const newPlugin: AudioPlugin = {
        id: uuidv4(),
        type,
        enabled: true,
        params: {}
    };
    
    // Set default params
    if (type === 'DISTORTION') { 
        newPlugin.params.drive = 30; 
        newPlugin.params.tone = 5000; 
        newPlugin.params.mix = 1.0; 
        newPlugin.params.distType = 'soft';
        newPlugin.params.tight = 150;
    }
    if (type === 'DELAY') { 
        newPlugin.params.time = 0.3; 
        newPlugin.params.feedback = 0.4; 
        newPlugin.params.mix = 0.4;
        newPlugin.params.lowpassFreq = 10000;
        newPlugin.params.highpassFreq = 200;
        newPlugin.params.syncToTempo = false;
        newPlugin.params.tempoMultiplier = 1; // 1 = 1/4 note
    }
    if (type === 'FILTER') { 
        newPlugin.params.frequency = 2000; 
        newPlugin.params.Q = 1; 
        newPlugin.params.filterType = 'lowpass'; 
        newPlugin.params.drive = 0;
        newPlugin.params.mix = 1.0;
    }
    if (type === 'REVERB') {
        newPlugin.params.decay = 2.0;
        newPlugin.params.mix = 0.3;
        newPlugin.params.reverbType = 2; // Plate
        newPlugin.params.preDelay = 10;
        newPlugin.params.highpassFreq = 200;
        newPlugin.params.lowpassFreq = 5000;
    }
    if (type === 'LIMITER') {
        newPlugin.params.drive = 0;
        newPlugin.params.ceiling = -0.1;
        newPlugin.params.release = 100;
        newPlugin.params.mode = 'transparent';
    }
    if (type === 'COMPRESSOR') {
        newPlugin.params.threshold = -20;
        newPlugin.params.ratio = 4;
        newPlugin.params.attack = 10;
        newPlugin.params.release = 100;
        newPlugin.params.knee = 10;
        newPlugin.params.makeup = 0;
        newPlugin.params.mix = 1.0;
    }
    if (type === 'SIDECHAIN') {
        newPlugin.params.threshold = -20;
        newPlugin.params.depth = 80;
        newPlugin.params.attack = 10;
        newPlugin.params.release = 100;
        newPlugin.params.sourceTrackId = '';
    }
    if (type === 'EQ') {
        newPlugin.params.ui_selectedBand = 0; // For UI state
        for (let i = 0; i < 8; i++) {
            newPlugin.params[`band${i}_freq`] = Math.round(100 * Math.pow(2, i));
            newPlugin.params[`band${i}_gain`] = 0;
            newPlugin.params[`band${i}_q`] = i === 0 || i === 7 ? 0.71 : 1;
            newPlugin.params[`band${i}_type`] = i === 0 ? 'highpass' : (i === 7 ? 'lowpass' : 'peaking');
            newPlugin.params[`band${i}_active`] = i < 4; // Only first 4 active initially
        }
    }
    if (type === 'BITCRUSHER') {
        newPlugin.params.bits = 8;
        newPlugin.params.drive = 0;
        newPlugin.params.preCut = 20;
        newPlugin.params.postCut = 20000;
        newPlugin.params.mix = 1.0;
    }
    if (type === 'TAPE_SATURATION') {
        newPlugin.params.drive = 5;
        newPlugin.params.bias = 0;
        newPlugin.params.ips = 15;
        newPlugin.params.makeup = 0;
        newPlugin.params.mix = 1.0;
    }

    onUpdate(track.id, { plugins: [...track.plugins, newPlugin] });
    setIsAdding(false);
  };

  const updatePluginParam = (pluginId: string, param: string, value: any) => {
    const newPlugins = track.plugins.map(p => {
        if (p.id === pluginId) {
            return { ...p, params: { ...p.params, [param]: value } };
        }
        return p;
    });
    onUpdate(track.id, { plugins: newPlugins });
  };

  const updatePluginParams = (pluginId: string, updates: Record<string, any>) => {
    const newPlugins = track.plugins.map(p => {
        if (p.id === pluginId) {
            return { ...p, params: { ...p.params, ...updates } };
        }
        return p;
    });
    onUpdate(track.id, { plugins: newPlugins });
  };

  const togglePlugin = (pluginId: string) => {
    const newPlugins = track.plugins.map(p => 
        p.id === pluginId ? { ...p, enabled: !p.enabled } : p
    );
    onUpdate(track.id, { plugins: newPlugins });
  };

  const removePlugin = (pluginId: string) => {
     onUpdate(track.id, { plugins: track.plugins.filter(p => p.id !== pluginId) });
  };

  return (
    <div className="h-96 bg-[#2d2d2d] border-t border-[#111] flex flex-col shadow-none z-40 transition-none">
      <div className="flex items-center justify-between px-4 py-2 border-b border-[#111] bg-[#2d2d2d]">
        <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-[#d4d4d4] uppercase tracking-wider">Track Editor:</span>
            <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-none" style={{ backgroundColor: track.color ? getTrackColor(track.color) : '#fff' }}></div>
                <span className="text-sm text-white font-medium">{track.name}</span>
            </div>
        </div>
        <button onClick={onClose} className="text-[#999] hover:text-[#d4d4d4] transition-none" title="Close Editor">
          <X size={16} />
        </button>
      </div>

      <div className="flex-1 flex overflow-x-auto overflow-y-hidden bg-[#1e1e1e] p-4 gap-4 custom-scrollbar items-stretch">
             {track.plugins.map((plugin, index) => {
                 const style = PLUGIN_STYLES[plugin.type] || { color: '#888', icon: Sliders };
                 const PluginIcon = style.icon;
                 return (
                 <div key={plugin.id} className={`${plugin.type === 'EQ' ? 'w-[450px]' : 'w-64'} flex-shrink-0 rounded-none border flex flex-col ${plugin.enabled ? 'bg-[#2d2d2d] border-[#111]' : 'bg-[#1e1e1e] border-[#111] opacity-60'}`}>
                     <div className="flex items-center justify-between p-2 border-b border-[#111] bg-[#222]" style={{ borderTop: `2px solid ${style.color}` }}>
                         <div className="flex items-center gap-2">
                             <PluginIcon size={14} style={{ color: style.color }} />
                             <span className="font-semibold text-xs text-[#d4d4d4]">{index + 1}. {plugin.type}</span>
                         </div>
                         <div className="flex items-center gap-1">
                             <button onClick={() => togglePlugin(plugin.id)} className="p-1 hover:text-white text-[#999]" title={plugin.enabled ? "Disable Effect" : "Enable Effect"}>
                                <Power size={12} className={plugin.enabled ? "text-[#10b981]" : ""} />
                             </button>
                             <button onClick={() => removePlugin(plugin.id)} className="p-1 hover:text-[#ef4444] text-[#999]" title="Remove Effect">
                                <Trash2 size={12} />
                             </button>
                         </div>
                     </div>
                     
                     {/* Dynamic Controls Render */}
                     <div className="p-3 flex-1 overflow-y-auto custom-scrollbar flex flex-col gap-3">
                     {plugin.enabled && (
                         <div className="grid grid-cols-1 gap-3">
                             {/* Special UI for Reverb */}
                             {plugin.type === 'EQ' ? (
                                  <EQUI 
                                      plugin={plugin} 
                                      updatePluginParam={updatePluginParam} 
                                      updatePluginParams={updatePluginParams} 
                                  />
                              ) : plugin.type === 'DELAY' ? (
                                  <div className="flex flex-col gap-2">
                                      {/* Presets */}
                                      <div className="flex gap-1 bg-[#111] p-1 rounded-none overflow-x-auto no-scrollbar">
                                          <button 
                                              onClick={() => {
                                               updatePluginParams(plugin.id, {
                                                   'syncToTempo': false,
                                                   'time': 0.12,
                                                   'feedback': 0.2,
                                                   'mix': 0.4,
                                                   'highpassFreq': 300,
                                                   'lowpassFreq': 8000,
                                               });
                                             }}
                                              className="flex-shrink-0 px-2 py-1 rounded-none text-[9px] font-bold uppercase tracking-wider bg-[#333] hover:bg-[#444] text-[#d4d4d4]"
                                          >Slapback</button>
                                          <button 
                                              onClick={() => {
                                               updatePluginParams(plugin.id, {
                                                   'syncToTempo': true,
                                                   'tempoMultiplier': 0.5,
                                                   'feedback': 0.5,
                                                   'mix': 0.5,
                                                   'highpassFreq': 200,
                                                   'lowpassFreq': 10000,
                                               });
                                             }}
                                              className="flex-shrink-0 px-2 py-1 rounded-none text-[9px] font-bold uppercase tracking-wider bg-[#333] hover:bg-[#444] text-[#d4d4d4]"
                                          >1/8 Sync</button>
                                          <button 
                                              onClick={() => {
                                                                                                                                                                                                                                                                                                            // Analog dark decays
                                               updatePluginParams(plugin.id, {
                                                   'syncToTempo': false,
                                                   'time': 0.6,
                                                   'feedback': 0.7,
                                                   'mix': 0.5,
                                                   'highpassFreq': 500,
                                                   'lowpassFreq': 3000,
                                               });
                                             }}
                                              className="flex-shrink-0 px-2 py-1 rounded-none text-[9px] font-bold uppercase tracking-wider bg-[#333] hover:bg-[#444] text-[#d4d4d4]"
                                          >Tape Echo</button>
                                      </div>
                                      
                                      {/* Time & Sync */}
                                      <div className="flex flex-col gap-1 mt-1">
                                          <div className="flex justify-between items-center text-[10px] text-[#999] uppercase">
                                              <span>Time</span>
                                              <label className="flex items-center gap-1 cursor-pointer">
                                                  <input 
                                                      type="checkbox" 
                                                      checked={plugin.params.syncToTempo} 
                                                      onChange={(e) => updatePluginParam(plugin.id, 'syncToTempo', e.target.checked)} 
                                                      className="accent-[#ff7b00]"
                                                  />
                                                  <span>Sync</span>
                                              </label>
                                          </div>
                                          {plugin.params.syncToTempo ? (
                                              <select 
                                                  className="bg-[#111] text-[#d4d4d4] text-xs p-1 outline-none w-full appearance-none border border-[#333]"
                                                  value={plugin.params.tempoMultiplier}
                                                  onChange={(e) => updatePluginParam(plugin.id, 'tempoMultiplier', Number(e.target.value))}
                                              >
                                                  <option value={4}>1/1 (Whole)</option>
                                                  <option value={2}>1/2 (Half)</option>
                                                  <option value={1}>1/4 (Beat)</option>
                                                  <option value={0.75}>1/4 Dotted</option>
                                                  <option value={0.5}>1/8 Note</option>
                                                  <option value={0.375}>1/8 Dotted</option>
                                                  <option value={0.3333}>1/8 Triplet</option>
                                                  <option value={0.25}>1/16 Note</option>
                                              </select>
                                          ) : (
                                            <div className="flex flex-col gap-1">
                                                <div className="flex justify-between text-[10px] text-[#999]">
                                                    <span />
                                                    <span>{Number(plugin.params.time).toFixed(3)} s</span>
                                                </div>
                                                <input 
                                                    type="range" min="0.01" max="2" step="0.01"
                                                    value={Number(plugin.params.time)}
                                                    onChange={(e) => updatePluginParam(plugin.id, 'time', Number(e.target.value))}
                                                    className="h-1.5 bg-[#111] rounded-none appearance-none accent-[#ff7b00]"
                                                />
                                            </div>
                                          )}
                                      </div>

                                      {/* Feedback & Mix Grid */}
                                      <div className="grid grid-cols-2 gap-3 mt-2">
                                        <div className="flex flex-col gap-1">
                                            <div className="flex justify-between text-[10px] text-[#999] uppercase">
                                                <span>Feedback</span>
                                                <span>{Math.round(Number(plugin.params.feedback) * 100)}%</span>
                                            </div>
                                            <input 
                                                type="range" min="0" max="1.2" step="0.01"
                                                value={Number(plugin.params.feedback)}
                                                onChange={(e) => updatePluginParam(plugin.id, 'feedback', Number(e.target.value))}
                                                className="h-1.5 bg-[#111] rounded-none appearance-none accent-[#ff7b00]"
                                            />
                                        </div>
                                        <div className="flex flex-col gap-1">
                                            <div className="flex justify-between text-[10px] text-[#999] uppercase">
                                                <span>Mix</span>
                                                <span>{Math.round(Number(plugin.params.mix) * 100)}%</span>
                                            </div>
                                            <input 
                                                type="range" min="0" max="1" step="0.01"
                                                value={Number(plugin.params.mix)}
                                                onChange={(e) => updatePluginParam(plugin.id, 'mix', Number(e.target.value))}
                                                className="h-1.5 bg-[#111] rounded-none appearance-none accent-[#ff7b00]"
                                            />
                                        </div>
                                      </div>

                                      {/* Color / Filters */}
                                      <div className="flex flex-col gap-1 mt-2 p-2 bg-[#111] border border-[#222]">
                                        <div className="text-[10px] text-[#999] uppercase mb-1">Feedback Color</div>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="flex flex-col gap-1">
                                                <div className="flex justify-between text-[9px] text-[#777]">
                                                    <span>HPF</span>
                                                    <span>{Number(plugin.params.highpassFreq).toFixed(0)}Hz</span>
                                                </div>
                                                <input 
                                                    type="range" min="20" max="5000" step="10"
                                                    value={Number(plugin.params.highpassFreq)}
                                                    onChange={(e) => updatePluginParam(plugin.id, 'highpassFreq', Number(e.target.value))}
                                                    className="h-1.5 bg-[#222] rounded-none appearance-none accent-[#ff7b00]"
                                                />
                                            </div>
                                            <div className="flex flex-col gap-1">
                                                <div className="flex justify-between text-[9px] text-[#777]">
                                                    <span>LPF</span>
                                                    <span>{Number(plugin.params.lowpassFreq).toFixed(0)}Hz</span>
                                                </div>
                                                <input 
                                                    type="range" min="500" max="20000" step="100"
                                                    value={Number(plugin.params.lowpassFreq)}
                                                    onChange={(e) => updatePluginParam(plugin.id, 'lowpassFreq', Number(e.target.value))}
                                                    className="h-1.5 bg-[#222] rounded-none appearance-none accent-[#ff7b00]"
                                                />
                                            </div>
                                        </div>
                                      </div>
                                  </div>
                             ) : plugin.type === 'FILTER' ? (
                                  <div className="flex flex-col gap-2">
                                      {/* Presets */}
                                      <div className="flex gap-1 bg-[#111] p-1 rounded-none overflow-x-auto no-scrollbar">
                                          <button 
                                              onClick={() => {
                                               updatePluginParams(plugin.id, {
                                                   'filterType': 'lowpass',
                                                   'frequency': 400,
                                                   'Q': 0.5,
                                                   'drive': 30,
                                                   'mix': 1.0,
                                               });
                                             }}
                                              className="flex-shrink-0 px-2 py-1 rounded-none text-[9px] font-bold uppercase tracking-wider bg-[#333] hover:bg-[#444] text-[#d4d4d4]"
                                          >Warm Lowpass</button>
                                          <button 
                                              onClick={() => {
                                               updatePluginParams(plugin.id, {
                                                   'filterType': 'highpass',
                                                   'frequency': 300,
                                                   'Q': 2.0,
                                                   'drive': 0,
                                                   'mix': 1.0,
                                               });
                                             }}
                                              className="flex-shrink-0 px-2 py-1 rounded-none text-[9px] font-bold uppercase tracking-wider bg-[#333] hover:bg-[#444] text-[#d4d4d4]"
                                          >Tight Mid Cut</button>
                                          <button 
                                              onClick={() => {
                                               updatePluginParams(plugin.id, {
                                                   'filterType': 'bandpass',
                                                   'frequency': 1500,
                                                   'Q': 5.0,
                                                   'drive': 60,
                                                   'mix': 1.0,
                                               });
                                             }}
                                              className="flex-shrink-0 px-2 py-1 rounded-none text-[9px] font-bold uppercase tracking-wider bg-[#333] hover:bg-[#444] text-[#d4d4d4]"
                                          >Telephone</button>
                                          <button 
                                              onClick={() => {
                                               updatePluginParams(plugin.id, {
                                                   'filterType': 'lowpass',
                                                   'frequency': 8000,
                                                   'Q': 1.5,
                                                   'drive': 80,
                                                   'mix': 1.0,
                                               });
                                             }}
                                              className="flex-shrink-0 px-2 py-1 rounded-none text-[9px] font-bold uppercase tracking-wider bg-[#333] hover:bg-[#444] text-[#d4d4d4]"
                                          >Saturated LP</button>
                                      </div>

                                      <div className="flex gap-1 justify-between bg-[#111] p-1 rounded-none mt-1">
                                          {[
                                              {id: 'lowpass', label: 'LP'},
                                              {id: 'highpass', label: 'HP'},
                                              {id: 'bandpass', label: 'BP'},
                                              {id: 'notch', label: 'Notch'}
                                          ].map(t => (
                                              <button 
                                                  key={t.id}
                                                  onClick={() => updatePluginParam(plugin.id, 'filterType', t.id)}
                                                  className={`flex-1 p-1 rounded-none text-[10px] font-bold uppercase tracking-wider transition-none ${plugin.params.filterType === t.id ? 'bg-[#ff7b00] text-black' : 'hover:bg-[#444] text-[#999]'}`}
                                              >
                                                  {t.label}
                                              </button>
                                          ))}
                                      </div>
                                      
                                      <div className="grid grid-cols-2 gap-3 mt-1">
                                          <div className="flex flex-col gap-1">
                                              <div className="flex justify-between text-[10px] text-[#999] uppercase">
                                                  <span>Freq</span>
                                                  <span>{Number(plugin.params.frequency || 2000).toFixed(0)} Hz</span>
                                              </div>
                                              <input 
                                                 type="range" min="20" max="20000" step="1"
                                                 value={Number(plugin.params.frequency || 2000)}
                                                 onChange={(e) => updatePluginParam(plugin.id, 'frequency', Number(e.target.value))}
                                                 className="h-1.5 bg-[#111] rounded-none appearance-none accent-[#ff7b00]"
                                              />
                                          </div>
                                          <div className="flex flex-col gap-1">
                                              <div className="flex justify-between text-[10px] text-[#999] uppercase">
                                                  <span>Resonance</span>
                                                  <span>{Number(plugin.params.Q || 1).toFixed(2)}</span>
                                              </div>
                                              <input 
                                                 type="range" min="0.1" max="20" step="0.1"
                                                 value={Number(plugin.params.Q || 1)}
                                                 onChange={(e) => updatePluginParam(plugin.id, 'Q', Number(e.target.value))}
                                                 className="h-1.5 bg-[#111] rounded-none appearance-none accent-[#ff7b00]"
                                              />
                                          </div>
                                      </div>
                                      
                                      <div className="grid grid-cols-2 gap-3 mt-1 p-2 bg-[#111] border border-[#222]">
                                          <div className="flex flex-col gap-1">
                                              <div className="flex justify-between text-[9px] text-[#777] uppercase">
                                                  <span>Drive (Pre)</span>
                                                  <span>{Number(plugin.params.drive || 0).toFixed(0)}%</span>
                                              </div>
                                              <input 
                                                 type="range" min="0" max="100" step="1"
                                                 value={Number(plugin.params.drive || 0)}
                                                 onChange={(e) => updatePluginParam(plugin.id, 'drive', Number(e.target.value))}
                                                 className="h-1.5 bg-[#222] rounded-none appearance-none accent-[#ff7b00]"
                                              />
                                          </div>
                                          <div className="flex flex-col gap-1">
                                              <div className="flex justify-between text-[9px] text-[#777] uppercase">
                                                  <span>Mix</span>
                                                  <span>{Math.round(Number(plugin.params.mix ?? 1.0) * 100)}%</span>
                                              </div>
                                              <input 
                                                 type="range" min="0" max="1" step="0.01"
                                                 value={Number(plugin.params.mix ?? 1.0)}
                                                 onChange={(e) => updatePluginParam(plugin.id, 'mix', Number(e.target.value))}
                                                 className="h-1.5 bg-[#222] rounded-none appearance-none accent-[#ff7b00]"
                                              />
                                          </div>
                                      </div>
                                  </div>
                             ) : plugin.type === 'DISTORTION' ? (
                                  <div className="flex flex-col gap-2">
                                      {/* Presets */}
                                      <div className="flex gap-1 bg-[#111] p-1 rounded-none overflow-x-auto no-scrollbar">
                                          <button 
                                              onClick={() => {
                                               updatePluginParams(plugin.id, {
                                                   'distType': 'soft',
                                                   'drive': 15,
                                                   'tone': 8000,
                                                   'tight': 80,
                                                   'mix': 1.0,
                                               });
                                             }}
                                              className="flex-shrink-0 px-2 py-1 rounded-none text-[9px] font-bold uppercase tracking-wider bg-[#333] hover:bg-[#444] text-[#d4d4d4]"
                                          >Warm Tube</button>
                                          <button 
                                              onClick={() => {
                                               updatePluginParams(plugin.id, {
                                                   'distType': 'hard',
                                                   'drive': 60,
                                                   'tone': 3000,
                                                   'tight': 250,
                                                   'mix': 1.0,
                                               });
                                             }}
                                              className="flex-shrink-0 px-2 py-1 rounded-none text-[9px] font-bold uppercase tracking-wider bg-[#333] hover:bg-[#444] text-[#d4d4d4]"
                                          >Aggressive</button>
                                          <button 
                                              onClick={() => {
                                               updatePluginParams(plugin.id, {
                                                   'distType': 'fuzz',
                                                   'drive': 80,
                                                   'tone': 2000,
                                                   'tight': 400,
                                                   'mix': 1.0,
                                               });
                                             }}
                                              className="flex-shrink-0 px-2 py-1 rounded-none text-[9px] font-bold uppercase tracking-wider bg-[#333] hover:bg-[#444] text-[#d4d4d4]"
                                          >Fuzz Pedal</button>
                                          <button 
                                              onClick={() => {
                                               updatePluginParams(plugin.id, {
                                                   'distType': 'soft',
                                                   'drive': 40,
                                                   'tone': 4000,
                                                   'tight': 150,
                                                   'mix': 0.4,
                                               });
                                             }}
                                              className="flex-shrink-0 px-2 py-1 rounded-none text-[9px] font-bold uppercase tracking-wider bg-[#333] hover:bg-[#444] text-[#d4d4d4]"
                                          >Parallel Crush</button>
                                      </div>

                                      {/* Character Algorithms */}
                                      <div className="flex gap-1 justify-between bg-[#111] p-1 rounded-none mt-1">
                                          {[
                                              {id: 'soft', label: 'Overdrive'},
                                              {id: 'hard', label: 'Distortion'},
                                              {id: 'fuzz', label: 'Fuzz'}
                                          ].map(t => (
                                              <button 
                                                  key={t.id}
                                                  onClick={() => updatePluginParam(plugin.id, 'distType', t.id)}
                                                  className={`flex-1 p-1 rounded-none text-[10px] font-bold uppercase tracking-wider ${plugin.params.distType === t.id ? 'bg-[#ff7b00] text-black' : 'hover:bg-[#444] text-[#999]'}`}
                                              >
                                                  {t.label}
                                              </button>
                                          ))}
                                      </div>
                                      
                                      {/* Drive & Tone */}
                                      <div className="grid grid-cols-2 gap-3 mt-1">
                                          <div className="flex flex-col gap-1">
                                              <div className="flex justify-between text-[10px] text-[#999] uppercase">
                                                  <span>Drive</span>
                                                  <span>{Number(plugin.params.drive).toFixed(0)}%</span>
                                              </div>
                                              <input 
                                                 type="range" min="0" max="100" step="1"
                                                 value={Number(plugin.params.drive)}
                                                 onChange={(e) => updatePluginParam(plugin.id, 'drive', Number(e.target.value))}
                                                 className="h-1.5 bg-[#111] rounded-none appearance-none accent-[#ff7b00]"
                                              />
                                          </div>
                                          <div className="flex flex-col gap-1">
                                              <div className="flex justify-between text-[10px] text-[#999] uppercase">
                                                  <span>Tone</span>
                                                  <span>{Number(plugin.params.tone || 5000).toFixed(0)} Hz</span>
                                              </div>
                                              <input 
                                                 type="range" min="500" max="15000" step="100"
                                                 value={Number(plugin.params.tone || 5000)}
                                                 onChange={(e) => updatePluginParam(plugin.id, 'tone', Number(e.target.value))}
                                                 className="h-1.5 bg-[#111] rounded-none appearance-none accent-[#ff7b00]"
                                              />
                                          </div>
                                      </div>

                                      {/* Advanced Grid */}
                                      <div className="flex flex-col gap-1 mt-2 p-2 bg-[#111] border border-[#222]">
                                        <div className="text-[10px] text-[#999] uppercase mb-1">Advanced Controls</div>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="flex flex-col gap-1">
                                                <div className="flex justify-between text-[9px] text-[#777]">
                                                    <span>Pre-Drive HPF</span>
                                                    <span>{Number(plugin.params.tight || 150).toFixed(0)}Hz</span>
                                                </div>
                                                <input 
                                                    type="range" min="20" max="1000" step="10"
                                                    value={Number(plugin.params.tight || 150)}
                                                    onChange={(e) => updatePluginParam(plugin.id, 'tight', Number(e.target.value))}
                                                    className="h-1.5 bg-[#222] rounded-none appearance-none accent-[#ff7b00]"
                                                    title="Tightens low end before distortion to prevent mud"
                                                />
                                            </div>
                                            <div className="flex flex-col gap-1">
                                                <div className="flex justify-between text-[9px] text-[#777]">
                                                    <span>Mix</span>
                                                    <span>{Math.round(Number(plugin.params.mix) * 100)}%</span>
                                                </div>
                                                <input 
                                                    type="range" min="0" max="1" step="0.01"
                                                    value={Number(plugin.params.mix)}
                                                    onChange={(e) => updatePluginParam(plugin.id, 'mix', Number(e.target.value))}
                                                    className="h-1.5 bg-[#222] rounded-none appearance-none accent-[#ff7b00]"
                                                />
                                            </div>
                                        </div>
                                      </div>
                                  </div>
                             ) : plugin.type === 'REVERB' ? (
                                  <div className="flex flex-col gap-2">
                                      {/* Presets */}
                                      <div className="flex gap-1 bg-[#111] p-1 rounded-none overflow-x-auto no-scrollbar">
                                          <button 
                                              onClick={() => {
                                                  // Room
                                               updatePluginParams(plugin.id, {
                                                   'reverbType': 1,
                                                   'decay': 0.5,
                                                   'preDelay': 0,
                                                   'mix': 0.2,
                                                   'highpassFreq': 100,
                                                   'lowpassFreq': 8000,
                                               });
                                             }}
                                              className="flex-shrink-0 px-2 py-1 rounded-none text-[9px] font-bold uppercase tracking-wider bg-[#333] hover:bg-[#444] text-[#d4d4d4]"
                                          >Studio Room</button>
                                          <button 
                                              onClick={() => {
                                                  // Hall
                                               updatePluginParams(plugin.id, {
                                                   'reverbType': 0,
                                                   'decay': 3.5,
                                                   'preDelay': 40,
                                                   'mix': 0.4,
                                                   'highpassFreq': 300,
                                                   'lowpassFreq': 4000,
                                               });
                                             }}
                                              className="flex-shrink-0 px-2 py-1 rounded-none text-[9px] font-bold uppercase tracking-wider bg-[#333] hover:bg-[#444] text-[#d4d4d4]"
                                          >Large Hall</button>
                                          <button 
                                              onClick={() => {
                                                  // Plate
                                               updatePluginParams(plugin.id, {
                                                   'reverbType': 2,
                                                   'decay': 1.8,
                                                   'preDelay': 10,
                                                   'mix': 0.35,
                                                   'highpassFreq': 500,
                                                   'lowpassFreq': 6000,
                                               });
                                             }}
                                              className="flex-shrink-0 px-2 py-1 rounded-none text-[9px] font-bold uppercase tracking-wider bg-[#333] hover:bg-[#444] text-[#d4d4d4]"
                                          >Lush Plate</button>
                                      </div>

                                      {/* Reverb Algorithms */}
                                      <div className="flex gap-1 justify-between bg-[#111] p-1 rounded-none mt-1">
                                          {[
                                              {id: 0, label: 'Hall'},
                                              {id: 1, label: 'Room'},
                                              {id: 2, label: 'Plate'},
                                              {id: 3, label: 'Spring'}
                                          ].map(t => (
                                              <button 
                                                  key={t.id}
                                                  onClick={() => updatePluginParam(plugin.id, 'reverbType', t.id)}
                                                  className={`flex-1 p-1 rounded-none text-[10px] font-bold uppercase tracking-wider ${plugin.params.reverbType === t.id ? 'bg-[#ff7b00] text-black' : 'hover:bg-[#444] text-[#999]'}`}
                                              >
                                                  {t.label}
                                              </button>
                                          ))}
                                      </div>
                                      
                                      {/* Decay & Pre-Delay */}
                                      <div className="grid grid-cols-2 gap-3 mt-1">
                                          <div className="flex flex-col gap-1">
                                              <div className="flex justify-between text-[10px] text-[#999] uppercase">
                                                  <span>Decay</span>
                                                  <span>{Number(plugin.params.decay).toFixed(1)}s</span>
                                              </div>
                                              <input 
                                                 type="range" min="0.1" max="10" step="0.1"
                                                 value={Number(plugin.params.decay)}
                                                 onChange={(e) => updatePluginParam(plugin.id, 'decay', Number(e.target.value))}
                                                 className="h-1.5 bg-[#111] rounded-none appearance-none accent-[#ff7b00]"
                                              />
                                          </div>
                                          <div className="flex flex-col gap-1">
                                              <div className="flex justify-between text-[10px] text-[#999] uppercase">
                                                  <span>Pre-Delay</span>
                                                  <span>{Number(plugin.params.preDelay || 0).toFixed(0)} ms</span>
                                              </div>
                                              <input 
                                                 type="range" min="0" max="200" step="1"
                                                 value={Number(plugin.params.preDelay || 0)}
                                                 onChange={(e) => updatePluginParam(plugin.id, 'preDelay', Number(e.target.value))}
                                                 className="h-1.5 bg-[#111] rounded-none appearance-none accent-[#ff7b00]"
                                              />
                                          </div>
                                      </div>

                                      {/* Dampening Filters Grid */}
                                      <div className="flex flex-col gap-1 mt-2 p-2 bg-[#111] border border-[#222]">
                                        <div className="text-[10px] text-[#999] uppercase mb-1">Tail Dampening</div>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="flex flex-col gap-1">
                                                <div className="flex justify-between text-[9px] text-[#777]">
                                                    <span>Low Cut</span>
                                                    <span>{Number(plugin.params.highpassFreq || 20).toFixed(0)}Hz</span>
                                                </div>
                                                <input 
                                                    type="range" min="20" max="2000" step="10"
                                                    value={Number(plugin.params.highpassFreq || 20)}
                                                    onChange={(e) => updatePluginParam(plugin.id, 'highpassFreq', Number(e.target.value))}
                                                    className="h-1.5 bg-[#222] rounded-none appearance-none accent-[#ff7b00]"
                                                />
                                            </div>
                                            <div className="flex flex-col gap-1">
                                                <div className="flex justify-between text-[9px] text-[#777]">
                                                    <span>High Cut</span>
                                                    <span>{Number(plugin.params.lowpassFreq || 20000).toFixed(0)}Hz</span>
                                                </div>
                                                <input 
                                                    type="range" min="1000" max="20000" step="100"
                                                    value={Number(plugin.params.lowpassFreq || 20000)}
                                                    onChange={(e) => updatePluginParam(plugin.id, 'lowpassFreq', Number(e.target.value))}
                                                    className="h-1.5 bg-[#222] rounded-none appearance-none accent-[#ff7b00]"
                                                />
                                            </div>
                                        </div>
                                      </div>

                                      {/* Mix */}
                                      <div className="flex flex-col gap-1 mt-1">
                                          <div className="flex justify-between text-[10px] text-[#999] uppercase">
                                              <span>Mix</span>
                                              <span>{Math.round(Number(plugin.params.mix) * 100)}%</span>
                                          </div>
                                          <input 
                                             type="range" min="0" max="1" step="0.01"
                                             value={Number(plugin.params.mix)}
                                             onChange={(e) => updatePluginParam(plugin.id, 'mix', Number(e.target.value))}
                                             className="h-1.5 bg-[#111] rounded-none appearance-none accent-[#ff7b00]"
                                          />
                                      </div>
                                  </div>
                              ) : plugin.type === 'LIMITER' ? (
                                  <div className="flex flex-col gap-2">
                                      {/* Presets */}
                                      <div className="flex gap-1 bg-[#111] p-1 rounded-none overflow-x-auto no-scrollbar">
                                          <button 
                                              onClick={() => {
                                               updatePluginParams(plugin.id, {
                                                   'mode': 'transparent',
                                                   'drive': 0,
                                                   'ceiling': -0.1,
                                                   'release': 100,
                                               });
                                             }}
                                              className="flex-shrink-0 px-2 py-1 rounded-none text-[9px] font-bold uppercase tracking-wider bg-[#333] hover:bg-[#444] text-[#d4d4d4]"
                                          >Master Safe</button>
                                          <button 
                                              onClick={() => {
                                               updatePluginParams(plugin.id, {
                                                   'mode': 'punchy',
                                                   'drive': 6,
                                                   'ceiling': -0.5,
                                                   'release': 50,
                                               });
                                             }}
                                              className="flex-shrink-0 px-2 py-1 rounded-none text-[9px] font-bold uppercase tracking-wider bg-[#333] hover:bg-[#444] text-[#d4d4d4]"
                                          >Drum Bus</button>
                                          <button 
                                              onClick={() => {
                                               updatePluginParams(plugin.id, {
                                                   'mode': 'aggressive',
                                                   'drive': 12,
                                                   'ceiling': -1.0,
                                                   'release': 10,
                                               });
                                             }}
                                              className="flex-shrink-0 px-2 py-1 rounded-none text-[9px] font-bold uppercase tracking-wider bg-[#333] hover:bg-[#444] text-[#d4d4d4]"
                                          >Smash</button>
                                      </div>

                                      {/* Mode Selection */}
                                      <div className="flex gap-1 justify-between bg-[#111] p-1 rounded-none mt-1">
                                          {[
                                              {id: 'transparent', label: 'Clean'},
                                              {id: 'punchy', label: 'Punchy'},
                                              {id: 'aggressive', label: 'Aggressive'}
                                          ].map(t => (
                                              <button 
                                                  key={t.id}
                                                  onClick={() => updatePluginParam(plugin.id, 'mode', t.id)}
                                                  className={`flex-1 p-1 rounded-none text-[10px] font-bold uppercase tracking-wider ${plugin.params.mode === t.id ? 'bg-[#ff7b00] text-black' : 'hover:bg-[#444] text-[#999]'}`}
                                              >
                                                  {t.label}
                                              </button>
                                          ))}
                                      </div>
                                      
                                      <div className="grid grid-cols-2 gap-3 mt-1">
                                          {/* Input Drive */}
                                          <div className="flex flex-col gap-1">
                                              <div className="flex justify-between text-[10px] text-[#999] uppercase">
                                                  <span>Input Gain</span>
                                                  <span>+{Number(plugin.params.drive || 0).toFixed(1)} dB</span>
                                              </div>
                                              <input 
                                                 type="range" min="0" max="24" step="0.5"
                                                 value={Number(plugin.params.drive || 0)}
                                                 onChange={(e) => updatePluginParam(plugin.id, 'drive', Number(e.target.value))}
                                                 className="h-1.5 bg-[#111] rounded-none appearance-none accent-[#ff7b00]"
                                              />
                                          </div>
                                          {/* Output Ceiling */}
                                          <div className="flex flex-col gap-1">
                                              <div className="flex justify-between text-[10px] text-[#999] uppercase">
                                                  <span>Ceiling</span>
                                                  <span>{Number(plugin.params.ceiling ?? -0.1).toFixed(1)} dB</span>
                                              </div>
                                              <input 
                                                 type="range" min="-24" max="0" step="0.1"
                                                 value={Number(plugin.params.ceiling ?? -0.1)}
                                                 onChange={(e) => updatePluginParam(plugin.id, 'ceiling', Number(e.target.value))}
                                                 className="h-1.5 bg-[#111] rounded-none appearance-none accent-[#ff7b00]"
                                              />
                                          </div>
                                      </div>

                                      {/* Release Time */}
                                      <div className="flex flex-col gap-1 mt-1 p-2 bg-[#111] border border-[#222]">
                                          <div className="flex justify-between text-[10px] text-[#999] uppercase">
                                              <span>Release (Recovery)</span>
                                              <span>{Number(plugin.params.release || 100).toFixed(0)} ms</span>
                                          </div>
                                          <input 
                                             type="range" min="1" max="500" step="1"
                                             value={Number(plugin.params.release || 100)}
                                             onChange={(e) => updatePluginParam(plugin.id, 'release', Number(e.target.value))}
                                             className="h-1.5 bg-[#222] rounded-none appearance-none accent-[#ff7b00]"
                                          />
                                      </div>
                                  </div>
                              ) : plugin.type === 'SIDECHAIN' ? (
                                  <div className="flex flex-col gap-2">
                                      {/* Presets */}
                                      <div className="flex gap-1 bg-[#111] p-1 rounded-none overflow-x-auto no-scrollbar">
                                          <button 
                                              onClick={() => {
                                               updatePluginParams(plugin.id, {
                                                   'threshold': -35,
                                                   'depth': 100,
                                                   'attack': 2,
                                                   'release': 105,
                                               });
                                             }}
                                              className="flex-shrink-0 px-2 py-1 rounded-none text-[9px] font-bold uppercase tracking-wider bg-[#333] hover:bg-[#444] text-[#d4d4d4]"
                                          >EDM Pump</button>
                                          <button 
                                              onClick={() => {
                                               updatePluginParams(plugin.id, {
                                                   'threshold': -12,
                                                   'depth': 40,
                                                   'attack': 20,
                                                   'release': 250,
                                               });
                                             }}
                                              className="flex-shrink-0 px-2 py-1 rounded-none text-[9px] font-bold uppercase tracking-wider bg-[#333] hover:bg-[#444] text-[#d4d4d4]"
                                          >Gentle Glue</button>
                                          <button 
                                              onClick={() => {
                                               updatePluginParams(plugin.id, {
                                                   'threshold': -30,
                                                   'depth': 80,
                                                   'attack': 1,
                                                   'release': 50,
                                               });
                                             }}
                                              className="flex-shrink-0 px-2 py-1 rounded-none text-[9px] font-bold uppercase tracking-wider bg-[#333] hover:bg-[#444] text-[#d4d4d4]"
                                          >Snappy Duck</button>
                                      </div>

                                      {/* Source Selection */}
                                      <div className="flex flex-col gap-1 mt-1 p-2 bg-[#111] border border-[#222]">
                                          <label className="text-[10px] text-[#ff7b00] font-bold uppercase tracking-wider mb-1">Key Input (Source Track)</label>
                                          <select
                                              className="bg-[#222] text-[#d4d4d4] p-1.5 rounded-none text-[10px] outline-none hover:bg-[#333] border border-transparent focus:border-[#ff7b00]"
                                              value={plugin.params.sourceTrackId as string}
                                              onChange={(e) => updatePluginParam(plugin.id, 'sourceTrackId', e.target.value)}
                                          >
                                              <option value="">None (Select Track)</option>
                                              {tracks.filter(t => t.id !== track.id).map(t => (
                                                  <option key={t.id} value={t.id}>{t.name}</option>
                                              ))}
                                          </select>
                                      </div>

                                      <div className="grid grid-cols-2 gap-3 mt-1 px-1">
                                          {/* Depth */}
                                          <div className="flex flex-col gap-1">
                                              <div className="flex justify-between text-[10px] text-[#999] uppercase">
                                                  <span>Ducking Depth</span>
                                                  <span>{Number(plugin.params.depth || 0).toFixed(0)}%</span>
                                              </div>
                                              <input 
                                                 type="range" min="0" max="100" step="1"
                                                 value={Number(plugin.params.depth || 0)}
                                                 onChange={(e) => updatePluginParam(plugin.id, 'depth', Number(e.target.value))}
                                                 className="h-1.5 bg-[#111] rounded-none appearance-none accent-[#ff7b00]"
                                              />
                                          </div>
                                          {/* Threshold */}
                                          <div className="flex flex-col gap-1">
                                              <div className="flex justify-between text-[10px] text-[#999] uppercase">
                                                  <span>Sens (Thresh)</span>
                                                  <span>{Number(plugin.params.threshold ?? -20).toFixed(1)} dB</span>
                                              </div>
                                              <input 
                                                 type="range" min="-60" max="0" step="1"
                                                 value={Number(plugin.params.threshold ?? -20)}
                                                 onChange={(e) => updatePluginParam(plugin.id, 'threshold', Number(e.target.value))}
                                                 className="h-1.5 bg-[#111] rounded-none appearance-none accent-[#ff7b00]"
                                              />
                                          </div>
                                      </div>

                                      {/* Envelope Controls */}
                                      <div className="flex flex-col gap-1 mt-2 p-2 bg-[#111] border border-[#222]">
                                        <div className="text-[10px] text-[#999] uppercase mb-1">Envelope Follower</div>
                                        <div className="grid grid-cols-2 gap-3">
                                            {/* Attack */}
                                            <div className="flex flex-col gap-1">
                                                <div className="flex justify-between text-[9px] text-[#777]">
                                                    <span>Attack</span>
                                                    <span>{Number(plugin.params.attack || 10).toFixed(0)} ms</span>
                                                </div>
                                                <input 
                                                    type="range" min="1" max="100" step="1"
                                                    value={Number(plugin.params.attack || 10)}
                                                    onChange={(e) => updatePluginParam(plugin.id, 'attack', Number(e.target.value))}
                                                    className="h-1.5 bg-[#222] rounded-none appearance-none accent-[#ff7b00]"
                                                />
                                            </div>
                                            {/* Release */}
                                            <div className="flex flex-col gap-1">
                                                <div className="flex justify-between text-[9px] text-[#777]">
                                                    <span>Release</span>
                                                    <span>{Number(plugin.params.release || 100).toFixed(0)} ms</span>
                                                </div>
                                                <input 
                                                    type="range" min="10" max="500" step="5"
                                                    value={Number(plugin.params.release || 100)}
                                                    onChange={(e) => updatePluginParam(plugin.id, 'release', Number(e.target.value))}
                                                    className="h-1.5 bg-[#222] rounded-none appearance-none accent-[#ff7b00]"
                                                />
                                            </div>
                                        </div>
                                      </div>
                                  </div>
                              ) : plugin.type === 'COMPRESSOR' ? (
                                  <div className="flex flex-col gap-2">
                                      {/* Presets */}
                                      <div className="flex gap-1 bg-[#111] p-1 rounded-none overflow-x-auto no-scrollbar">
                                          <button 
                                              onClick={() => {
                                               updatePluginParams(plugin.id, {
                                                   'threshold': -12,
                                                   'ratio': 2,
                                                   'attack': 30,
                                                   'release': 200,
                                                   'knee': 15,
                                                   'makeup': 2,
                                                   'mix': 1.0,
                                               });
                                             }}
                                              className="flex-shrink-0 px-2 py-1 rounded-none text-[9px] font-bold uppercase tracking-wider bg-[#333] hover:bg-[#444] text-[#d4d4d4]"
                                          >Smooth Vocal</button>
                                          <button 
                                              onClick={() => {
                                               updatePluginParams(plugin.id, {
                                                   'threshold': -24,
                                                   'ratio': 8,
                                                   'attack': 5,
                                                   'release': 50,
                                                   'knee': 5,
                                                   'makeup': 6,
                                                   'mix': 1.0,
                                               });
                                             }}
                                              className="flex-shrink-0 px-2 py-1 rounded-none text-[9px] font-bold uppercase tracking-wider bg-[#333] hover:bg-[#444] text-[#d4d4d4]"
                                          >Drum Smash</button>
                                          <button 
                                              onClick={() => {
                                                                                                                                                                                                                                                                                                                                                              // New York style!
                                               updatePluginParams(plugin.id, {
                                                   'threshold': -20,
                                                   'ratio': 4,
                                                   'attack': 10,
                                                   'release': 100,
                                                   'knee': 30,
                                                   'makeup': 0,
                                                   'mix': 0.5,
                                               });
                                             }}
                                              className="flex-shrink-0 px-2 py-1 rounded-none text-[9px] font-bold uppercase tracking-wider bg-[#333] hover:bg-[#444] text-[#d4d4d4]"
                                          >Parallel (NY)</button>
                                      </div>

                                      <div className="grid grid-cols-2 gap-3 mt-1 px-1">
                                          {/* Threshold */}
                                          <div className="flex flex-col gap-1">
                                              <div className="flex justify-between text-[10px] text-[#999] uppercase">
                                                  <span>Threshold</span>
                                                  <span>{Number(plugin.params.threshold ?? -20).toFixed(1)} dB</span>
                                              </div>
                                              <input 
                                                 type="range" min="-60" max="0" step="0.5"
                                                 value={Number(plugin.params.threshold ?? -20)}
                                                 onChange={(e) => updatePluginParam(plugin.id, 'threshold', Number(e.target.value))}
                                                 className="h-1.5 bg-[#111] rounded-none appearance-none accent-[#ff7b00]"
                                              />
                                          </div>
                                          {/* Ratio */}
                                          <div className="flex flex-col gap-1">
                                              <div className="flex justify-between text-[10px] text-[#999] uppercase">
                                                  <span>Ratio</span>
                                                  <span>{Number(plugin.params.ratio ?? 4).toFixed(1)}:1</span>
                                              </div>
                                              <input 
                                                 type="range" min="1" max="20" step="0.5"
                                                 value={Number(plugin.params.ratio ?? 4)}
                                                 onChange={(e) => updatePluginParam(plugin.id, 'ratio', Number(e.target.value))}
                                                 className="h-1.5 bg-[#111] rounded-none appearance-none accent-[#ff7b00]"
                                              />
                                          </div>
                                      </div>

                                      <div className="grid grid-cols-2 gap-3 mt-1 px-1">
                                          {/* Attack */}
                                          <div className="flex flex-col gap-1">
                                              <div className="flex justify-between text-[10px] text-[#999] uppercase">
                                                  <span>Attack</span>
                                                  <span>{Number(plugin.params.attack ?? 10).toFixed(1)} ms</span>
                                              </div>
                                              <input 
                                                 type="range" min="0.1" max="100" step="0.1"
                                                 value={Number(plugin.params.attack ?? 10)}
                                                 onChange={(e) => updatePluginParam(plugin.id, 'attack', Number(e.target.value))}
                                                 className="h-1.5 bg-[#111] rounded-none appearance-none accent-[#ff7b00]"
                                              />
                                          </div>
                                          {/* Release */}
                                          <div className="flex flex-col gap-1">
                                              <div className="flex justify-between text-[10px] text-[#999] uppercase">
                                                  <span>Release</span>
                                                  <span>{Number(plugin.params.release ?? 100).toFixed(0)} ms</span>
                                              </div>
                                              <input 
                                                 type="range" min="1" max="1000" step="5"
                                                 value={Number(plugin.params.release ?? 100)}
                                                 onChange={(e) => updatePluginParam(plugin.id, 'release', Number(e.target.value))}
                                                 className="h-1.5 bg-[#111] rounded-none appearance-none accent-[#ff7b00]"
                                              />
                                          </div>
                                      </div>

                                      <div className="grid grid-cols-3 gap-2 mt-2 p-2 bg-[#111] border border-[#222]">
                                          {/* Knee */}
                                          <div className="flex flex-col gap-1">
                                              <div className="flex justify-between text-[9px] text-[#777] uppercase">
                                                  <span>Knee</span>
                                                  <span>{Number(plugin.params.knee ?? 10).toFixed(0)}</span>
                                              </div>
                                              <input 
                                                 type="range" min="0" max="40" step="1"
                                                 value={Number(plugin.params.knee ?? 10)}
                                                 onChange={(e) => updatePluginParam(plugin.id, 'knee', Number(e.target.value))}
                                                 className="h-1 bg-[#222] rounded-none appearance-none accent-[#ff7b00]"
                                              />
                                          </div>
                                          {/* Makeup */}
                                          <div className="flex flex-col gap-1">
                                              <div className="flex justify-between text-[9px] text-[#777] uppercase">
                                                  <span>Makeup</span>
                                                  <span>+{Number(plugin.params.makeup ?? 0).toFixed(1)}dB</span>
                                              </div>
                                              <input 
                                                 type="range" min="-12" max="24" step="0.5"
                                                 value={Number(plugin.params.makeup ?? 0)}
                                                 onChange={(e) => updatePluginParam(plugin.id, 'makeup', Number(e.target.value))}
                                                 className="h-1 bg-[#222] rounded-none appearance-none accent-[#ff7b00]"
                                              />
                                          </div>
                                          {/* Mix */}
                                          <div className="flex flex-col gap-1">
                                              <div className="flex justify-between text-[9px] text-[#777] uppercase">
                                                  <span>Mix</span>
                                                  <span>{Math.round(Number(plugin.params.mix ?? 1.0) * 100)}%</span>
                                              </div>
                                              <input 
                                                 type="range" min="0" max="1" step="0.05"
                                                 value={Number(plugin.params.mix ?? 1.0)}
                                                 onChange={(e) => updatePluginParam(plugin.id, 'mix', Number(e.target.value))}
                                                 className="h-1 bg-[#222] rounded-none appearance-none accent-[#ff7b00]"
                                              />
                                          </div>
                                      </div>
                                  </div>
                              ) : plugin.type === 'BITCRUSHER' ? (
                                  <div className="flex flex-col gap-2">
                                      {/* Presets */}
                                      <div className="flex gap-1 bg-[#111] p-1 rounded-none overflow-x-auto no-scrollbar">
                                          <button 
                                              onClick={() => {
                                               updatePluginParams(plugin.id, {
                                                   'bits': 16,
                                                   'drive': 3,
                                                   'preCut': 150,
                                                   'postCut': 8000,
                                                   'mix': 0.4,
                                               });
                                             }}
                                              className="flex-shrink-0 px-2 py-1 rounded-none text-[9px] font-bold uppercase tracking-wider bg-[#333] hover:bg-[#444] text-[#d4d4d4]"
                                          >SP1200 Style</button>
                                          <button 
                                              onClick={() => {
                                               updatePluginParams(plugin.id, {
                                                   'bits': 4,
                                                   'drive': 12,
                                                   'preCut': 20,
                                                   'postCut': 20000,
                                                   'mix': 1.0,
                                               });
                                             }}
                                              className="flex-shrink-0 px-2 py-1 rounded-none text-[9px] font-bold uppercase tracking-wider bg-[#333] hover:bg-[#444] text-[#d4d4d4]"
                                          >Destroy</button>
                                          <button 
                                              onClick={() => {
                                               updatePluginParams(plugin.id, {
                                                   'bits': 8,
                                                   'drive': 0,
                                                   'preCut': 20,
                                                   'postCut': 4000,
                                                   'mix': 1.0,
                                               });
                                             }}
                                              className="flex-shrink-0 px-2 py-1 rounded-none text-[9px] font-bold uppercase tracking-wider bg-[#333] hover:bg-[#444] text-[#d4d4d4]"
                                          >Arcade</button>
                                      </div>

                                      <div className="grid grid-cols-2 gap-3 mt-1 px-1">
                                          {/* Bits */}
                                          <div className="flex flex-col gap-1">
                                              <div className="flex justify-between text-[10px] text-[#999] uppercase">
                                                  <span>Resolution</span>
                                                  <span>{Number(plugin.params.bits ?? 8).toFixed(0)} Bit</span>
                                              </div>
                                              <input 
                                                 type="range" min="1" max="24" step="1"
                                                 value={Number(plugin.params.bits ?? 8)}
                                                 onChange={(e) => updatePluginParam(plugin.id, 'bits', Number(e.target.value))}
                                                 className="h-1.5 bg-[#111] rounded-none appearance-none accent-[#ff7b00]"
                                              />
                                          </div>
                                          {/* Drive */}
                                          <div className="flex flex-col gap-1">
                                              <div className="flex justify-between text-[10px] text-[#999] uppercase">
                                                  <span>Pre-Drive</span>
                                                  <span>+{Number(plugin.params.drive ?? 0).toFixed(1)} dB</span>
                                              </div>
                                              <input 
                                                 type="range" min="0" max="24" step="0.5"
                                                 value={Number(plugin.params.drive ?? 0)}
                                                 onChange={(e) => updatePluginParam(plugin.id, 'drive', Number(e.target.value))}
                                                 className="h-1.5 bg-[#111] rounded-none appearance-none accent-[#ff7b00]"
                                              />
                                          </div>
                                      </div>

                                      <div className="grid grid-cols-2 gap-3 mt-1 px-1">
                                          {/* Pre Cut */}
                                          <div className="flex flex-col gap-1">
                                              <div className="flex justify-between text-[10px] text-[#999] uppercase">
                                                  <span>HPF (Pre)</span>
                                                  <span>{Number(plugin.params.preCut ?? 20).toFixed(0)} Hz</span>
                                              </div>
                                              <input 
                                                 type="range" min="20" max="2000" step="10"
                                                 value={Number(plugin.params.preCut ?? 20)}
                                                 onChange={(e) => updatePluginParam(plugin.id, 'preCut', Number(e.target.value))}
                                                 className="h-1.5 bg-[#111] rounded-none appearance-none accent-[#ff7b00]"
                                              />
                                          </div>
                                          {/* Post Cut */}
                                          <div className="flex flex-col gap-1">
                                              <div className="flex justify-between text-[10px] text-[#999] uppercase">
                                                  <span>LPF (Post)</span>
                                                  <span>{Number(plugin.params.postCut ?? 20000).toFixed(0)} Hz</span>
                                              </div>
                                              <input 
                                                 type="range" min="500" max="20000" step="100"
                                                 value={Number(plugin.params.postCut ?? 20000)}
                                                 onChange={(e) => updatePluginParam(plugin.id, 'postCut', Number(e.target.value))}
                                                 className="h-1.5 bg-[#111] rounded-none appearance-none accent-[#ff7b00]"
                                              />
                                          </div>
                                      </div>

                                      <div className="flex flex-col gap-1 mt-2 p-2 bg-[#111] border border-[#222]">
                                          <div className="flex justify-between text-[9px] text-[#777] uppercase">
                                              <span>Mix</span>
                                              <span>{Math.round(Number(plugin.params.mix ?? 1.0) * 100)}%</span>
                                          </div>
                                          <input 
                                             type="range" min="0" max="1" step="0.05"
                                             value={Number(plugin.params.mix ?? 1.0)}
                                             onChange={(e) => updatePluginParam(plugin.id, 'mix', Number(e.target.value))}
                                             className="h-1 bg-[#222] rounded-none appearance-none accent-[#ff7b00]"
                                          />
                                      </div>
                                  </div>
                              ) : plugin.type === 'TAPE_SATURATION' ? (
                                  <div className="flex flex-col gap-2">
                                      {/* Presets */}
                                      <div className="flex gap-1 bg-[#111] p-1 rounded-none overflow-x-auto no-scrollbar">
                                          <button 
                                              onClick={() => {
                                               updatePluginParams(plugin.id, {
                                                   'ips': 30,
                                                   'drive': 3,
                                                   'bias': 0,
                                                   'makeup': 0,
                                                   'mix': 1.0,
                                               });
                                             }}
                                              className="flex-shrink-0 px-2 py-1 rounded-none text-[9px] font-bold uppercase tracking-wider bg-[#333] hover:bg-[#444] text-[#d4d4d4]"
                                          >Clean Mastering</button>
                                          <button 
                                              onClick={() => {
                                               updatePluginParams(plugin.id, {
                                                   'ips': 15,
                                                   'drive': 12,
                                                   'bias': 0.5,
                                                   'makeup': 2,
                                                   'mix': 1.0,
                                               });
                                             }}
                                              className="flex-shrink-0 px-2 py-1 rounded-none text-[9px] font-bold uppercase tracking-wider bg-[#333] hover:bg-[#444] text-[#d4d4d4]"
                                          >Fat Mix</button>
                                          <button 
                                              onClick={() => {
                                               updatePluginParams(plugin.id, {
                                                   'ips': 7.5,
                                                   'drive': 20,
                                                   'bias': -0.5,
                                                   'makeup': -2,
                                                   'mix': 1.0,
                                               });
                                             }}
                                              className="flex-shrink-0 px-2 py-1 rounded-none text-[9px] font-bold uppercase tracking-wider bg-[#333] hover:bg-[#444] text-[#d4d4d4]"
                                          >Lo-Fi Cassette</button>
                                      </div>

                                      <div className="grid grid-cols-2 gap-3 mt-1 px-1">
                                          {/* Drive */}
                                          <div className="flex flex-col gap-1">
                                              <div className="flex justify-between text-[10px] text-[#999] uppercase">
                                                  <span>Input Drive</span>
                                                  <span>+{Number(plugin.params.drive ?? 5).toFixed(1)} dB</span>
                                              </div>
                                              <input 
                                                 type="range" min="0" max="36" step="0.5"
                                                 value={Number(plugin.params.drive ?? 5)}
                                                 onChange={(e) => updatePluginParam(plugin.id, 'drive', Number(e.target.value))}
                                                 className="h-1.5 bg-[#111] rounded-none appearance-none accent-[#ff7b00]"
                                              />
                                          </div>
                                          {/* IPS */}
                                          <div className="flex flex-col gap-1">
                                              <div className="flex justify-between text-[10px] text-[#999] uppercase">
                                                  <span>Tape Speed</span>
                                                  <span>{Number(plugin.params.ips ?? 15)} IPS</span>
                                              </div>
                                              <div className="flex bg-[#111] border border-[#222]">
                                                  {[7.5, 15, 30].map(val => (
                                                      <button
                                                          key={val}
                                                          onClick={() => updatePluginParam(plugin.id, 'ips', val)}
                                                          className={`flex-1 py-1 text-[9px] font-bold ${Number(plugin.params.ips ?? 15) === val ? 'bg-[#ff7b00] text-black' : 'text-[#777] hover:bg-[#222]'}`}
                                                      >{val}</button>
                                                  ))}
                                              </div>
                                          </div>
                                      </div>

                                      <div className="grid grid-cols-3 gap-2 mt-2 p-2 bg-[#111] border border-[#222]">
                                          {/* Bias */}
                                          <div className="flex flex-col gap-1">
                                              <div className="flex justify-between text-[9px] text-[#777] uppercase">
                                                  <span>Bias</span>
                                                  <span>{Number(plugin.params.bias ?? 0).toFixed(2)}</span>
                                              </div>
                                              <input 
                                                 type="range" min="-1" max="1" step="0.05"
                                                 value={Number(plugin.params.bias ?? 0)}
                                                 onChange={(e) => updatePluginParam(plugin.id, 'bias', Number(e.target.value))}
                                                 className="h-1 bg-[#222] rounded-none appearance-none accent-[#ff7b00]"
                                              />
                                          </div>
                                          {/* Makeup */}
                                          <div className="flex flex-col gap-1">
                                              <div className="flex justify-between text-[9px] text-[#777] uppercase">
                                                  <span>Output</span>
                                                  <span>{Number(plugin.params.makeup ?? 0).toFixed(1)}dB</span>
                                              </div>
                                              <input 
                                                 type="range" min="-24" max="24" step="0.5"
                                                 value={Number(plugin.params.makeup ?? 0)}
                                                 onChange={(e) => updatePluginParam(plugin.id, 'makeup', Number(e.target.value))}
                                                 className="h-1 bg-[#222] rounded-none appearance-none accent-[#ff7b00]"
                                              />
                                          </div>
                                          {/* Mix */}
                                          <div className="flex flex-col gap-1">
                                              <div className="flex justify-between text-[9px] text-[#777] uppercase">
                                                  <span>Mix</span>
                                                  <span>{Math.round(Number(plugin.params.mix ?? 1.0) * 100)}%</span>
                                              </div>
                                              <input 
                                                 type="range" min="0" max="1" step="0.05"
                                                 value={Number(plugin.params.mix ?? 1.0)}
                                                 onChange={(e) => updatePluginParam(plugin.id, 'mix', Number(e.target.value))}
                                                 className="h-1 bg-[#222] rounded-none appearance-none accent-[#ff7b00]"
                                              />
                                          </div>
                                      </div>
                                  </div>
                              ) : (
                                 /* Generic Param Render */
                                 Object.entries(plugin.params).map(([key, value]) => {
                                     if (plugin.type === 'SIDECHAIN' && key === 'sourceTrackId') {
                                         return (
                                             <div key={key} className="flex flex-col gap-1">
                                                 <label className="text-[10px] text-[#999] uppercase">Source Track</label>
                                                 <select
                                                     className="bg-[#111] text-white p-1 rounded-none text-xs"
                                                     value={value as string}
                                                     onChange={(e) => updatePluginParam(plugin.id, key, e.target.value as any)}
                                                 >
                                                     <option value="">Select Track</option>
                                                     {tracks.filter(t => t.id !== track.id).map(t => (
                                                         <option key={t.id} value={t.id}>{t.name}</option>
                                                     ))}
                                                 </select>
                                             </div>
                                         );
                                     }
                                     
                                     const isFreq = key === 'frequency' || key === 'tone';
                                     const isDrive = key === 'drive';
                                     const isMix = key === 'mix';
                                     const isTime = key === 'time';
                                     const isFeedback = key === 'feedback';
                                     const isPitch = key === 'pitch';
                                     const isScale = key === 'scale';
                                     
                                     let defaultVal = 0.5;
                                     if (isFreq) defaultVal = key === 'tone' ? 3000 : 1000;
                                     if (isDrive) defaultVal = 50;
                                     if (isMix) defaultVal = 0.5;
                                     if (isTime) defaultVal = 0.3;
                                     if (isFeedback) defaultVal = 0.4;
                                     if (isPitch) defaultVal = 0;
                                     if (isScale) defaultVal = 0;

                                     return (
                                     <div key={key} className="flex flex-col gap-1">
                                         <div className="flex justify-between text-[10px] text-[#999] uppercase">
                                             <span>{key}</span>
                                             <div className="flex items-center">
                                                 <input 
                                                     type="number" 
                                                     value={(value as number).toFixed(isFreq || isDrive || isScale || isPitch ? 0 : 2)} 
                                                     step={isFreq ? 10 : (isScale || isPitch ? 1 : 0.01)}
                                                     onChange={(e) => updatePluginParam(plugin.id, key, Number(e.target.value))}
                                                     className="w-10 bg-transparent text-right outline-none focus:text-[#ff7b00] hide-arrows"
                                                 />
                                             </div>
                                         </div>
                                         <input 
                                            type="range"
                                            min={isFreq ? 20 : (isPitch ? -12 : 0)}
                                            max={isFreq ? 10000 : (isDrive ? 100 : (isScale ? 11 : (isPitch ? 12 : (isMix || isFeedback ? 1 : 2))))}
                                            step={isFreq ? 10 : (isScale || isPitch ? 1 : 0.01)}
                                            value={value as number}
                                            onChange={(e) => updatePluginParam(plugin.id, key, Number(e.target.value))}
                                            onDoubleClick={() => updatePluginParam(plugin.id, key, defaultVal)}
                                            className="h-1.5 bg-[#111] rounded-none appearance-none accent-[#ff7b00]"
                                            title={`${key}: ${(value as number).toFixed(2)} (Double-click to reset)`}
                                         />
                                     </div>
                                 )})
                             )}
                         </div>
                     )}
                     </div>
                 </div>
                 );
             })}

             <div className="w-64 flex-shrink-0 relative">
                 <button 
                    onClick={() => setIsAdding(!isAdding)}
                    className="w-full h-full min-h-[150px] border border-dashed border-[#444] rounded-none hover:border-[#ff7b00] hover:text-[#ff7b00] text-[#999] text-xs flex flex-col items-center justify-center gap-2 transition-none bg-[#1e1e1e]"
                    title="Add new audio effect plugin"
                 >
                    <Plus size={24} /> 
                    <span className="font-bold uppercase tracking-wider">Add Effect</span>
                 </button>
                 
                 {isAdding && (
                     <div className="absolute top-0 left-full ml-2 w-48 bg-[#2d2d2d] border border-[#111] rounded-none shadow-none z-50 overflow-y-auto max-h-64">
                         {['DELAY', 'REVERB', 'DISTORTION', 'FILTER', 'LIMITER', 'SIDECHAIN', 'EQ', 'COMPRESSOR', 'BITCRUSHER', 'TAPE_SATURATION'].map(type => (
                             <button
                                key={type}
                                onClick={() => addPlugin(type as PluginType)}
                                className="w-full text-left px-4 py-2 text-xs hover:bg-[#444] text-[#d4d4d4]"
                             >
                                {type}
                             </button>
                         ))}
                     </div>
                 )}
             </div>
      </div>
    </div>
  );
};
