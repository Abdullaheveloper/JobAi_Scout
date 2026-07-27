import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';
import { useVoiceState, type VoiceState } from '@/stores/voice-store';

interface VoiceStatusBadgeProps {
  className?: string;
}

const STATE_STYLE: Record<VoiceState, { color: string; dotColor: string }> = {
  idle: { color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20', dotColor: 'bg-emerald-400' },
  listening: { color: 'text-rose-400 bg-rose-500/10 border-rose-500/20 animate-pulse', dotColor: 'bg-rose-400 animate-ping' },
  processing: { color: 'text-amber-400 bg-amber-500/10 border-amber-500/20', dotColor: 'bg-amber-400' },
  thinking: { color: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20', dotColor: 'bg-indigo-400' },
  speaking: { color: 'text-blue-400 bg-blue-500/10 border-blue-500/20', dotColor: 'bg-blue-400' },
  error: { color: 'text-rose-500 bg-rose-500/10 border-rose-500/20', dotColor: 'bg-rose-500' },
  offline: { color: 'text-slate-400 bg-slate-500/10 border-slate-500/20', dotColor: 'bg-slate-400' },
};

const STATE_LABEL_KEY: Record<VoiceState, string> = {
  idle: 'voice.badge.idle',
  listening: 'voice.badge.listening',
  processing: 'voice.badge.processing',
  thinking: 'voice.badge.thinking',
  speaking: 'voice.badge.speaking',
  error: 'voice.badge.error',
  offline: 'voice.badge.offline',
};

export function VoiceStatusBadge({ className }: VoiceStatusBadgeProps) {
  const { t } = useTranslation();
  const state = useVoiceState();
  const details = STATE_STYLE[state] || STATE_STYLE.idle;
  const labelKey = STATE_LABEL_KEY[state] || STATE_LABEL_KEY.idle;

  return (
    <span className={cn(
      'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border backdrop-blur-sm transition-all duration-300',
      details.color,
      className
    )}>
      <span className={cn('h-1.5 w-1.5 rounded-full', details.dotColor)} />
      {t(labelKey)}
    </span>
  );
}
