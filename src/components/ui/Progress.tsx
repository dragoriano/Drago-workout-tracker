import React from 'react';
import { Progress as RadixProgress } from 'radix-ui';
import { cn } from '../../utils/cn';

export interface ProgressProps
  extends React.ComponentPropsWithoutRef<typeof RadixProgress.Root> {
  value?: number;
  indicatorClassName?: string;
}

export const Progress = React.forwardRef<
  React.ElementRef<typeof RadixProgress.Root>,
  ProgressProps
>(({ className, value = 0, indicatorClassName, ...props }, ref) => {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <RadixProgress.Root
      ref={ref}
      value={clamped}
      className={cn(
        'relative h-2 w-full overflow-hidden rounded-full border border-content/10 bg-content/10 backdrop-blur-sm',
        className,
      )}
      {...props}
    >
      <RadixProgress.Indicator
        className={cn(
          'h-full w-full flex-1 rounded-full bg-primary-500 shadow-[0_0_10px_color-mix(in_srgb,var(--theme-500)_55%,transparent)] transition-transform duration-300 ease-out',
          indicatorClassName,
        )}
        style={{ transform: `translateX(-${100 - clamped}%)` }}
      />
    </RadixProgress.Root>
  );
});
Progress.displayName = 'Progress';
