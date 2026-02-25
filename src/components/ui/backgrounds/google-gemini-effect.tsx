import { useEffect, useRef } from 'react';

interface Props {
  settings: Record<string, unknown>;
}

const PATHS = [
  'M0 663C145.5 663 191 666.265 269 647C326.5 630 339.5 621 397.5 566C439 531.5 455 529.5 490 523C509.664 519.348 521 503.736 538 504.236C553.591 504.236 562.429 514.739 584.66 522.749C592.042 525.408 600.2 526.237 607.356 523.019C624.755 515.195 641.446 496.324 657 496.735C673.408 496.735 693.545 519.572 712.903 526.769C718.727 528.934 725.184 528.395 730.902 525.965C751.726 517.115 764.085 497.106 782 496.735',
  'M0 587.5C147 587.5 277 587.5 310 573.5C348 563 392.5 543.5 408 535C434 523.5 426 526.235 479 515.235C494 512.729 523 510.435 534.5 512.735C554.5 516.735 555.5 523.235 576 523.735C592 523.735 616 496.735 633 497.235C648.671 497.235 661.31 515.052 684.774 524.942C692.004 527.989 700.2 528.738 707.349 525.505',
  'M0 514C147.5 514.333 294.5 513.735 380.5 513.735C405.976 514.94 422.849 515.228 436.37 515.123C477.503 514.803 518.631 506.605 559.508 511.197C564.04 511.706 569.162 512.524 575 513.735C588 516.433 616 521.702 627.5 519.402C647.5 515.402 659 499.235 680.5 499.235',
  'M0 438.5C150.5 438.5 261 438.318 323.5 456.5C351 464.5 387.517 484.001 423.5 494.5C447.371 501.465 472 503.735 487 507.735C503.786 512.212 504.5 516.808 523 518.735C547 521.235 564.814 501.235 584.5 501.235',
  'M0.5 364C145.288 362.349 195 361.5 265.5 378C322 391.223 399.182 457.5 411 467.5C424.176 478.649 456.916 491.677 496.259 502.699C498.746 503.396 501.16 504.304 503.511 505.374C517.104 511.558 541.149 520.911 551.5 521.236',
];

const COLORS = ['#FFB7C5', '#FFDDB7', '#B1C5FF', '#4FABFF', '#076EFF'];

export default function GoogleGeminiEffect({ settings }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);

  const speed = (settings.speed as number) ?? 0.003;
  const lineWidth = (settings.lineWidth as number) ?? 2;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let progress = 0;

    const resize = () => {
      canvas.width = canvas.parentElement?.offsetWidth ?? window.innerWidth;
      canvas.height = canvas.parentElement?.offsetHeight ?? window.innerHeight;
    };

    // Parse SVG path to points
    const parsePath = (d: string): { x: number; y: number }[] => {
      const points: { x: number; y: number }[] = [];
      const commands = d.match(/[MC]\s*[\d.\s,-]+/g);
      if (!commands) return points;

      for (const cmd of commands) {
        const nums = cmd
          .slice(1)
          .trim()
          .split(/[\s,]+/)
          .map(Number);
        for (let i = 0; i < nums.length; i += 2) {
          if (!isNaN(nums[i]) && !isNaN(nums[i + 1])) {
            points.push({ x: nums[i], y: nums[i + 1] });
          }
        }
      }
      return points;
    };

    const allPaths = PATHS.map(parsePath);

    const animate = () => {
      progress += speed;
      if (progress > 2) progress = 0;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const scaleX = canvas.width / 1440;
      const scaleY = canvas.height / 890;

      for (let p = 0; p < allPaths.length; p++) {
        const points = allPaths[p];
        if (points.length < 2) continue;

        const pathProgress = Math.max(0, Math.min(1, progress - p * 0.1));
        const drawCount = Math.floor(points.length * pathProgress);

        if (drawCount < 2) continue;

        ctx.beginPath();
        ctx.strokeStyle = COLORS[p % COLORS.length];
        ctx.lineWidth = lineWidth;
        ctx.globalAlpha = 0.6;

        ctx.moveTo(points[0].x * scaleX, points[0].y * scaleY);
        for (let i = 1; i < drawCount; i++) {
          ctx.lineTo(points[i].x * scaleX, points[i].y * scaleY);
        }
        ctx.stroke();
      }

      // Blur pass
      ctx.globalAlpha = 0.3;
      ctx.filter = 'blur(5px)';
      for (let p = 0; p < allPaths.length; p++) {
        const points = allPaths[p];
        if (points.length < 2) continue;

        const pathProgress = Math.max(0, Math.min(1, progress - p * 0.1));
        const drawCount = Math.floor(points.length * pathProgress);

        if (drawCount < 2) continue;

        ctx.beginPath();
        ctx.strokeStyle = COLORS[p % COLORS.length];
        ctx.lineWidth = lineWidth;

        ctx.moveTo(points[0].x * scaleX, points[0].y * scaleY);
        for (let i = 1; i < drawCount; i++) {
          ctx.lineTo(points[i].x * scaleX, points[i].y * scaleY);
        }
        ctx.stroke();
      }

      ctx.filter = 'none';
      ctx.globalAlpha = 1;
      animationRef.current = requestAnimationFrame(animate);
    };

    resize();
    animationRef.current = requestAnimationFrame(animate);
    window.addEventListener('resize', resize);

    return () => {
      cancelAnimationFrame(animationRef.current);
      window.removeEventListener('resize', resize);
    };
  }, [speed, lineWidth]);

  return <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />;
}
