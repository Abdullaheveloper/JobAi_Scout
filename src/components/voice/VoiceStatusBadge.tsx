import { cn } from '@/lib/utils';
import { useVoiceState, type VoiceState } from '@/stores/voice-store';

interface VoiceStatusBadgeProps {
  className?: string;
}

const STATE_DETAILS: Record<VoiceState, { label: string; color: string; dotColor: string }> = {
  idle: { label: 'Ready', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20', dotColor: 'bg-emerald-400' },
  listening: { label: 'Listening...', color: 'text-rose-400 bg-rose-500/10 border-rose-500/20 animate-pulse', dotColor: 'bg-rose-400 animate-ping' },
  processing: { label: 'Transcribing...', color: 'text-amber-400 bg-amber-500/10 border-amber-500/20', dotColor: 'bg-amber-400' },
  thinking: { label: 'Searching Knowledge...', color: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20', dotColor: 'bg-indigo-400' },
  speaking: { label: 'Assistant Speaking', color: 'text-blue-400 bg-blue-500/10 border-blue-500/20', dotColor: 'bg-blue-400' },
  error: { label: 'Voice Error', color: 'text-rose-500 bg-rose-500/10 border-rose-500/20', dotColor: 'bg-rose-500' },
  offline: { label: 'Offline', color: 'text-slate-400 bg-slate-500/10 border-slate-500/20', dotColor: 'bg-slate-400' },
};

export function VoiceStatusBadge({ className }: VoiceStatusBadgeProps) {
  const state = useVoiceState();
  const details = STATE_DETAILS[state] || STATE_DETAILS.idle;

  return (
    <span className={cn(
      'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border backdrop-blur-sm transition-all duration-300',
      details.color,
      className
    )}>
      <span className={cn('h-1.5 w-1.5 rounded-full', details.dotColor)} />
      {details.label}
    </span>
  );
}
