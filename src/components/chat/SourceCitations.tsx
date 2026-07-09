import { useState } from 'react';
import { ChevronDown, ChevronUp, ExternalLink, FileText, Globe } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface Source {
  url: string;
  title?: string | null;
  similarity?: number;
  page_number?: number;
  section_heading?: string | null;
  document_type?: string;
}

interface SourceCitationsProps {
  sources: Source[];
  confidence?: number;
  isLowConfidence?: boolean;
}

function ConfidenceBar({ value, isLow }: { value: number; isLow: boolean }) {
  const pct = Math.round(value * 100);
  const color = isLow ? 'bg-amber-400' : pct >= 80 ? 'bg-emerald-400' : 'bg-blue-400';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1 bg-white/10 rounded-full overflow-hidden">
        <div className={cn('h-full rounded-full transition-all', color)} style={{ width: `${pct}%` }} />
      </div>
      <span className={cn('text-xs font-medium', isLow ? 'text-amber-400' : pct >= 80 ? 'text-emerald-400' : 'text-blue-400')}>{pct}%</span>
    </div>
  );
}

export function SourceCitations({ sources, confidence, isLowConfidence }: SourceCitationsProps) {
  const [expanded, setExpanded] = useState(false);
  const uniqueSources = sources.filter((s, i, arr) =>
    arr.findIndex(x => x.url === s.url && x.page_number === s.page_number) === i
  ).slice(0, 5);
  if (uniqueSources.length === 0 && !isLowConfidence) return null;
  return (
    <div className="mt-3 space-y-2">
      {confidence !== undefined && (
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs text-white/40">{isLowConfidence ? '⚠️ General knowledge' : '📚 Knowledge base match'}</span>
            <span className="text-xs text-white/40">Confidence</span>
          </div>
          <ConfidenceBar value={confidence} isLow={isLowConfidence ?? false} />
        </div>
      )}
      {uniqueSources.length > 0 && (
        <div>
          <button onClick={() => setExpanded(v => !v)} className="flex items-center gap-1.5 text-xs text-white/50 hover:text-white/80 transition-colors">
            {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            {uniqueSources.length} source{uniqueSources.length > 1 ? 's' : ''}
          </button>
          {expanded && (
            <div className="mt-2 space-y-2">
              {uniqueSources.map((src, i) => {
                const isFile = !src.url?.startsWith('http');
                const displayTitle = src.title || src.url;
                const pageInfo = src.page_number && src.page_number > 1 ? ` · p.${src.page_number}` : '';
                const headingInfo = src.section_heading ? ` · §${src.section_heading}` : '';
                return (
                  <div key={i} className="bg-white/5 rounded-lg p-2.5 border border-white/10">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        {isFile ? <FileText size={12} className="text-blue-400 flex-shrink-0" /> : <Globe size={12} className="text-green-400 flex-shrink-0" />}
                        <span className="text-xs text-white/70 truncate">{displayTitle}{pageInfo}{headingInfo}</span>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {src.similarity !== undefined && <span className="text-xs text-white/30">{Math.round(src.similarity * 100)}%</span>}
                        {!isFile && <a href={src.url} target="_blank" rel="noopener noreferrer" className="text-white/30 hover:text-white/70"><ExternalLink size={10} /></a>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
