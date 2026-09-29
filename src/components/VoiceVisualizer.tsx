import React, { useEffect, useRef } from 'react';
import { token } from '../utils/theme';

interface VoiceVisualizerProps {
  isListening: boolean;
  isSpeaking: boolean;
  isProcessing: boolean;
  
  micLevel: number;
}

export const VoiceVisualizer: React.FC<VoiceVisualizerProps> = ({
  isListening,
  isSpeaking,
  isProcessing,
  micLevel,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const levelRef = useRef(0);
  const smoothedRef = useRef(0);
  levelRef.current = micLevel;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;
    let phase = 0;

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const width = canvas.width;
      const height = canvas.height;
      const centerY = height / 2;

      ctx.beginPath();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
      ctx.lineWidth = 1;
      ctx.moveTo(0, centerY);
      ctx.lineTo(width, centerY);
      ctx.stroke();

      smoothedRef.current += (levelRef.current - smoothedRef.current) * 0.25;
      const level = Math.min(1, smoothedRef.current * 2.2);

      const barCount = 32;
      const spacing = width / barCount;

      for (let i = 0; i < barCount; i++) {
        const x = i * spacing + spacing / 2;
        let barHeight = 4;

        if (isListening) {
          const freq = (i / barCount) * Math.PI * 4;
          const envelope = Math.abs(Math.sin(freq + phase));
          barHeight = Math.max(4, 4 + envelope * level * 44);
        } else if (isSpeaking) {
          const freq = (i / barCount) * Math.PI * 2.5;
          const amp = Math.sin(freq + phase * 2.0);
          barHeight = Math.max(8, Math.abs(amp) * 32 + 8);
        } else if (isProcessing) {
          const distance = Math.abs(i - barCount / 2);
          const wave = Math.sin(phase * 3 - distance * 0.4);
          barHeight = Math.max(4, wave * 18 + 10);
        } else {
          barHeight = 4 + Math.sin(phase + i * 0.2) * 2;
        }

        ctx.beginPath();
        if (isSpeaking) {
          ctx.strokeStyle = token('--color-accent');
          ctx.shadowColor = token('--color-accent');
          ctx.shadowBlur = 10;
        } else if (isListening) {
          ctx.strokeStyle = token('--color-accent-tint');
          ctx.shadowColor = token('--color-accent');
          ctx.shadowBlur = 12;
        } else if (isProcessing) {
          ctx.strokeStyle = token('--color-accent');
          ctx.shadowColor = token('--color-accent');
          ctx.shadowBlur = 8;
        } else {
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
          ctx.shadowBlur = 0;
        }

        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.moveTo(x, centerY - barHeight / 2);
        ctx.lineTo(x, centerY + barHeight / 2);
        ctx.stroke();
      }

      phase += 0.08;
      animationId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationId);
    };
  }, [isListening, isSpeaking, isProcessing]);

  return (
    <div className="w-full flex items-center justify-center">
      <canvas
        ref={canvasRef}
        width={360}
        height={64}
        className="w-full max-w-[420px] h-14"
      />
    </div>
  );
};
