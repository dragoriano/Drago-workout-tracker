import React from 'react';
import { motion } from 'framer-motion';

interface ProgressRingProps {
  value: number;
  max: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
  label?: string;
  unit?: string;
  icon?: React.ReactNode;
}

export function ProgressRing({
  value,
  max,
  size = 90,
  strokeWidth = 6,
  color = 'var(--theme-500)',
  label,
  unit,
  icon,
}: ProgressRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.min(value / Math.max(max, 1), 1);
  const strokeDashoffset = circumference * (1 - progress);

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="currentColor"
            className="text-content/10"
            strokeWidth={strokeWidth}
          />
          <motion.circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset }}
            transition={{ duration: 0.9, ease: 'easeOut' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          {icon && <div className="mb-0.5">{icon}</div>}
          <span className="text-sm font-black text-content leading-none tabular-nums">
            {typeof value === 'number' && value >= 1000
              ? `${(value / 1000).toFixed(1)}k`
              : Math.round(value)}
          </span>
          {unit && <span className="text-[9px] font-bold text-muted uppercase">{unit}</span>}
        </div>
      </div>
      {label && <span className="text-[11px] font-semibold text-muted">{label}</span>}
    </div>
  );
}
