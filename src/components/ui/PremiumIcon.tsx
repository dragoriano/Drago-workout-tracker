import React from 'react';
import { cn } from '../../utils/cn';

type IconSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';
type IconVariant = 'ghost' | 'soft' | 'solid' | 'gradient';
type IconAnimation = 'none' | 'pulse' | 'bounce' | 'glow' | 'float';

// Color presets keyed by semantic intent
const COLOR_MAP = {
  primary: {
    ghost: 'text-primary-400',
    soft: 'bg-primary-500/15 text-primary-400',
    solid: 'bg-primary-500 text-white',
    gradient: 'bg-gradient-to-br from-primary-400 to-primary-600 text-white shadow-lg shadow-primary-500/30',
    glow: 'shadow-primary-500/40',
  },
  emerald: {
    ghost: 'text-emerald-400',
    soft: 'bg-emerald-500/15 text-emerald-400',
    solid: 'bg-emerald-500 text-white',
    gradient: 'bg-gradient-to-br from-emerald-400 to-emerald-600 text-white shadow-lg shadow-emerald-500/30',
    glow: 'shadow-emerald-500/40',
  },
  orange: {
    ghost: 'text-orange-400',
    soft: 'bg-orange-500/15 text-orange-400',
    solid: 'bg-orange-500 text-white',
    gradient: 'bg-gradient-to-br from-orange-400 to-orange-600 text-white shadow-lg shadow-orange-500/30',
    glow: 'shadow-orange-500/40',
  },
  red: {
    ghost: 'text-red-400',
    soft: 'bg-red-500/15 text-red-400',
    solid: 'bg-red-500 text-white',
    gradient: 'bg-gradient-to-br from-red-400 to-red-600 text-white shadow-lg shadow-red-500/30',
    glow: 'shadow-red-500/40',
  },
  blue: {
    ghost: 'text-blue-400',
    soft: 'bg-blue-500/15 text-blue-400',
    solid: 'bg-blue-500 text-white',
    gradient: 'bg-gradient-to-br from-blue-400 to-blue-600 text-white shadow-lg shadow-blue-500/30',
    glow: 'shadow-blue-500/40',
  },
  amber: {
    ghost: 'text-amber-400',
    soft: 'bg-amber-500/15 text-amber-400',
    solid: 'bg-amber-500 text-white',
    gradient: 'bg-gradient-to-br from-amber-400 to-amber-600 text-white shadow-lg shadow-amber-500/30',
    glow: 'shadow-amber-500/40',
  },
  yellow: {
    ghost: 'text-yellow-500',
    soft: 'bg-yellow-500/15 text-yellow-500',
    solid: 'bg-yellow-500 text-white',
    gradient: 'bg-gradient-to-br from-yellow-400 to-yellow-600 text-white shadow-lg shadow-yellow-500/30',
    glow: 'shadow-yellow-500/40',
  },
  sky: {
    ghost: 'text-sky-400',
    soft: 'bg-sky-500/15 text-sky-400',
    solid: 'bg-sky-500 text-white',
    gradient: 'bg-gradient-to-br from-sky-400 to-sky-600 text-white shadow-lg shadow-sky-500/30',
    glow: 'shadow-sky-500/40',
  },
  teal: {
    ghost: 'text-teal-400',
    soft: 'bg-teal-500/15 text-teal-400',
    solid: 'bg-teal-500 text-white',
    gradient: 'bg-gradient-to-br from-teal-400 to-teal-600 text-white shadow-lg shadow-teal-500/30',
    glow: 'shadow-teal-500/40',
  },
  rose: {
    ghost: 'text-rose-400',
    soft: 'bg-rose-500/15 text-rose-400',
    solid: 'bg-rose-500 text-white',
    gradient: 'bg-gradient-to-br from-rose-400 to-rose-600 text-white shadow-lg shadow-rose-500/30',
    glow: 'shadow-rose-500/40',
  },
  zinc: {
    ghost: 'text-zinc-400',
    soft: 'bg-zinc-500/15 text-zinc-400',
    solid: 'bg-zinc-600 text-white',
    gradient: 'bg-gradient-to-br from-zinc-500 to-zinc-700 text-white shadow-lg shadow-zinc-500/20',
    glow: 'shadow-zinc-500/20',
  },
} as const;

type IconColor = keyof typeof COLOR_MAP;

const SIZE_MAP: Record<IconSize, { container: string; icon: number }> = {
  xs: { container: 'h-6 w-6 rounded-lg', icon: 12 },
  sm: { container: 'h-8 w-8 rounded-xl', icon: 16 },
  md: { container: 'h-10 w-10 rounded-xl', icon: 20 },
  lg: { container: 'h-12 w-12 rounded-2xl', icon: 24 },
  xl: { container: 'h-14 w-14 rounded-2xl', icon: 28 },
};

const ANIMATION_MAP: Record<IconAnimation, string> = {
  none: '',
  pulse: 'animate-icon-pulse',
  bounce: 'animate-icon-bounce',
  glow: 'animate-icon-glow',
  float: 'animate-icon-float',
};

interface PremiumIconProps {
  icon: React.ElementType;
  size?: IconSize;
  variant?: IconVariant;
  color?: IconColor;
  filled?: boolean;
  animate?: IconAnimation;
  className?: string;
}

/**
 * PremiumIcon — Wraps any Lucide icon with premium container styling,
 * solid/filled rendering, and micro-animations.
 *
 * @example
 * <PremiumIcon icon={Dumbbell} color="orange" variant="gradient" animate="glow" />
 * <PremiumIcon icon={Trophy} color="yellow" variant="soft" size="sm" />
 */
export function PremiumIcon({
  icon: Icon,
  size = 'md',
  variant = 'soft',
  color = 'primary',
  filled = false,
  animate = 'none',
  className,
}: PremiumIconProps) {
  const sizeConfig = SIZE_MAP[size];
  const colorConfig = COLOR_MAP[color];
  const animClass = ANIMATION_MAP[animate];

  const containerClasses = cn(
    'flex items-center justify-center shrink-0 transition-all duration-300',
    sizeConfig.container,
    colorConfig[variant as keyof typeof colorConfig] || colorConfig.soft,
    animate === 'glow' && variant !== 'ghost' && colorConfig.glow,
    animClass,
    className,
  );

  return (
    <div className={containerClasses}>
      <Icon
        size={sizeConfig.icon}
        {...(filled ? { fill: 'currentColor', strokeWidth: 2 } : {})}
      />
    </div>
  );
}

/**
 * Inline filled icon — no container, just applies fill to any Lucide icon
 * for a solid appearance. Use when you DON'T want a background container.
 *
 * @example
 * <FilledIcon icon={Home} size={24} className="text-primary-400" />
 */
export function FilledIcon({
  icon: Icon,
  size = 20,
  className,
  strokeWidth = 2,
}: {
  icon: React.ElementType;
  size?: number;
  className?: string;
  strokeWidth?: number;
}) {
  return (
    <Icon
      size={size}
      strokeWidth={strokeWidth}
      className={cn('transition-all duration-200', className)}
    />
  );
}
