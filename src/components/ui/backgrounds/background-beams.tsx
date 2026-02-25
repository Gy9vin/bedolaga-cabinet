import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';

interface Props {
  settings: Record<string, unknown>;
}

const paths = [
  'M-380 -189C-380 -189 -312 216 152 343C616 470 684 875 684 875',
  'M-373 -197C-373 -197 -305 208 159 335C623 462 691 867 691 867',
  'M-366 -205C-366 -205 -298 200 166 327C630 454 698 859 698 859',
  'M-359 -213C-359 -213 -291 192 173 319C637 446 705 851 705 851',
  'M-352 -221C-352 -221 -284 184 180 311C644 438 712 843 712 843',
  'M-345 -229C-345 -229 -277 176 187 303C651 430 719 835 719 835',
  'M-338 -237C-338 -237 -270 168 194 295C658 422 726 827 726 827',
  'M-331 -245C-331 -245 -263 160 201 287C665 414 733 819 733 819',
  'M-324 -253C-324 -253 -256 152 208 279C672 406 740 811 740 811',
  'M-317 -261C-317 -261 -249 144 215 271C679 398 747 803 747 803',
];

export default function BackgroundBeams({ settings: _settings }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const handleVisibility = () => {
      if (svgRef.current) {
        svgRef.current.style.display = document.hidden ? 'none' : '';
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);

  return (
    <div className="absolute inset-0 overflow-hidden">
      <svg
        ref={svgRef}
        className="pointer-events-none absolute inset-0 h-full w-full"
        viewBox="0 0 696 316"
        fill="none"
        preserveAspectRatio="xMidYMid slice"
      >
        {paths.map((path, i) => (
          <motion.path
            key={i}
            d={path}
            stroke={`url(#beam-gradient-${i})`}
            strokeWidth="0.5"
            strokeOpacity="0.1"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{
              pathLength: 1,
              opacity: [0, 0.3, 0.6, 0.3, 0],
            }}
            transition={{
              duration: 4 + i * 0.5,
              ease: 'easeInOut',
              repeat: Infinity,
              delay: i * 0.3,
            }}
          />
        ))}
        <defs>
          {paths.map((_, i) => (
            <linearGradient key={i} id={`beam-gradient-${i}`} gradientUnits="userSpaceOnUse">
              <stop stopColor="#18CCFC" stopOpacity="0" />
              <stop stopColor="#18CCFC" />
              <stop offset="0.325" stopColor="#6344F5" />
              <stop offset="1" stopColor="#AE48FF" stopOpacity="0" />
            </linearGradient>
          ))}
        </defs>
      </svg>
    </div>
  );
}
