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
    <div className="relative group my-3 rounded-xl overflow-hidden border border-border">
      <div className="flex items-center justify-between px-4 py-2 bg-muted border-b border-border">
        <span className="text-xs text-muted-foreground font-mono">{language}</span>
        <button onClick={handleCopy} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
          {copied ? <Check size={12} /> : <Copy size={12} />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre className="p-4 overflow-x-auto bg-muted">
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
      'prose-headings:text-foreground prose-headings:font-semibold',
      'prose-strong:text-foreground prose-strong:font-semibold',
      'prose-ul:my-2 prose-ol:my-2 prose-li:my-0.5',
      'prose-code:text-indigo-600 dark:prose-code:text-indigo-300 prose-code:bg-muted prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-xs',
      'prose-pre:p-0 prose-pre:bg-transparent prose-pre:my-0',
      'prose-a:text-indigo-400 prose-a:no-underline hover:prose-a:underline',
      className
    )}>
      <ReactMarkdown
        components={{
          code({ className: codeClassName, children, ...props }) {
            const isBlock = !(props as { inline?: boolean }).inline;
            if (isBlock) return <CodeBlock className={codeClassName}>{children}</CodeBlock>;
            return <code className={cn('text-indigo-600 dark:text-indigo-300 bg-muted px-1.5 py-0.5 rounded text-xs font-mono', codeClassName)} {...props}>{children}</code>;
          },
          pre({ children }) { return <>{children}</>; },
          table({ children }) {
            return <div className="overflow-x-auto my-3"><table className="w-full border-collapse text-sm">{children}</table></div>;
          },
          th({ children }) {
            return <th className="px-3 py-2 text-start text-foreground font-medium border-b border-border bg-muted">{children}</th>;
          },
          td({ children }) {
            return <td className="px-3 py-2 text-muted-foreground border-b border-border">{children}</td>;
          },
        }}
      >{content}</ReactMarkdown>
      {streaming && <span className="inline-block w-0.5 h-4 bg-indigo-400 animate-pulse ms-0.5 align-middle" />}
    </div>
  );
}
