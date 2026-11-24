import React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../utils/cn';

export const badgeVariants = cva(
  'liquid-pill inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold tracking-wide transition-colors select-none',
  {
    variants: {
      variant: {
        default: 'bg-elevated text-content border border-content/15',
        primary: 'bg-primary-500/18 text-primary-700 dark:text-primary-300 border border-primary-500/30',
        success: 'bg-emerald-500/18 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30',
        warning: 'bg-amber-500/18 text-amber-700 dark:text-amber-300 border border-amber-500/30',
        danger: 'bg-red-500/18 text-red-700 dark:text-red-300 border border-red-500/30',
        info: 'bg-sky-500/18 text-sky-700 dark:text-sky-300 border border-sky-500/30',
        outline: 'border border-content/20 text-muted bg-transparent',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

export type BadgeProps = VariantProps<typeof badgeVariants> & {
  key?: string | number;
  className?: string;
  children?: React.ReactNode;
};

export function Badge({ className, variant, children }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)}>{children}</span>;
}
