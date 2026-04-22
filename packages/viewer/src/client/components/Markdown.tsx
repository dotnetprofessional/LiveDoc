import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from '../lib/utils';
import React from 'react';
import { highlightExampleValues } from '../lib/title-utils';

function normalizeLiveDocMarkdown(content: string): string {
  // 1) Convert LiveDoc docString-style blocks ("""\n...\n""") into fenced code blocks.
  //    This is a rendering concern only; the underlying content remains "raw".
  const lines = content.split(/\r?\n/);
  const out: string[] = [];
  let inFence = false;

  for (const line of lines) {
    if (line.trim() === '"""') {
      out.push('```');
      inFence = !inFence;
      continue;
    }

    // 2) Preserve placeholders like <step> outside fences by forcing them into inline-code.
    //    ReactMarkdown treats raw "<tag>" as HTML in markdown contexts; wrapping as code
    //    keeps it literal without displaying entity strings like "&lt;step&gt;".
    out.push(
      inFence
        ? line
        : line.replace(/<([^>\n]+)>/g, (_m, inner: string) => `\`<${inner}>\``)
    );
  }

  // If content was malformed (odd number of fences), close it.
  if (inFence) out.push('```');

  return out.join('\n');
}

export function Markdown({ content, className, highlightValues }: { content?: string; className?: string; highlightValues?: Record<string, string> }) {
  if (!content) return null;

  const normalized = normalizeLiveDocMarkdown(content);

  const hasHighlights = !!highlightValues && Object.keys(highlightValues).length > 0;

  function highlightChildren(children: React.ReactNode): React.ReactNode {
    if (!hasHighlights) return children;

    const values = highlightValues!;

    return React.Children.map(children, (child) => {
      if (typeof child === 'string') {
        return highlightExampleValues(child, values);
      }

      // If this is an element, recursively highlight its children.
      if (React.isValidElement(child)) {
        const childProps = child.props as { children?: React.ReactNode };
        if (childProps?.children === undefined) return child;

        return React.cloneElement(
          child as React.ReactElement<{ children?: React.ReactNode }>,
          { children: highlightChildren(childProps.children) }
        );
      }

      return child;
    });
  }

  return (
    <div className={cn("prose prose-neutral dark:prose-invert max-w-none prose-headings:text-foreground prose-strong:text-foreground prose-code:text-foreground prose-p:text-foreground/90 prose-li:text-foreground/90 prose-ul:text-foreground/90 prose-ol:text-foreground/90", className)}>
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        a: ({ node, children, ...props }) => (
          <a
            {...props}
            className="text-primary hover:underline font-medium decoration-primary/30 underline-offset-4"
            target="_blank"
            rel="noopener noreferrer"
          >
            {highlightChildren(children)}
          </a>
        ),
        p: ({ node, children, ...props }) => (
            <p {...props} className="mb-2 last:mb-0 leading-relaxed">
              {highlightChildren(children)}
            </p>
        ),
        code: ({ node, className, children, ...props }) => {
            // @ts-ignore
            const inline = props.inline

            const codeText = Array.isArray(children)
              ? children.map((c) => (typeof c === 'string' ? c : String(c))).join('')
              : String(children ?? '');

            const codeContent =
              hasHighlights
                ? highlightExampleValues(codeText, highlightValues!)
                : children;

            return !inline ? (
                <code {...props} className={cn("block bg-muted/50 p-3 rounded-md text-xs font-mono text-foreground overflow-x-auto my-2 border border-border", className)}>
                    {codeContent}
                </code>
            ) : (
                <code {...props} className={cn("bg-muted px-1 py-0.5 rounded text-xs font-mono text-foreground border border-border", className)}>
                    {codeContent}
                </code>
            )
        },
        pre: ({ node, ...props }) => (
             <pre {...props} className="bg-transparent p-0 m-0" />
        ),
        img: ({ node, ...props }) => (
          <img {...props} className="rounded-md border border-border my-4 max-h-100 w-auto" />
        ),
        blockquote: ({ node, children, ...props }) => (
            <blockquote {...props} className="border-l-4 border-muted pl-4 italic my-4">
              {highlightChildren(children)}
            </blockquote>
        ),
        ul: ({ node, ...props }) => (
            <ul {...props} className="list-disc pl-5 my-2 space-y-1" />
        ),
        ol: ({ node, ...props }) => (
            <ol {...props} className="list-decimal pl-5 my-2 space-y-1" />
        ),
        li: ({ node, children, ...props }) => (
            <li {...props} className="pl-1">
              {highlightChildren(children)}
            </li>
        ),
      }}
    >
      {normalized}
    </ReactMarkdown>
    </div>
  );
}
