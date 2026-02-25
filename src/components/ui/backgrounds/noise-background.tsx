import { useEffect, useRef } from 'react';
import { sanitizeColor, clampNumber } from './types';

interface Props {
  settings: Record<string, unknown>;
}

export default function NoiseBackground({ settings }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const noiseOpacity = clampNumber(settings.noiseOpacity, 0.01, 1, 0.15);
  const baseColor = sanitizeColor(settings.baseColor, '#0a0a1a');
  const animated = (settings.animated as boolean) ?? false;
  const animationRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const size = 128;
    canvas.width = size;
    canvas.height = size;

    const drawNoise = () => {
      const imageData = ctx.createImageData(size, size);
      const data = imageData.data;

      for (let i = 0; i < data.length; i += 4) {
        const v = Math.random() * 255;
        data[i] = v;
        data[i + 1] = v;
        data[i + 2] = v;
        data[i + 3] = 255;
      }

      ctx.putImageData(imageData, 0, 0);
    };

    drawNoise();

    if (animated) {
      const loop = () => {
        drawNoise();
        animationRef.current = requestAnimationFrame(loop);
      };
      animationRef.current = requestAnimationFrame(loop);
    }

    return () => {
      if (animated) cancelAnimationFrame(animationRef.current);
    };
  }, [animated]);

  return (
    <div className="absolute inset-0" style={{ backgroundColor: baseColor }}>
      <canvas
        ref={canvasRef}
        className="absolute inset-0 h-full w-full"
        style={{
          opacity: noiseOpacity,
          imageRendering: 'pixelated',
          mixBlendMode: 'overlay',
        }}
      />
    </div>
  );
}
