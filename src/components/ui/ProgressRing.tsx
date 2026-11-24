import React, { useEffect, useState } from 'react';

interface ProgressRingProps {
  value: number;
  max: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
  label: string;
  unit?: string;
  icon?: React.ReactNode;
}

export function ProgressRing({ value, max, size = 90, strokeWidth = 6, color = '#818cf8', label, unit, icon }: ProgressRingProps) {
  const [animatedValue, setAnimatedValue] = useState(0);
  
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const percent = max > 0 ? Math.min(animatedValue / max, 1) : 0;
  const dashoffset = circumference * (1 - percent);

  useEffect(() => {
    // Animate from 0 to value
    const timer = setTimeout(() => setAnimatedValue(value), 100);
    return () => clearTimeout(timer);
  }, [value]);

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative" style={{ width: size, height: size }}>
        <svg className="w-full h-full -rotate-90" viewBox={`0 0 ${size} ${size}`}>
          {/* Background track */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="currentColor"
            strokeWidth={strokeWidth}
            fill="none"
            className="text-content/10"
          />
          {/* Progress arc */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={color}
            strokeWidth={strokeWidth}
            fill="none"
            strokeDasharray={circumference}
            strokeDashoffset={dashoffset}
            strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 1.2s cubic-bezier(0.4, 0, 0.2, 1)' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {icon && <div className="mb-0.5" style={{ color }}>{icon}</div>}
          <span className="text-lg font-black text-content leading-none">{value}</span>
          {unit && <span className="text-[8px] font-bold uppercase tracking-widest text-muted">{unit}</span>}
        </div>
      </div>
      <span className="text-[10px] font-bold uppercase tracking-wider text-muted text-center leading-tight">{label}</span>
    </div>
  );
}
