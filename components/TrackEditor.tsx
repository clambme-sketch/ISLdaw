
import React, { useState } from 'react';
import { Track, AudioPlugin, PluginType } from '../types';
import { X, Plus, Power, Trash2, Sliders, Waves, Box, Disc } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

interface TrackEditorProps {
  track: Track;
  onUpdate: (trackId: string, updates: Partial<Track>) => void;
  onClose: () => void;
}

export const TrackEditor: React.FC<TrackEditorProps> = ({ track, onUpdate, onClose }) => {
  const [isAdding, setIsAdding] = useState(false);

  const addPlugin = (type: PluginType) => {
    const newPlugin: AudioPlugin = {
        id: uuidv4(),
        type,
        enabled: true,
        params: {}
    };
    
    // Set default params
    if (type === 'DISTORTION') newPlugin.params.drive = 50;
    if (type === 'DELAY') { newPlugin.params.time = 0.3; newPlugin.params.feedback = 0.5; }
    if (type === 'HIGHPASS') newPlugin.params.frequency = 200;
    if (type === 'LOWPASS') newPlugin.params.frequency = 2000;
    if (type === 'REVERB') {
        newPlugin.params.decay = 2.0;
        newPlugin.params.mix = 0.5;
        newPlugin.params.type = 0; // Hall
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
    <div className="h-64 bg-gray-900 border-t border-gray-700 flex flex-col shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.3)] z-40 animate-slide-up">
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-800 bg-gray-850">
        <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-gray-200 uppercase tracking-wider">Track Editor:</span>
            <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: track.color || '#fff' }}></div>
                <span className="text-sm text-white font-medium">{track.name}</span>
            </div>
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors" title="Close Editor">
          <X size={16} />
        </button>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Plugin List / Chain */}
        <div className="w-64 border-r border-gray-800 bg-gray-900/50 flex flex-col p-4 gap-2 overflow-y-auto custom-scrollbar">
             <div className="text-xs text-gray-500 font-bold uppercase mb-2">Signal Chain</div>
             
             {track.plugins.map((plugin, index) => (
                 <div key={plugin.id} className={`p-3 rounded-lg border flex flex-col gap-2 ${plugin.enabled ? 'bg-gray-800 border-gray-700' : 'bg-gray-900 border-gray-800 opacity-60'}`}>
                     <div className="flex items-center justify-between">
                         <span className="font-semibold text-xs text-blue-400">{index + 1}. {plugin.type}</span>
                         <div className="flex items-center gap-1">
                             <button onClick={() => togglePlugin(plugin.id)} className="p-1 hover:text-white text-gray-400" title={plugin.enabled ? "Disable Effect" : "Enable Effect"}>
                                <Power size={12} className={plugin.enabled ? "text-green-400" : ""} />
                             </button>
                             <button onClick={() => removePlugin(plugin.id)} className="p-1 hover:text-red-400 text-gray-500" title="Remove Effect">
                                <Trash2 size={12} />
                             </button>
                         </div>
                     </div>
                     
                     {/* Dynamic Controls Render */}
                     {plugin.enabled && (
                         <div className="grid grid-cols-1 gap-3">
                             {/* Special UI for Reverb */}
                             {plugin.type === 'REVERB' ? (
                                <>
                                    <div className="flex gap-1 justify-between bg-gray-900 p-1 rounded">
                                        {[
                                            {id: 0, icon: Waves, label: 'Hall'},
                                            {id: 1, icon: Box, label: 'Room'},
                                            {id: 2, icon: Disc, label: 'Plate'}
                                        ].map(t => (
                                            <button 
                                                key={t.id}
                                                onClick={() => updatePluginParam(plugin.id, 'type', t.id)}
                                                className={`flex-1 p-1 rounded flex flex-col items-center justify-center gap-1 ${plugin.params.type === t.id ? 'bg-blue-600 text-white' : 'hover:bg-gray-700 text-gray-400'}`}
                                                title={`Reverb Type: ${t.label}`}
                                            >
                                                <t.icon size={12} />
                                            </button>
                                        ))}
                                    </div>
                                    <div className="flex flex-col gap-1">
                                         <div className="flex justify-between text-[10px] text-gray-400 uppercase">
                                             <span>Decay</span>
                                             <span>{(plugin.params.decay).toFixed(1)}s</span>
                                         </div>
                                         <input 
                                            type="range" min="0.1" max="10" step="0.1"
                                            value={plugin.params.decay}
                                            onChange={(e) => updatePluginParam(plugin.id, 'decay', Number(e.target.value))}
                                            className="h-1 bg-gray-700 rounded-full appearance-none accent-blue-500"
                                            title={`Decay Time: ${plugin.params.decay.toFixed(1)}s`}
                                         />
                                     </div>
                                     <div className="flex flex-col gap-1">
                                         <div className="flex justify-between text-[10px] text-gray-400 uppercase">
                                             <span>Mix</span>
                                             <span>{(plugin.params.mix * 100).toFixed(0)}%</span>
                                         </div>
                                         <input 
                                            type="range" min="0" max="1" step="0.01"
                                            value={plugin.params.mix}
                                            onChange={(e) => updatePluginParam(plugin.id, 'mix', Number(e.target.value))}
                                            className="h-1 bg-gray-700 rounded-full appearance-none accent-blue-500"
                                            title={`Wet/Dry Mix: ${(plugin.params.mix * 100).toFixed(0)}%`}
                                         />
                                     </div>
                                </>
                             ) : (
                                 /* Generic Param Render */
                                 Object.entries(plugin.params).map(([key, value]) => (
                                     <div key={key} className="flex flex-col gap-1">
                                         <div className="flex justify-between text-[10px] text-gray-400 uppercase">
                                             <span>{key}</span>
                                             <span>{(value as number).toFixed(1)}</span>
                                         </div>
                                         <input 
                                            type="range"
                                            min={key === 'frequency' ? 20 : 0}
                                            max={key === 'frequency' ? 10000 : (key === 'drive' ? 100 : 2)}
                                            step={key === 'frequency' ? 10 : 0.01}
                                            value={value as number}
                                            onChange={(e) => updatePluginParam(plugin.id, key, Number(e.target.value))}
                                            className="h-1 bg-gray-700 rounded-full appearance-none accent-blue-500"
                                            title={`${key}: ${(value as number).toFixed(2)}`}
                                         />
                                     </div>
                                 ))
                             )}
                         </div>
                     )}
                 </div>
             ))}

             <div className="relative mt-2">
                 <button 
                    onClick={() => setIsAdding(!isAdding)}
                    className="w-full py-2 border border-dashed border-gray-700 rounded hover:border-blue-500 hover:text-blue-400 text-gray-500 text-xs flex items-center justify-center gap-1 transition-colors"
                    title="Add new audio effect plugin"
                 >
                    <Plus size={12} /> Add Effect
                 </button>
                 
                 {isAdding && (
                     <div className="absolute top-full left-0 w-full mt-2 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-50 overflow-hidden">
                         {['DELAY', 'REVERB', 'DISTORTION', 'HIGHPASS', 'LOWPASS'].map(type => (
                             <button
                                key={type}
                                onClick={() => addPlugin(type as PluginType)}
                                className="w-full text-left px-4 py-2 text-xs hover:bg-gray-700 text-gray-300"
                             >
                                {type}
                             </button>
                         ))}
                     </div>
                 )}
             </div>
        </div>

        {/* Visualization Area */}
        <div className="flex-1 bg-gray-950 flex items-center justify-center text-gray-700 flex-col gap-4 relative overflow-hidden">
            {/* Background Aesthetic */}
            <div className="absolute inset-0 opacity-5 grid grid-cols-12 gap-4 pointer-events-none">
                 {Array.from({length: 12}).map((_, i) => (
                     <div key={i} className="h-full bg-blue-500 blur-3xl"></div>
                 ))}
            </div>
            
            <Sliders size={48} className="text-gray-800" />
            <p className="text-sm z-10">Select an effect on the left to adjust parameters</p>
        </div>
      </div>
    </div>
  );
};
