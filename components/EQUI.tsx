import React, {
  useRef,
  useEffect,
  useState,
  useCallback,
  useMemo,
} from "react";
import { AudioPlugin } from "../types";

interface EQUIProps {
  plugin: AudioPlugin;
  updatePluginParam: (pluginId: string, param: string, value: any) => void;
  updatePluginParams: (pluginId: string, updates: Record<string, any>) => void;
}

const EQUI: React.FC<EQUIProps> = ({
  plugin,
  updatePluginParam,
  updatePluginParams,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [draggingBand, setDraggingBand] = useState<number | null>(null);

  // Biquad math to compute the frequency response curve using OfflineAudioContext
  const getResponseCurve = useCallback(
    (width: number, height: number) => {
      if (!width || !height) return "";
      try {
        const AudioContextClass =
          window.OfflineAudioContext ||
          (window as any).webkitOfflineAudioContext;
        const ctx = new AudioContextClass(1, 44100, 44100);

        // X coordinates 0 to width, convert to frequencies
        const pointsCount = Math.min(width, 250); // sample every ~2-3 pixels
        const freqs = new Float32Array(pointsCount);
        const minLog = Math.log10(20);
        const maxLog = Math.log10(20000);
        for (let i = 0; i < pointsCount; i++) {
          const logNormalized = i / (pointsCount - 1);
          freqs[i] = Math.pow(10, minLog + logNormalized * (maxLog - minLog));
        }

        const totalMag = new Float32Array(pointsCount);
        totalMag.fill(1); // Gain multiplier starts at 1

        for (let i = 0; i < 8; i++) {
          if (plugin.params[`band${i}_active`] === false) continue;

          const f = ctx.createBiquadFilter();
          f.type =
            (plugin.params[`band${i}_type`] as BiquadFilterType) || "peaking";
          f.frequency.value = Number(plugin.params[`band${i}_freq`]) || 1000;
          f.gain.value = Number(plugin.params[`band${i}_gain`]) || 0;
          f.Q.value = Number(plugin.params[`band${i}_q`]) || 1;

          const mag = new Float32Array(pointsCount);
          const phase = new Float32Array(pointsCount);
          f.getFrequencyResponse(freqs, mag, phase);

          for (let j = 0; j < pointsCount; j++) {
            totalMag[j] *= mag[j];
          }
        }

        let d = "";
        for (let i = 0; i < pointsCount; i++) {
          const x = (i / (pointsCount - 1)) * width;
          const db = 20 * Math.log10(Math.max(totalMag[i], 0.0001));
          const clampedDb = Math.max(-24, Math.min(24, db));
          const y = height / 2 - clampedDb * (height / 48);

          if (i === 0) d += `M ${x},${y} `;
          else d += `L ${x},${y} `;
        }
        return d;
      } catch (e) {
        console.error(e);
        return `M 0,${height / 2} L ${width},${height / 2}`;
      }
    },
    [plugin.params],
  );

  const handlePointerDown = (e: React.PointerEvent, bandIndex: number) => {
    e.stopPropagation();
    e.target.setPointerCapture(e.pointerId);
    setDraggingBand(bandIndex);
    updatePluginParam(plugin.id, "ui_selectedBand", bandIndex);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (draggingBand === null || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();

    let x = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
    let y = Math.max(0, Math.min(rect.height, e.clientY - rect.top));

    // convert x back to freq (log scale)
    const logNormalized = x / rect.width;
    const minLog = Math.log10(20);
    const maxLog = Math.log10(20000);
    let freq = Math.pow(10, minLog + logNormalized * (maxLog - minLog));
    freq = Math.round(freq);

    // convert y back to gain (-24 to +24)
    const gainNormalized = (rect.height / 2 - y) / (rect.height / 48);
    const gain = Math.max(
      -24,
      Math.min(24, Math.round(gainNormalized * 10) / 10),
    );

    updatePluginParams(plugin.id, {
      [`band${draggingBand}_freq`]: freq,
      [`band${draggingBand}_gain`]: gain,
    });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (draggingBand !== null) {
      e.target.releasePointerCapture(e.pointerId);
      setDraggingBand(null);
    }
  };

  // Prepare grid lines
  const getGridLines = () => {
    const lines = [];
    const freqs = [20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000];
    for (let f of freqs) {
      const minLog = Math.log10(20);
      const maxLog = Math.log10(20000);
      const x = ((Math.log10(f) - minLog) / (maxLog - minLog)) * 100;
      lines.push(
        <line
          key={`v-${f}`}
          x1={`${x}%`}
          y1="0"
          x2={`${x}%`}
          y2="100%"
          stroke="rgba(255,255,255,0.05)"
          strokeWidth="1"
        />,
      );
      const label = f >= 1000 ? `${f / 1000}k` : `${f}`;
      lines.push(
        <text
          key={`t-${f}`}
          x={`${x}%`}
          y="100%"
          dy="-6"
          dx="4"
          fill="#666"
          fontSize="9px"
          fontFamily="monospace"
        >
          {label}
        </text>,
      );
    }

    // Horizontal dB lines (+12, 0, -12)
    lines.push(
      <line
        key="h-12"
        x1="0"
        y1="25%"
        x2="100%"
        y2="25%"
        stroke="rgba(255,255,255,0.05)"
        strokeWidth="1"
      />,
    );
    lines.push(
      <text
        key="t-h12"
        x="2"
        y="25%"
        dy="-4"
        fill="#666"
        fontSize="9px"
        fontFamily="monospace"
      >
        +12dB
      </text>,
    );

    lines.push(
      <line
        key="h0"
        x1="0"
        y1="50%"
        x2="100%"
        y2="50%"
        stroke="rgba(255,255,255,0.15)"
        strokeWidth="1.5"
      />,
    );
    lines.push(
      <text
        key="t-h0"
        x="2"
        y="50%"
        dy="-4"
        fill="#999"
        fontSize="9px"
        fontFamily="monospace"
      >
        0dB
      </text>,
    );

    lines.push(
      <line
        key="h--12"
        x1="0"
        y1="75%"
        x2="100%"
        y2="75%"
        stroke="rgba(255,255,255,0.05)"
        strokeWidth="1"
      />,
    );
    lines.push(
      <text
        key="t-h-12"
        x="2"
        y="75%"
        dy="-4"
        fill="#666"
        fontSize="9px"
        fontFamily="monospace"
      >
        -12dB
      </text>,
    );

    return lines;
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Presets Row */}
      <div className="flex gap-2 bg-[#0c0c0c] p-2 rounded-lg overflow-x-auto no-scrollbar border border-[#222]">
        <button
          onClick={() => {
            for (let i = 0; i < 8; i++) {
              updatePluginParam(plugin.id, `band${i}_gain`, 0);
              updatePluginParam(plugin.id, `band${i}_active`, true);
            }
          }}
          className="flex-shrink-0 px-3 py-1.5 rounded-md text-[10px] font-semibold text-[#888] bg-[#1a1a1a] hover:bg-[#222] hover:text-[#eee] transition-colors"
        >
          Flat
        </button>
        <button
          onClick={() => {
            updatePluginParam(plugin.id, `band0_type`, "highpass");
            updatePluginParam(plugin.id, `band0_freq`, 80);
            updatePluginParam(plugin.id, `band0_q`, 0.71);
            updatePluginParam(plugin.id, `band0_active`, true);
            for (let i = 1; i < 8; i++)
              updatePluginParam(plugin.id, `band${i}_gain`, 0);
          }}
          className="flex-shrink-0 px-3 py-1.5 rounded-md text-[10px] font-semibold text-[#10b981] bg-[#10b9811a] hover:bg-[#10b98133] transition-colors"
        >
          80Hz Cut
        </button>
        <button
          onClick={() => {
            updatePluginParams(plugin.id, {
              band0_type: "highpass",
              band0_freq: 80,
              band2_type: "peaking",
              band2_freq: 300,
              band2_gain: -2,
              band5_type: "peaking",
              band5_freq: 3500,
              band5_gain: 3,
              band7_type: "highshelf",
              band7_freq: 10000,
              band7_gain: 2,
            });
          }}
          className="flex-shrink-0 px-3 py-1.5 rounded-md text-[10px] font-semibold text-[#10b981] bg-[#10b9811a] hover:bg-[#10b98133] transition-colors"
        >
          Vocal Presence
        </button>
        <button
          onClick={() => {
            updatePluginParams(plugin.id, {
              band0_type: "highpass",
              band0_freq: 30,
              band1_type: "peaking",
              band1_freq: 60,
              band1_gain: 3,
              band2_type: "peaking",
              band2_freq: 400,
              band2_gain: -3,
              band6_type: "highshelf",
              band6_freq: 8000,
              band6_gain: 2,
            });
          }}
          className="flex-shrink-0 px-3 py-1.5 rounded-md text-[10px] font-semibold text-[#10b981] bg-[#10b9811a] hover:bg-[#10b98133] transition-colors"
        >
          Drum Punch
        </button>
      </div>

      {/* EQ Frequency Visualizer Graph */}
      <div
        ref={containerRef}
        className="h-40 bg-gradient-to-b from-[#111111] to-[#080808] relative border border-[#262626] rounded-xl overflow-hidden shadow-inner group touch-none"
      >
        <svg
          width="100%"
          height="100%"
          className="absolute inset-0 pointer-events-none"
        >
          {getGridLines()}

          <path
            d={getResponseCurve(
              containerRef.current?.getBoundingClientRect().width || 800,
              containerRef.current?.getBoundingClientRect().height || 160,
            )}
            fill="none"
            stroke="#10b981"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Fill underneath the curve */}
          <path
            d={`${getResponseCurve(containerRef.current?.getBoundingClientRect().width || 800, containerRef.current?.getBoundingClientRect().height || 160)} L ${containerRef.current?.getBoundingClientRect().width || 800},160 L 0,160 Z`}
            fill="rgba(16, 185, 129, 0.15)"
            stroke="none"
          />
        </svg>

        {/* Draggable Band Nodes */}
        <div
          className="absolute inset-0 z-10"
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
        >
          {Array.from({ length: 8 }).map((_, i) => {
            const isActive = plugin.params[`band${i}_active`] !== false;
            if (!isActive) return null;

            const isSelected = plugin.params.ui_selectedBand === i;
            const freq = Number(plugin.params[`band${i}_freq`]) || 1000;
            const gain = Number(plugin.params[`band${i}_gain`]) || 0;
            const width =
              containerRef.current?.getBoundingClientRect().width || 800;
            const height =
              containerRef.current?.getBoundingClientRect().height || 160;
            const x =
              (Math.log10(Math.max(20, Math.min(20000, freq)) / 20) /
                Math.log10(20000 / 20)) *
              width;
            const y = height / 2 - gain * (height / 48);

            return (
              <div
                key={i}
                onPointerDown={(e) => handlePointerDown(e, i)}
                style={{
                  transform: `translate(${x}px, ${y}px) translate(-50%, -50%)`,
                }}
                className={`absolute w-6 h-6 flex items-center justify-center cursor-move transition-transform ease-out duration-75
                                    ${isSelected ? "scale-125 z-20" : "scale-100 hover:scale-110 z-10"}
                                `}
              >
                <div
                  className={`w-3.5 h-3.5 rounded-full border-2 
                                    ${isSelected ? "bg-white border-[#10b981]" : "bg-[#10b981] border-[#111] opacity-60 hover:opacity-100"}
                                `}
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* Band Selection & Parameters */}
      <div className="flex gap-1 p-1 bg-[#111] rounded-lg border border-[#222]">
        {Array.from({ length: 8 }).map((_, i) => {
          const isSelected = plugin.params.ui_selectedBand === i;
          const isActive = plugin.params[`band${i}_active`] !== false;
          if (!isActive) return null;
          return (
            <button
              key={i}
              onClick={() => updatePluginParam(plugin.id, "ui_selectedBand", i)}
              className={`flex-1 flex flex-col items-center py-2 rounded-md transition-colors
                                ${isSelected ? "bg-[#222] shadow-sm" : "hover:bg-[#1a1a1a]"}
                            `}
            >
              <span
                className={`text-[10px] font-bold ${isSelected ? "text-white" : "text-[#666]"}`}
              >
                {i + 1}
              </span>
              <div
                className={`w-1.5 h-1.5 rounded-full mt-1 
                                ${isSelected ? "bg-[#10b981]" : "bg-[#0a6c4b]"}
                            `}
              />
            </button>
          );
        })}
        {Array.from({ length: 8 }).filter(
          (_, i) => plugin.params[`band${i}_active`] === false,
        ).length > 0 && (
          <button
            onClick={() => {
              for (let i = 0; i < 8; i++) {
                if (plugin.params[`band${i}_active`] === false) {
                  updatePluginParams(plugin.id, {
                    [`band${i}_active`]: true,
                    ui_selectedBand: i,
                  });
                  break;
                }
              }
            }}
            className="w-10 flex flex-col items-center justify-center py-2 rounded-md transition-colors hover:bg-[#1f1f1f] border border-dashed border-[#444] ml-1"
            title="Add EQ Band"
          >
            <span className="text-[#888] font-bold text-lg leading-none">
              +
            </span>
          </button>
        )}
      </div>

      {/* Selected Band Details Panel */}
      {plugin.params.ui_selectedBand !== undefined && (
        <div className="bg-[#111] rounded-xl border border-[#262626] p-4 flex flex-col gap-4">
          <div className="flex justify-between items-center bg-[#1a1a1a] p-2 rounded-lg border border-[#333]">
            <div className="flex items-center gap-3">
              <div className="w-6 h-6 rounded-md bg-[#10b981] flex items-center justify-center text-black font-bold text-xs">
                {(plugin.params.ui_selectedBand as number) + 1}
              </div>
              <span className="text-sm font-semibold text-white uppercase tracking-wider">
                Band
              </span>
            </div>

            <div className="flex items-center gap-2">
              <select
                className="bg-[#2a2a2a] text-[#ddd] text-xs font-medium outline-none border-none py-1.5 px-3 rounded-md cursor-pointer hover:bg-[#333] transition-colors"
                value={
                  plugin.params[
                    `band${plugin.params.ui_selectedBand}_type`
                  ] as string
                }
                onChange={(e) =>
                  updatePluginParam(
                    plugin.id,
                    `band${plugin.params.ui_selectedBand}_type`,
                    e.target.value,
                  )
                }
              >
                <option value="peaking">Bell / Peaking</option>
                <option value="lowshelf">Low Shelf</option>
                <option value="highshelf">High Shelf</option>
                <option value="highpass">Low Cut</option>
                <option value="lowpass">High Cut</option>
                <option value="notch">Notch</option>
                <option value="bandpass">Bandpass</option>
              </select>

              <button
                onClick={() =>
                  updatePluginParam(
                    plugin.id,
                    `band${plugin.params.ui_selectedBand}_active`,
                    plugin.params[
                      `band${plugin.params.ui_selectedBand}_active`
                    ] === false,
                  )
                }
                className={`px-4 py-1.5 text-xs font-bold uppercase rounded-md transition-all
                                    ${
                                      plugin.params[
                                        `band${plugin.params.ui_selectedBand}_active`
                                      ] !== false
                                        ? "bg-[#10b981] text-black shadow-[0_0_10px_rgba(16,185,129,0.3)]"
                                        : "bg-[#222] text-[#666] hover:text-[#999]"
                                    }
                                `}
              >
                {plugin.params[
                  `band${plugin.params.ui_selectedBand}_active`
                ] !== false
                  ? "ON"
                  : "OFF"}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-6 px-2">
            {/* Freq */}
            <div className="flex flex-col gap-2 relative">
              <div className="flex justify-between items-baseline">
                <span className="text-[10px] text-[#666] font-bold uppercase tracking-widest">
                  Freq
                </span>
                <span className="text-xs font-mono text-white">
                  {Number(
                    plugin.params[`band${plugin.params.ui_selectedBand}_freq`],
                  ).toFixed(0)}{" "}
                  Hz
                </span>
              </div>
              <input
                type="range"
                min="20"
                max="20000"
                step="1"
                value={Number(
                  plugin.params[`band${plugin.params.ui_selectedBand}_freq`],
                )}
                onChange={(e) =>
                  updatePluginParam(
                    plugin.id,
                    `band${plugin.params.ui_selectedBand}_freq`,
                    Number(e.target.value),
                  )
                }
                className="w-full h-1 bg-[#333] rounded-full appearance-none outline-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-[#10b981] [&::-webkit-slider-thumb]:rounded-full hover:[&::-webkit-slider-thumb]:scale-125 transition-all"
              />
            </div>

            {/* Gain */}
            <div className="flex flex-col gap-2 relative">
              <div className="flex justify-between items-baseline">
                <span className="text-[10px] text-[#666] font-bold uppercase tracking-widest">
                  Gain
                </span>
                <span className="text-xs font-mono text-white">
                  {Number(
                    plugin.params[`band${plugin.params.ui_selectedBand}_gain`],
                  ).toFixed(1)}{" "}
                  dB
                </span>
              </div>
              <input
                type="range"
                min="-24"
                max="24"
                step="0.1"
                value={Number(
                  plugin.params[`band${plugin.params.ui_selectedBand}_gain`],
                )}
                onChange={(e) =>
                  updatePluginParam(
                    plugin.id,
                    `band${plugin.params.ui_selectedBand}_gain`,
                    Number(e.target.value),
                  )
                }
                className={`w-full h-1 rounded-full appearance-none outline-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-[#10b981] [&::-webkit-slider-thumb]:rounded-full hover:[&::-webkit-slider-thumb]:scale-125 transition-all
                                    ${plugin.params[`band${plugin.params.ui_selectedBand}_type`] === "highpass" || plugin.params[`band${plugin.params.ui_selectedBand}_type`] === "lowpass" || plugin.params[`band${plugin.params.ui_selectedBand}_type`] === "notch" ? "opacity-30 grayscale cursor-not-allowed" : "bg-[#333]"}
                                `}
                style={{
                  background: `linear-gradient(to right, #10b981 ${((Number(plugin.params[`band${plugin.params.ui_selectedBand}_gain`]) + 24) / 48) * 100}%, #333 ${((Number(plugin.params[`band${plugin.params.ui_selectedBand}_gain`]) + 24) / 48) * 100}%)`,
                }}
                disabled={
                  plugin.params[`band${plugin.params.ui_selectedBand}_type`] ===
                    "highpass" ||
                  plugin.params[`band${plugin.params.ui_selectedBand}_type`] ===
                    "lowpass" ||
                  plugin.params[`band${plugin.params.ui_selectedBand}_type`] ===
                    "notch"
                }
              />
            </div>

            {/* Q */}
            <div className="flex flex-col gap-2 relative">
              <div className="flex justify-between items-baseline">
                <span className="text-[10px] text-[#666] font-bold uppercase tracking-widest">
                  Q
                </span>
                <span className="text-xs font-mono text-white">
                  {Number(
                    plugin.params[`band${plugin.params.ui_selectedBand}_q`],
                  ).toFixed(2)}
                </span>
              </div>
              <input
                type="range"
                min="0.1"
                max="18"
                step="0.1"
                value={Number(
                  plugin.params[`band${plugin.params.ui_selectedBand}_q`],
                )}
                onChange={(e) =>
                  updatePluginParam(
                    plugin.id,
                    `band${plugin.params.ui_selectedBand}_q`,
                    Number(e.target.value),
                  )
                }
                className="w-full h-1 bg-[#333] rounded-full appearance-none outline-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-[#10b981] [&::-webkit-slider-thumb]:rounded-full hover:[&::-webkit-slider-thumb]:scale-125 transition-all"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EQUI;
