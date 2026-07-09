import { useState } from 'react';
import { Copy, Check, RefreshCw, Trash2, Edit2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MessageActionsProps {
  role: 'user' | 'assistant';
  content: string;
  onRegenerate?: () => void;
  onDelete?: () => void;
  onEdit?: (newContent: string) => void;
  className?: string;
}

export function MessageActions({ role, content, onRegenerate, onDelete, onEdit, className }: MessageActionsProps) {
  const [copied, setCopied] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(content);
  const handleCopy = async () => { await navigator.clipboard.writeText(content); setCopied(true); setTimeout(() => setCopied(false), 2000); };
  const handleEditSubmit = () => { if (editValue.trim() && editValue !== content) onEdit?.(editValue.trim()); setEditing(false); };
  if (editing && role === 'user') {
    return (
      <div className="mt-2 space-y-2">
        <textarea value={editValue} onChange={e => setEditValue(e.target.value)}
          className="w-full bg-white/10 border border-white/20 rounded-xl px-3 py-2 text-sm text-white resize-none focus:outline-none focus:border-indigo-500"
          rows={3} autoFocus
          onKeyDown={e => { if (e.key === 'Escape') setEditing(false); if (e.key === 'Enter' && e.metaKey) handleEditSubmit(); }}
        />
        <div className="flex gap-2">
          <button onClick={handleEditSubmit} className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs rounded-lg transition-colors">Submit</button>
          <button onClick={() => setEditing(false)} className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white text-xs rounded-lg transition-colors">Cancel</button>
        </div>
      </div>
    );
  }
  return (
    <div className={cn('flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity', className)}>
      <button onClick={handleCopy} className="p-1.5 rounded-lg hover:bg-white/10 text-white/40 hover:text-white/80 transition-all" title="Copy">
        {copied ? <Check size={13} /> : <Copy size={13} />}
      </button>
      {role === 'user' && onEdit && (
        <button onClick={() => { setEditValue(content); setEditing(true); }} className="p-1.5 rounded-lg hover:bg-white/10 text-white/40 hover:text-white/80 transition-all" title="Edit">
          <Edit2 size={13} />
        </button>
      )}
      {role === 'assistant' && onRegenerate && (
        <button onClick={onRegenerate} className="p-1.5 rounded-lg hover:bg-white/10 text-white/40 hover:text-white/80 transition-all" title="Regenerate">
          <RefreshCw size={13} />
        </button>
      )}
      {onDelete && (
        <button onClick={onDelete} className="p-1.5 rounded-lg hover:bg-white/10 text-white/40 hover:text-rose-400 transition-all" title="Delete">
          <Trash2 size={13} />
        </button>
      )}
    </div>
  );
}
