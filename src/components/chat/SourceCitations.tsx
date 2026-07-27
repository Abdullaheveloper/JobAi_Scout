import { useState } from 'react';
import { ChevronDown, ChevronUp, ExternalLink, FileText, Globe } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Source {
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
      <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden">
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
            <span className="text-xs text-muted-foreground">{isLowConfidence ? '⚠️ General knowledge' : '📚 Knowledge base match'}</span>
            <span className="text-xs text-muted-foreground">Confidence</span>
          </div>
          <ConfidenceBar value={confidence} isLow={isLowConfidence ?? false} />
        </div>
      )}
      {uniqueSources.length > 0 && (
        <div>
          <button onClick={() => setExpanded(v => !v)} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
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
                  <div key={i} className="bg-muted rounded-lg p-2.5 border border-border">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        {isFile ? <FileText size={12} className="text-blue-400 flex-shrink-0" /> : <Globe size={12} className="text-green-400 flex-shrink-0" />}
                        <span className="text-xs text-muted-foreground truncate">{displayTitle}{pageInfo}{headingInfo}</span>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {src.similarity !== undefined && <span className="text-xs text-muted-foreground">{Math.round(src.similarity * 100)}%</span>}
                        {!isFile && <a href={src.url} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground"><ExternalLink size={10} /></a>}
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
