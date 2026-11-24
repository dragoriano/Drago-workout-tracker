import React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { Slot } from 'radix-ui';
import { cn } from '../../utils/cn';

export const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-2xl font-semibold transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 focus-visible:ring-offset-page disabled:pointer-events-none disabled:opacity-45 active:scale-[0.97] cursor-pointer select-none',
  {
    variants: {
      variant: {
        primary: 'liquid-btn-primary text-white',
        secondary: 'liquid-btn-glass text-content',
        outline: 'liquid-btn-glass text-content',
        ghost: 'text-muted hover:bg-content/10 hover:backdrop-blur-md hover:text-content',
        danger: 'liquid-btn-danger',
        dangerSolid: 'liquid-btn-danger-solid text-white',
        subtle: 'liquid-btn-subtle',
      },
      size: {
        xs: 'h-9 px-3 text-xs rounded-xl',
        sm: 'h-10 px-3.5 text-sm rounded-xl',
        md: 'h-11 px-5 text-sm',
        lg: 'h-13 px-6 text-base',
        icon: 'h-11 w-11 p-0',
        iconSm: 'h-9 w-9 p-0 rounded-xl',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot.Root : 'button';
    return (
      <Comp
        ref={ref}
        className={cn(buttonVariants({ variant, size }), className)}
        {...props}
      />
    );
  },
);
Button.displayName = 'Button';
