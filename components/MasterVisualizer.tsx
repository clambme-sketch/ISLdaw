
import React, { useEffect, useRef } from 'react';
import { audioService } from '../services/audioEngine';

interface MasterVisualizerProps {
  isPlaying: boolean;
}

export const MasterVisualizer: React.FC<MasterVisualizerProps> = ({ isPlaying }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const analyser = audioService.getTrackAnalyser('master');
    if (!analyser) return;

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    let animationId: number;

    const draw = () => {
      // Get dimensions every frame to handle resize
      const width = canvas.width;
      const height = canvas.height;

      analyser.getByteFrequencyData(dataArray);

      // Background
      ctx.fillStyle = '#0f172a'; // Match gray-950
      ctx.fillRect(0, 0, width, height);

      // Grid Lines
      ctx.strokeStyle = '#1e293b';
      ctx.beginPath();
      for(let i=0; i<width; i+=width/10) {
          ctx.moveTo(i, 0);
          ctx.lineTo(i, height);
      }
      ctx.stroke();

      // Spectrum Line
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#3b82f6'; // Blue-500
      ctx.fillStyle = 'rgba(59, 130, 246, 0.2)'; // Blue-500 low opacity

      ctx.beginPath();
      ctx.moveTo(0, height);

      const barWidth = width / bufferLength * 2.5;
      let x = 0;

      for(let i = 0; i < bufferLength; i++) {
        const v = dataArray[i] / 255.0;
        const y = height - (v * height);

        // Smooth curve interpolation could go here, but lineTo is sufficient for this aesthetic
        ctx.lineTo(x, y);

        x += barWidth;
      }

      ctx.lineTo(width, height);
      ctx.closePath();
      ctx.stroke();
      ctx.fill();

      // Text Labels
      ctx.fillStyle = '#64748b';
      ctx.font = '10px monospace';
      ctx.fillText('20Hz', 10, height - 5);
      ctx.fillText('1kHz', width / 2, height - 5);
      ctx.fillText('20kHz', width - 40, height - 5);

      if (isPlaying) {
          animationId = requestAnimationFrame(draw);
      }
    };

    draw();

    return () => {
      cancelAnimationFrame(animationId);
    };
  }, [isPlaying]);

  return (
    <div className="w-full h-full relative rounded-lg overflow-hidden border border-gray-800 bg-gray-950 shadow-inner">
       <canvas 
          ref={canvasRef} 
          width={1000} 
          height={200} 
          className="w-full h-full block"
       />
    </div>
  );
};
