import ReactMarkdown from 'react-markdown';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import { Copy, Check } from 'lucide-react';

interface MarkdownRendererProps {
  content: string;
  className?: string;
  streaming?: boolean;
}

function CodeBlock({ children, className }: { children?: React.ReactNode; className?: string }) {
  const [copied, setCopied] = useState(false);
  const code = String(children).replace(/\n$/, '');
  const language = className?.replace('language-', '') || 'text';
  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="relative group my-3 rounded-xl overflow-hidden border border-white/10">
      <div className="flex items-center justify-between px-4 py-2 bg-white/5 border-b border-white/10">
        <span className="text-xs text-white/40 font-mono">{language}</span>
        <button onClick={handleCopy} className="flex items-center gap-1.5 text-xs text-white/40 hover:text-white/80 transition-colors">
          {copied ? <Check size={12} /> : <Copy size={12} />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre className="p-4 overflow-x-auto bg-black/30">
        <code className={cn('text-sm font-mono text-slate-200', className)}>{code}</code>
      </pre>
    </div>
  );
}

export function MarkdownRenderer({ content, className, streaming }: MarkdownRendererProps) {
  return (
    <div className={cn(
      'prose prose-invert prose-sm max-w-none',
      'prose-p:leading-relaxed prose-p:my-1.5',
      'prose-headings:text-white prose-headings:font-semibold',
      'prose-strong:text-white prose-strong:font-semibold',
      'prose-ul:my-2 prose-ol:my-2 prose-li:my-0.5',
      'prose-code:text-indigo-300 prose-code:bg-white/10 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-xs',
      'prose-pre:p-0 prose-pre:bg-transparent prose-pre:my-0',
      'prose-a:text-indigo-400 prose-a:no-underline hover:prose-a:underline',
      className
    )}>
      <ReactMarkdown
        components={{
          code({ className: codeClassName, children, ...props }) {
            const isBlock = !(props as { inline?: boolean }).inline;
            if (isBlock) return <CodeBlock className={codeClassName}>{children}</CodeBlock>;
            return <code className={cn('text-indigo-300 bg-white/10 px-1.5 py-0.5 rounded text-xs font-mono', codeClassName)} {...props}>{children}</code>;
          },
          pre({ children }) { return <>{children}</>; },
          table({ children }) {
            return <div className="overflow-x-auto my-3"><table className="w-full border-collapse text-sm">{children}</table></div>;
          },
          th({ children }) {
            return <th className="px-3 py-2 text-left text-white/80 font-medium border-b border-white/20 bg-white/5">{children}</th>;
          },
          td({ children }) {
            return <td className="px-3 py-2 text-white/70 border-b border-white/10">{children}</td>;
          },
        }}
      >{content}</ReactMarkdown>
      {streaming && <span className="inline-block w-0.5 h-4 bg-indigo-400 animate-pulse ml-0.5 align-middle" />}
    </div>
  );
}
