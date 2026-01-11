
import React, { useRef, useLayoutEffect } from 'react';
import { AudioClip } from '../types';

interface WaveformProps {
  clip: AudioClip;
  width: number;
  height: number;
  color: string;
}

export const Waveform: React.FC<WaveformProps> = ({ clip, width, height, color }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);
    
    // Get raw audio data (PCM)
    const data = clip.buffer.getChannelData(0);
    const gain = clip.gain;
    
    // Algorithm: Downsample data to fit canvas width
    const step = Math.ceil(data.length / width);
    const amp = height / 2;
    
    for (let i = 0; i < width; i++) {
        let min = 1.0;
        let max = -1.0;
        
        // Find min/max in this chunk
        for (let j = 0; j < step; j++) {
            const datum = data[(i * step) + j];
            if (datum < min) min = datum;
            if (datum > max) max = datum;
        }
        
        // Sanity check for empty chunks
        if (max === -1.0 && min === 1.0) {
            min = 0;
            max = 0;
        }

        // Apply Gain to amplitude
        min *= gain;
        max *= gain;

        // Check for clipping (exceeding -1.0 to 1.0 range)
        const isClipping = max > 1.0 || min < -1.0;
        
        // Set color: Red if clipping, otherwise prop color
        ctx.fillStyle = isClipping ? '#ef4444' : color;

        // Calculate Y positions
        // Audio Range [-1, 1] maps to [0, height] 
        // Note: This simple mapping puts +1 at bottom (height), -1 at top (0)
        // Usually fine for visual symmetry.
        const yLow = (1 + min) * amp;
        const yHigh = (1 + max) * amp;
        
        // Ensure bar has at least 1px height
        const barHeight = Math.max(1, yHigh - yLow);
        
        ctx.fillRect(i, yLow, 1, barHeight);
    }
  }, [clip, width, height, color]);

  return (
    <canvas 
        ref={canvasRef} 
        width={width} 
        height={height} 
        className="w-full h-full pointer-events-none opacity-80"
    />
  );
};
