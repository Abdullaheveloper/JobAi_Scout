import { cn } from '@/lib/utils';
import { Bot, User } from 'lucide-react';
import { MarkdownRenderer } from './MarkdownRenderer';
import { SourceCitations } from './SourceCitations';
import { MessageActions } from './MessageActions';
import type { Message } from '@/stores/chat-store';

interface MessageBubbleProps {
  message: Message;
  onRegenerate?: () => void;
  onDelete?: () => void;
  onEdit?: (content: string) => void;
}

function formatTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h ago`;
  return date.toLocaleDateString();
}

export function MessageBubble({ message, onRegenerate, onDelete, onEdit }: MessageBubbleProps) {
  const isUser = message.role === 'user';

  return (
    <div className={cn('group flex gap-3 mb-6', isUser ? 'flex-row-reverse' : 'flex-row')}>
      {/* Avatar */}
      <div className={cn(
        'flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-white shadow-lg',
        isUser
          ? 'bg-gradient-to-br from-indigo-500 to-violet-600'
          : 'bg-gradient-to-br from-slate-700 to-slate-800 border border-white/10'
      )}>
        {isUser ? <User size={14} /> : <Bot size={14} />}
      </div>

      {/* Bubble */}
      <div className={cn('flex flex-col max-w-[80%]', isUser ? 'items-end' : 'items-start')}>
        <div className={cn(
          'relative px-4 py-3 rounded-2xl shadow-sm',
          isUser
            ? 'bg-gradient-to-br from-indigo-600 to-violet-700 text-white rounded-tr-sm'
            : 'bg-white/8 backdrop-blur-sm border border-white/10 text-white/90 rounded-tl-sm'
        )}>
          {isUser ? (
            <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
          ) : (
            <MarkdownRenderer
              content={message.content}
              streaming={message.streaming}
              className="text-sm"
            />
          )}

          {/* Streaming cursor for empty streaming message */}
          {message.streaming && !message.content && (
            <span className="inline-block w-0.5 h-4 bg-indigo-400 animate-pulse" />
          )}
        </div>

        {/* Sources & Confidence (assistant only) */}
        {!isUser && !message.streaming && (message.sources?.length || message.confidence !== undefined) && (
          <div className="w-full px-1">
            <SourceCitations
              sources={message.sources || []}
              confidence={message.confidence}
              isLowConfidence={message.isLowConfidence}
            />
          </div>
        )}

        {/* Timestamp + Actions */}
        <div className={cn('flex items-center gap-2 mt-1 px-1', isUser ? 'flex-row-reverse' : 'flex-row')}>
          <span className="text-xs text-white/25">{formatTime(message.timestamp)}</span>
          {!message.streaming && (
            <MessageActions
              role={message.role}
              content={message.content}
              onRegenerate={onRegenerate}
              onDelete={onDelete}
              onEdit={onEdit}
            />
          )}
        </div>
      </div>
    </div>
  );
}
