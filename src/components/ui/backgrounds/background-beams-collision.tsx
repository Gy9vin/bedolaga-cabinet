import { useRef, useEffect, useState } from 'react';
import { motion } from 'framer-motion';

interface Props {
  settings: Record<string, unknown>;
}

interface Beam {
  id: number;
  x: number;
  duration: number;
  delay: number;
  rotate: number;
}

export default function BackgroundBeamsCollision({ settings: _settings }: Props) {
  const [beams, setBeams] = useState<Beam[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const w = containerRef.current?.offsetWidth ?? window.innerWidth;
    const count = Math.floor(w / 100);
    setBeams(
      Array.from({ length: count }, (_, i) => ({
        id: i,
        x: (i / count) * 100 + Math.random() * 10,
        duration: 4 + Math.random() * 8,
        delay: Math.random() * 4,
        rotate: -5 + Math.random() * 10,
      })),
    );
  }, []);

  return (
    <div ref={containerRef} className="absolute inset-0 overflow-hidden">
      {beams.map((beam) => (
        <motion.div
          key={beam.id}
          className="absolute top-0 h-full w-px"
          style={{ left: `${beam.x}%`, rotate: `${beam.rotate}deg` }}
          initial={{ y: '-100%', opacity: 0 }}
          animate={{ y: '200%', opacity: [0, 1, 1, 0] }}
          transition={{
            duration: beam.duration,
            delay: beam.delay,
            repeat: Infinity,
            ease: 'linear',
          }}
        >
          <div
            className="h-32 w-px"
            style={{
              background:
                'linear-gradient(180deg, transparent, rgba(var(--color-accent-500), 0.5), rgba(var(--color-accent-400), 0.8), transparent)',
            }}
          />
        </motion.div>
      ))}
      {/* Bottom collision line */}
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-accent-500/20 to-transparent" />
    </div>
  );
}
