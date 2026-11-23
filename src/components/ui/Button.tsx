import React from 'react';
import { cn } from '../../utils/cn';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
 variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
 size?: 'sm' | 'md' | 'lg' | 'icon';
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
 ({ className, variant = 'primary', size = 'md', ...props }, ref) => {
 return (
 <button
 ref={ref}
 className={cn(
 'inline-flex items-center justify-center rounded-xl font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 disabled:pointer-events-none disabled:opacity-50 active:scale-95',
 {
 'bg-primary-600 text-content hover:bg-primary-700 shadow-sm': variant === 'primary',
 'bg-content/10 text-content border border-content/10 hover:bg-content/20': variant === 'secondary',
 'border border-content/20 bg-transparent hover:bg-zinc-100 dark:bg-elevated text-content': variant === 'outline',
 'hover:bg-zinc-100 dark:bg-elevated text-muted hover:text-content': variant === 'ghost',
 'bg-red-500/10 text-red-500 hover:bg-red-500/20': variant === 'danger',
 'h-9 px-4 text-sm': size === 'sm',
 'h-11 px-6 text-base': size === 'md',
 'h-14 px-8 text-lg': size === 'lg',
 'h-11 w-11': size === 'icon',
 },
 className
 )}
 {...props}
 />
 );
 }
);
Button.displayName = 'Button';
