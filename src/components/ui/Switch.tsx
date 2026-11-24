import React from 'react';
import { Switch as RadixSwitch } from 'radix-ui';
import { cn } from '../../utils/cn';

export interface SwitchProps
  extends React.ComponentPropsWithoutRef<typeof RadixSwitch.Root> {}

export const Switch = React.forwardRef<
  React.ElementRef<typeof RadixSwitch.Root>,
  SwitchProps
>(({ className, ...props }, ref) => (
  <RadixSwitch.Root
    ref={ref}
    className={cn(
      'peer inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full border border-content/15 backdrop-blur-md transition-all',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 focus-visible:ring-offset-page',
      'disabled:cursor-not-allowed disabled:opacity-50',
      'bg-content/15 data-[state=checked]:bg-primary-500/90 data-[state=checked]:border-white/30 data-[state=checked]:shadow-sm',
      className,
    )}
    {...props}
  >
    <RadixSwitch.Thumb
      className={cn(
        'pointer-events-none block h-5 w-5 rounded-full bg-white shadow-md ring-0 transition-transform duration-150',
        'translate-x-0.5 data-[state=checked]:translate-x-[22px]',
      )}
    />
  </RadixSwitch.Root>
));
Switch.displayName = 'Switch';
