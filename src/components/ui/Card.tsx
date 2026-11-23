import React from 'react';
import { cn } from '../../utils/cn';

export const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
 ({ className, ...props }, ref) => (
 <div
 ref={ref}
 className={cn('rounded-2xl border border-content/5 bg-card/50 p-5 shadow-sm backdrop-blur-sm', className)}
 {...props}
 />
 )
);
Card.displayName = 'Card';
