
import React, { useEffect, useRef } from 'react';
import { audioService } from '../services/audioEngine';

interface MasterVisualizerProps {
  isPlaying: boolean;
  config?: {
      mode: 'SPECTRUM' | 'WAVEFORM' | 'OFF';
      colorStart: string;
      colorEnd: string;
  };
}

export const MasterVisualizer: React.FC<MasterVisualizerProps> = ({ isPlaying, config = { mode: 'SPECTRUM', colorStart: '#ff7b00', colorEnd: '#ffaa00' } }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const analyser = audioService.getTrackAnalyser('master');
    if (!analyser) return;

    // Use larger FFT for waveform
    analyser.fftSize = 2048;

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    let animationId: number;

    const draw = () => {
      // Get dimensions every frame to handle resize
      const width = canvas.width;
      const height = canvas.height;

      // Background
      ctx.fillStyle = '#111'; // Match Ableton dark
      ctx.fillRect(0, 0, width, height);

      // Grid Lines
      ctx.strokeStyle = '#222';
      ctx.beginPath();
      for(let i=0; i<width; i+=width/10) {
          ctx.moveTo(i, 0);
          ctx.lineTo(i, height);
      }
      ctx.stroke();

      if (config.mode === 'OFF') return;

      ctx.lineWidth = 2;
      const gradient = ctx.createLinearGradient(0, height, 0, 0);
      gradient.addColorStop(0, config.colorStart);
      gradient.addColorStop(1, config.colorEnd);
      
      ctx.strokeStyle = gradient;
      ctx.fillStyle = gradient; // For fill operations if needed

      if (config.mode === 'SPECTRUM') {
          analyser.getByteFrequencyData(dataArray);
          
          ctx.beginPath();
          ctx.moveTo(0, height);

          // Only draw up to ~22kHz (usually the whole buffer in Web Audio)
          // We can skip high frequencies if empty, but standard implementation fits buffer to width
          const barWidth = width / bufferLength * 2.5; 
          let x = 0;

          for(let i = 0; i < bufferLength; i++) {
            const v = dataArray[i] / 255.0;
            const y = height - (v * height);

            ctx.lineTo(x, y);
            x += barWidth;
          }

          ctx.lineTo(width, height);
          ctx.closePath();
          // Spectrum usually looks better filled with low opacity
          ctx.globalAlpha = 0.5;
          ctx.fill();
          ctx.globalAlpha = 1.0;
          ctx.stroke();
          
          // Text Labels
          ctx.fillStyle = '#666';
          ctx.font = '10px monospace';
          ctx.textAlign = 'left';
          ctx.fillText('20Hz', 10, height - 5);
          ctx.textAlign = 'center';
          ctx.fillText('1kHz', width / 2, height - 5);
          ctx.textAlign = 'right';
          ctx.fillText('20kHz', width - 10, height - 5);

      } else if (config.mode === 'WAVEFORM') {
          analyser.getByteTimeDomainData(dataArray);
          
          ctx.beginPath();
          const sliceWidth = width / bufferLength;
          let x = 0;

          for(let i = 0; i < bufferLength; i++) {
              const v = dataArray[i] / 128.0;
              const y = v * height / 2;

              if(i === 0) {
                  ctx.moveTo(x, y);
              } else {
                  ctx.lineTo(x, y);
              }

              x += sliceWidth;
          }
          ctx.lineTo(width, height/2);
          ctx.stroke();
      }

      if (isPlaying) {
          animationId = requestAnimationFrame(draw);
      }
    };

    draw();

    return () => {
      cancelAnimationFrame(animationId);
    };
  }, [isPlaying, config]);

  if (config.mode === 'OFF') return null;

  return (
    <div className="w-full h-full relative rounded-none overflow-hidden border border-[#111] bg-[#111] shadow-none">
       <canvas 
          ref={canvasRef} 
          width={1000} 
          height={200} 
          className="w-full h-full block"
       />
    </div>
  );
};
