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
    
    // Draw styles
    ctx.fillStyle = color;
    
    // Get raw audio data (PCM)
    // We usually just use channel 0 for visualization
    const data = clip.buffer.getChannelData(0);
    
    // Algorithm: Downsample data to fit canvas width
    // We want to draw one vertical bar (or point) per pixel of width
    const step = Math.ceil(data.length / width);
    const amp = height / 2;
    
    ctx.beginPath();
    
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

        // Draw a vertical line from min to max amplitude at this x-pixel
        // Center of height is 0 amplitude
        const yLow = (1 + min) * amp;
        const yHigh = (1 + max) * amp;
        
        // Use rect for pixel-perfect bars
        ctx.fillRect(i, yLow, 1, Math.max(1, yHigh - yLow));
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