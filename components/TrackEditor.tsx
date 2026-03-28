
import React, { useState } from 'react';
import { Track, AudioPlugin, PluginType } from '../types';
import { X, Plus, Power, Trash2, Sliders, Waves, Box, Disc } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

interface TrackEditorProps {
  track: Track;
  tracks: Track[];
  onUpdate: (trackId: string, updates: Partial<Track>) => void;
  onClose: () => void;
}

export const TrackEditor: React.FC<TrackEditorProps> = ({ track, tracks, onUpdate, onClose }) => {
  const [isAdding, setIsAdding] = useState(false);

  const addPlugin = (type: PluginType) => {
    const newPlugin: AudioPlugin = {
        id: uuidv4(),
        type,
        enabled: true,
        params: {}
    };
    
    // Set default params
    if (type === 'DISTORTION') { newPlugin.params.drive = 50; newPlugin.params.tone = 3000; newPlugin.params.mix = 1.0; }
    if (type === 'DELAY') { newPlugin.params.time = 0.3; newPlugin.params.feedback = 0.4; newPlugin.params.mix = 0.5; }
    if (type === 'HIGHPASS') newPlugin.params.frequency = 200;
    if (type === 'LOWPASS') newPlugin.params.frequency = 2000;
    if (type === 'REVERB') {
        newPlugin.params.decay = 2.0;
        newPlugin.params.mix = 0.5;
        newPlugin.params.type = 0; // Hall
    }
    if (type === 'LIMITER') {
        newPlugin.params.threshold = -0.1;
        newPlugin.params.release = 0.1;
    }
    if (type === 'COMPRESSOR') {
        newPlugin.params.threshold = -24;
        newPlugin.params.knee = 30;
        newPlugin.params.ratio = 12;
        newPlugin.params.attack = 0.003;
        newPlugin.params.release = 0.25;
    }
    if (type === 'SIDECHAIN') {
        newPlugin.params.threshold = -24;
        newPlugin.params.ratio = 12;
        newPlugin.params.attack = 0.003;
        newPlugin.params.release = 0.25;
        newPlugin.params.sourceTrackId = '';
    }

    onUpdate(track.id, { plugins: [...track.plugins, newPlugin] });
    setIsAdding(false);
  };

  const updatePluginParam = (pluginId: string, param: string, value: number) => {
    const newPlugins = track.plugins.map(p => {
        if (p.id === pluginId) {
            return { ...p, params: { ...p.params, [param]: value } };
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
    <div className="h-64 bg-[#2d2d2d] border-t border-[#111] flex flex-col shadow-none z-40 transition-none">
      <div className="flex items-center justify-between px-4 py-2 border-b border-[#111] bg-[#2d2d2d]">
        <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-[#d4d4d4] uppercase tracking-wider">Track Editor:</span>
            <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-none" style={{ backgroundColor: track.color || '#fff' }}></div>
                <span className="text-sm text-white font-medium">{track.name}</span>
            </div>
        </div>
        <button onClick={onClose} className="text-[#999] hover:text-[#d4d4d4] transition-none" title="Close Editor">
          <X size={16} />
        </button>
      </div>

      <div className="flex-1 flex overflow-x-auto overflow-y-hidden bg-[#1e1e1e] p-4 gap-4 custom-scrollbar items-stretch">
             {track.plugins.map((plugin, index) => (
                 <div key={plugin.id} className={`w-64 flex-shrink-0 rounded-none border flex flex-col ${plugin.enabled ? 'bg-[#2d2d2d] border-[#111]' : 'bg-[#1e1e1e] border-[#111] opacity-60'}`}>
                     <div className="flex items-center justify-between p-2 border-b border-[#111] bg-[#222]">
                         <span className="font-semibold text-xs text-[#d4d4d4]">{index + 1}. {plugin.type}</span>
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
                             {plugin.type === 'REVERB' ? (
                                <>
                                    <div className="flex gap-1 justify-between bg-[#111] p-1 rounded-none">
                                        {[
                                            {id: 0, icon: Waves, label: 'Hall'},
                                            {id: 1, icon: Box, label: 'Room'},
                                            {id: 2, icon: Disc, label: 'Plate'}
                                        ].map(t => (
                                            <button 
                                                key={t.id}
                                                onClick={() => updatePluginParam(plugin.id, 'type', t.id)}
                                                className={`flex-1 p-1 rounded-none flex flex-col items-center justify-center gap-1 ${plugin.params.type === t.id ? 'bg-[#ff7b00] text-black' : 'hover:bg-[#444] text-[#999]'}`}
                                                title={`Reverb Type: ${t.label}`}
                                            >
                                                <t.icon size={12} />
                                            </button>
                                        ))}
                                    </div>
                                     <div className="flex flex-col gap-1">
                                         <div className="flex justify-between text-[10px] text-[#999] uppercase">
                                             <span>Decay</span>
                                             <div className="flex items-center">
                                                 <input 
                                                     type="number" 
                                                     value={plugin.params.decay.toFixed(1)} 
                                                     step="0.1"
                                                     onChange={(e) => updatePluginParam(plugin.id, 'decay', Number(e.target.value))}
                                                     className="w-8 bg-transparent text-right outline-none focus:text-[#ff7b00] hide-arrows"
                                                 />
                                                 <span>s</span>
                                             </div>
                                         </div>
                                         <input 
                                            type="range" min="0.1" max="10" step="0.1"
                                            value={plugin.params.decay}
                                            onChange={(e) => updatePluginParam(plugin.id, 'decay', Number(e.target.value))}
                                            onDoubleClick={() => updatePluginParam(plugin.id, 'decay', 1.5)}
                                            className="h-1.5 bg-[#111] rounded-none appearance-none accent-[#ff7b00]"
                                            title={`Decay Time: ${plugin.params.decay.toFixed(1)}s (Double-click to reset)`}
                                         />
                                     </div>
                                     <div className="flex flex-col gap-1">
                                         <div className="flex justify-between text-[10px] text-[#999] uppercase">
                                             <span>Mix</span>
                                             <div className="flex items-center">
                                                 <input 
                                                     type="number" 
                                                     value={Math.round(plugin.params.mix * 100)} 
                                                     onChange={(e) => updatePluginParam(plugin.id, 'mix', Number(e.target.value) / 100)}
                                                     className="w-8 bg-transparent text-right outline-none focus:text-[#ff7b00] hide-arrows"
                                                 />
                                                 <span>%</span>
                                             </div>
                                         </div>
                                         <input 
                                            type="range" min="0" max="1" step="0.01"
                                            value={plugin.params.mix}
                                            onChange={(e) => updatePluginParam(plugin.id, 'mix', Number(e.target.value))}
                                            onDoubleClick={() => updatePluginParam(plugin.id, 'mix', 0.3)}
                                            className="h-1.5 bg-[#111] rounded-none appearance-none accent-[#ff7b00]"
                                            title={`Wet/Dry Mix: ${(plugin.params.mix * 100).toFixed(0)}% (Double-click to reset)`}
                                         />
                                     </div>
                                 </>
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
             ))}

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
                         {['DELAY', 'REVERB', 'DISTORTION', 'HIGHPASS', 'LOWPASS', 'LIMITER', 'SIDECHAIN', 'EQ8', 'COMPRESSOR', 'BITCRUSHER'].map(type => (
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
