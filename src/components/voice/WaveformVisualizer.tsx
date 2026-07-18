import React, { useEffect, useRef } from 'react';
import { useReducedMotion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface WaveformVisualizerProps {
  volume: number;      // 0 to 1
  isActive: boolean;
  color?: 'indigo' | 'rose' | 'emerald';
  barCount?: number;
}

export function WaveformVisualizer({
  volume,
  isActive,
  color = 'indigo',
  barCount = 32,
}: WaveformVisualizerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    let animId: number;
    
    const updateBars = () => {
      if (containerRef.current) {
        const bars = containerRef.current.children;
        for (let i = 0; i < bars.length; i++) {
          const bar = bars[i] as HTMLDivElement;
          if (isActive) {
            // Generate some random noise blended with the actual volume input
            const factor = reducedMotion ? 0.2 : Math.abs(Math.sin(Date.now() / 150 + i * 0.3));
            const level = volume * 0.7 + factor * 0.3;
            // Map 0-1 to height 4px to 64px
            const height = 4 + level * 60;
            bar.style.height = `${height}px`;
          } else {
            bar.style.height = '4px';
          }
        }
      }
      if (!reducedMotion) animId = requestAnimationFrame(updateBars);
    };

    animId = requestAnimationFrame(updateBars);
    return () => cancelAnimationFrame(animId);
  }, [isActive, volume, reducedMotion]);

  const colorClasses = {
    indigo: 'bg-gradient-to-t from-indigo-500 via-indigo-400 to-violet-500',
    rose: 'bg-gradient-to-t from-rose-500 via-rose-400 to-pink-500',
    emerald: 'bg-gradient-to-t from-emerald-500 via-emerald-400 to-teal-500',
  };

  return (
    <div
      ref={containerRef}
      aria-hidden="true"
      className="flex items-center justify-center gap-1 h-20 w-full px-4 overflow-hidden"
    >
      {Array.from({ length: barCount }).map((_, i) => (
        <div
          key={i}
          className={cn(
            'w-1 rounded-full min-h-[4px] transition-all duration-75',
            isActive ? colorClasses[color] : 'bg-white/10'
          )}
          style={{ height: '4px' }}
        />
      ))}
    </div>
  );
}
