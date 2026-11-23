import React from 'react';
import { cn } from '../../utils/cn';

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
 ({ className, type, ...props }, ref) => {
 return (
 <input
 type={type}
 className={cn(
 'flex h-12 w-full rounded-xl border border-content/10 bg-card/50 px-4 py-2 text-base text-zinc-100 placeholder:text-muted focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 disabled:cursor-not-allowed disabled:opacity-50 transition-colors',
 className
 )}
 ref={ref}
 {...props}
 />
 );
 }
);
Input.displayName = 'Input';
