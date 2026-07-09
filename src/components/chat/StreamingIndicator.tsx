import { cn } from '@/lib/utils';

interface StreamingIndicatorProps {
  phase?: 'searching' | 'thinking' | 'generating';
  className?: string;
}

const PHASE_LABELS = {
  searching: 'Searching knowledge base...',
  thinking: 'Thinking...',
  generating: 'Generating response...',
};

export function StreamingIndicator({ phase = 'thinking', className }: StreamingIndicatorProps) {
  return (
    <div className={cn('flex items-center gap-3 py-3', className)}>
      <div className="relative flex-shrink-0">
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center">
          <div className="flex gap-0.5">
            {[0, 1, 2].map(i => (
              <span key={i} className="w-1 h-1 rounded-full bg-white animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
            ))}
          </div>
        </div>
        <div className="absolute inset-0 rounded-full bg-indigo-500/30 animate-ping" />
      </div>
      <div className="space-y-0.5">
        <p className="text-sm text-white/70 animate-pulse">{PHASE_LABELS[phase]}</p>
        {phase === 'searching' && <div className="h-0.5 w-16 bg-gradient-to-r from-indigo-500 to-transparent rounded-full animate-pulse" />}
      </div>
    </div>
  );
}
