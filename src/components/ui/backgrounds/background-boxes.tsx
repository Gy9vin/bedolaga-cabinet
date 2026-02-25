import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { sanitizeColor, clampNumber } from './types';

interface Props {
  settings: Record<string, unknown>;
}

export default function BackgroundBoxes({ settings }: Props) {
  const rows = clampNumber(settings.rows, 2, 30, 12);
  const cols = clampNumber(settings.cols, 2, 30, 12);
  const boxColor = sanitizeColor(settings.boxColor, '#818cf8');

  const boxes = useMemo(() => {
    const result: { row: number; col: number; color: string }[] = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        result.push({ row: r, col: c, color: boxColor });
      }
    }
    return result;
  }, [rows, cols, boxColor]);

  return (
    <div className="absolute inset-0 overflow-hidden">
      <div
        className="absolute inset-0"
        style={{
          display: 'grid',
          gridTemplateRows: `repeat(${rows}, 1fr)`,
          gridTemplateColumns: `repeat(${cols}, 1fr)`,
          transform: 'skewX(-48deg) skewY(14deg) scale(0.675) translateX(10%)',
          transformOrigin: 'center center',
        }}
      >
        {boxes.map((box, i) => (
          <motion.div
            key={i}
            className="border border-white/5"
            initial={{ opacity: 0 }}
            animate={{
              opacity: [0, 0.08, 0],
            }}
            transition={{
              duration: 3 + Math.random() * 4,
              delay: Math.random() * 5,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
            style={{ backgroundColor: box.color }}
          />
        ))}
      </div>
    </div>
  );
}
