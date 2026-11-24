import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { cn } from '../../utils/cn';

interface PullToRefreshProps {
  onRefresh: () => Promise<void>;
  children: React.ReactNode;
  className?: string;
}

export function PullToRefresh({ onRefresh, children, className }: PullToRefreshProps) {
  const [startY, setStartY] = useState(0);
  const [currentY, setCurrentY] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isPulling, setIsPulling] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const pullDistance = Math.max(0, currentY - startY);
  const maxPull = 100;
  const triggerDistance = 60;
  
  // Resistance factor: the further you pull, the harder it gets
  const dampedPull = pullDistance > 0 ? (Math.log(pullDistance + 1) * 15) : 0;
  const boundedPull = Math.min(dampedPull, maxPull);

  useEffect(() => {
    const getScrollParent = (el: HTMLElement | null): HTMLElement | null => {
      if (!el) return null;
      let parent = el.parentElement;
      while (parent) {
        const style = getComputedStyle(parent);
        if (style.overflowY === 'auto' || style.overflowY === 'scroll') return parent;
        parent = parent.parentElement;
      }
      return document.documentElement;
    };

    const handleTouchStart = (e: TouchEvent) => {
      const scrollParent = getScrollParent(containerRef.current);
      if (scrollParent && scrollParent.scrollTop <= 0) {
        setStartY(e.touches[0].clientY);
        setIsPulling(true);
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isPulling || isRefreshing) return;
      const y = e.touches[0].clientY;
      if (y > startY) {
        // Prevent default scrolling when pulling down at the top
        if (e.cancelable) e.preventDefault();
        setCurrentY(y);
      }
    };

    const handleTouchEnd = async () => {
      if (!isPulling) return;
      setIsPulling(false);
      
      if (boundedPull >= triggerDistance && !isRefreshing) {
        setIsRefreshing(true);
        try {
          await onRefresh();
        } finally {
          setIsRefreshing(false);
          setStartY(0);
          setCurrentY(0);
        }
      } else {
        setStartY(0);
        setCurrentY(0);
      }
    };

    const element = containerRef.current;
    if (element) {
      // { passive: false } is needed to allow preventDefault() inside touchmove
      const touchStartOpts: AddEventListenerOptions = { passive: true };
      const touchMoveOpts: AddEventListenerOptions = { passive: false };
      const touchEndOpts: AddEventListenerOptions = { passive: true };
      element.addEventListener('touchstart', handleTouchStart, touchStartOpts);
      element.addEventListener('touchmove', handleTouchMove, touchMoveOpts);
      element.addEventListener('touchend', handleTouchEnd, touchEndOpts);
      return () => {
        element.removeEventListener('touchstart', handleTouchStart, touchStartOpts);
        element.removeEventListener('touchmove', handleTouchMove, touchMoveOpts);
        element.removeEventListener('touchend', handleTouchEnd, touchEndOpts);
      };
    }
  }, [isPulling, startY, isRefreshing, onRefresh, boundedPull]);

  return (
    <div 
      ref={containerRef} 
      className={cn("w-full relative", className)}
    >
      <div className="absolute top-0 left-0 right-0 flex justify-center pointer-events-none z-50">
        <AnimatePresence>
          {(isPulling || isRefreshing) && boundedPull > 0 && (
            <motion.div
              initial={{ y: -50, opacity: 0 }}
              animate={{ 
                y: isRefreshing ? 20 : boundedPull - 50,
                opacity: Math.min(boundedPull / triggerDistance, 1)
              }}
              exit={{ y: -50, opacity: 0 }}
              transition={{ 
                type: isRefreshing ? 'spring' : 'tween',
                duration: isRefreshing ? 0.3 : 0
              }}
              className="liquid-glass-strong rounded-full p-2 mt-2 flex items-center justify-center text-primary-400"
            >
              <Loader2 
                size={24}className={cn(isRefreshing ? "animate-spin" : "")} 
                style={{ transform: !isRefreshing ? `rotate(${boundedPull * 2}deg)` : undefined }} 
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <div 
        className="transition-transform duration-300 ease-out min-h-full"
        style={{ transform: (isPulling && !isRefreshing) ? `translateY(${boundedPull}px)` : 'none' }}
      >
        {children}
      </div>
    </div>
  );
}
