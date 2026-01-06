import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from '../lib/utils';

export function Markdown({ content, className }: { content?: string; className?: string }) {
  if (!content) return null;

  return (
    <div className={cn("prose prose-neutral dark:prose-invert max-w-none prose-headings:text-foreground prose-strong:text-foreground prose-code:text-foreground prose-p:text-foreground/90 prose-li:text-foreground/90 prose-ul:text-foreground/90 prose-ol:text-foreground/90", className)}>
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        a: ({ node, ...props }) => (
          <a {...props} className="text-primary hover:underline font-medium decoration-primary/30 underline-offset-4" target="_blank" rel="noopener noreferrer" />
        ),
        p: ({ node, ...props }) => (
            <p {...props} className="mb-2 last:mb-0 leading-relaxed" />
        ),
        code: ({ node, className, children, ...props }) => {
            const match = /language-(\w+)/.exec(className || '')
            // @ts-ignore
            const inline = props.inline
            return !inline ? (
                <code {...props} className={cn("block bg-muted/50 p-3 rounded-md text-xs font-mono text-foreground overflow-x-auto my-2 border border-border", className)}>
                    {children}
                </code>
            ) : (
                <code {...props} className={cn("bg-muted px-1 py-0.5 rounded text-xs font-mono text-foreground border border-border", className)}>
                    {children}
                </code>
            )
        },
        pre: ({ node, ...props }) => (
             <pre {...props} className="bg-transparent p-0 m-0" />
        ),
        img: ({ node, ...props }) => (
            <img {...props} className="rounded-md border border-border my-4 max-h-[400px] w-auto" />
        ),
        blockquote: ({ node, ...props }) => (
            <blockquote {...props} className="border-l-4 border-muted pl-4 italic my-4" />
        ),
        ul: ({ node, ...props }) => (
            <ul {...props} className="list-disc pl-5 my-2 space-y-1" />
        ),
        ol: ({ node, ...props }) => (
            <ol {...props} className="list-decimal pl-5 my-2 space-y-1" />
        ),
        li: ({ node, ...props }) => (
            <li {...props} className="pl-1" />
        ),
      }}
    >
      {content}
    </ReactMarkdown>
    </div>
  );
}
