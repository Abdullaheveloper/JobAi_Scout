import { useState, useCallback } from 'react';
import { MessageSquare, Plus, Trash2, Edit2, Check, X, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useChatStore, type Conversation } from '@/stores/chat-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface ConversationListProps {
  onSelect?: (id: string) => void;
  className?: string;
}

function ConversationItem({
  conversation,
  isActive,
  onSelect,
  onDelete,
  onRename,
}: {
  conversation: Conversation;
  isActive: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onRename: (title: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(conversation.title || 'Untitled');

  const handleRename = () => {
    if (editTitle.trim()) onRename(editTitle.trim());
    setEditing(false);
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString();
  };

  return (
    <div
      className={cn(
        'group relative flex items-center gap-2 px-3 py-2.5 rounded-xl cursor-pointer transition-all',
        isActive
          ? 'bg-indigo-600/20 border border-indigo-500/30'
          : 'hover:bg-white/5 border border-transparent'
      )}
      onClick={!editing ? onSelect : undefined}
    >
      <MessageSquare size={14} className={cn('flex-shrink-0', isActive ? 'text-indigo-400' : 'text-white/30')} />

      {editing ? (
        <div className="flex-1 flex items-center gap-1" onClick={e => e.stopPropagation()}>
          <input
            value={editTitle}
            onChange={e => setEditTitle(e.target.value)}
            className="flex-1 bg-white/10 border border-white/20 rounded px-2 py-0.5 text-sm text-white focus:outline-none focus:border-indigo-500 min-w-0"
            autoFocus
            onKeyDown={e => { if (e.key === 'Enter') handleRename(); if (e.key === 'Escape') setEditing(false); }}
          />
          <button onClick={handleRename} className="text-green-400 hover:text-green-300 p-0.5"><Check size={12} /></button>
          <button onClick={() => setEditing(false)} className="text-white/40 hover:text-white/70 p-0.5"><X size={12} /></button>
        </div>
      ) : (
        <div className="flex-1 min-w-0">
          <p className="text-sm text-white/80 truncate">{conversation.title || 'Untitled'}</p>
          <p className="text-xs text-white/25">{formatDate(conversation.created_at)}</p>
        </div>
      )}

      {!editing && (
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
          <button onClick={() => setEditing(true)} className="p-1 text-white/30 hover:text-white/70 rounded transition-colors">
            <Edit2 size={11} />
          </button>
          <button onClick={onDelete} className="p-1 text-white/30 hover:text-rose-400 rounded transition-colors">
            <Trash2 size={11} />
          </button>
        </div>
      )}
    </div>
  );
}

export function ConversationList({ onSelect, className }: ConversationListProps) {
  const store = useChatStore();
  const [search, setSearch] = useState('');

  const filtered = store.conversations.filter(c =>
    !search || (c.title || '').toLowerCase().includes(search.toLowerCase())
  );

  const handleSelect = useCallback((id: string) => {
    store.loadConversation(id);
    onSelect?.(id);
  }, [store, onSelect]);

  const handleDelete = useCallback(async (id: string) => {
    try {
      await store.deleteConversation(id);
    } catch (e) {
      console.error(e);
    }
  }, [store]);

  const handleRename = useCallback((id: string, title: string) => {
    store.renameConversation(id, title);
  }, [store]);

  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* Header */}
      <div className="px-4 py-3 border-b border-white/10">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-white/70 uppercase tracking-wider">Conversations</h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={store.startNewChat}
            className="h-7 w-7 p-0 text-white/50 hover:text-white hover:bg-white/10 rounded-lg"
          >
            <Plus size={14} />
          </Button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/30" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search conversations..."
            className="pl-7 h-7 text-xs bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-indigo-500"
          />
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto py-2 px-2 space-y-0.5 scrollbar-thin scrollbar-thumb-white/10">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <MessageSquare size={24} className="text-white/20 mb-2" />
            <p className="text-xs text-white/30">
              {search ? 'No matching conversations' : 'No conversations yet'}
            </p>
          </div>
        ) : (
          filtered.map(conv => (
            <ConversationItem
              key={conv.id}
              conversation={conv}
              isActive={conv.id === store.activeConversationId}
              onSelect={() => handleSelect(conv.id)}
              onDelete={() => handleDelete(conv.id)}
              onRename={(title) => handleRename(conv.id, title)}
            />
          ))
        )}
      </div>
    </div>
  );
}
