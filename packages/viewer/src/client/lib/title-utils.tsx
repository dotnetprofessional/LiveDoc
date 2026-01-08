import React from 'react';

export function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function findMatchingValue(placeholder: string, values: Record<string, string>): string | undefined {
  // Direct match first
  if (values[placeholder] !== undefined) {
    return values[placeholder];
  }
  
  // Normalize: remove spaces, apostrophes, and compare case-insensitively
  const normalize = (s: string) => s.replace(/['\s]/g, '').toLowerCase();
  const normalizedPlaceholder = normalize(placeholder);
  
  for (const [key, value] of Object.entries(values)) {
    if (normalize(key) === normalizedPlaceholder) {
      return value;
    }
  }
  
  return undefined;
}

const HighlightSpan = ({ children }: { children: React.ReactNode }) => (
  // Simple colored text with quotes, similar to text reporter style
  <span className="text-amber-500 dark:text-amber-400 font-medium">
    {children}
  </span>
);

// Highlight placeholders like <Customer's Country> in titles
export function highlightPlaceholders(text: string, values?: Record<string, string>): React.ReactNode {
  const parts = text.split(/(<[^>]+>)/g);
  
  return parts.map((part, index) => {
    if (part.startsWith('<') && part.endsWith('>')) {
      const placeholder = part.slice(1, -1);
      const value = values ? findMatchingValue(placeholder, values) : undefined;
      
      return (
        <HighlightSpan key={index}>
          {value !== undefined ? value : part}
        </HighlightSpan>
      );
    }
    return part;
  });
}

// Highlight values in quotes like 'value' or "value"
export function highlightQuotedValues(text: string, highlightValues?: Record<string, string>): React.ReactNode {
  const parts = text.split(/('[^']+')|("[^"]+")/g).filter(p => p !== undefined);
  
  return parts.map((part, index) => {
    if ((part.startsWith("'") && part.endsWith("'")) || (part.startsWith('"') && part.endsWith('"'))) {
      return (
        <HighlightSpan key={index}>
          {part}
        </HighlightSpan>
      );
    }
    
    // If we have highlightValues, we should still try to highlight them in the non-quoted parts
    if (highlightValues && Object.keys(highlightValues).length > 0) {
      return highlightExampleValues(part, highlightValues);
    }
    
    return part;
  });
}

// Highlight concrete example values in titles
export function highlightExampleValues(text: string, values: Record<string, string>): React.ReactNode {
  const uniqueValues = Array.from(
    new Set(Object.values(values).map((v) => String(v ?? '')).filter((v) => v.length > 0))
  ).sort((a, b) => b.length - a.length);

  if (uniqueValues.length === 0) return text;

  const pattern = new RegExp(`(${uniqueValues.map(escapeRegExp).join('|')})`, 'g');
  const parts = text.split(pattern);

  return parts.map((part, idx) => {
    if (uniqueValues.includes(part)) {
      return (
        <HighlightSpan key={idx}>
          {part}
        </HighlightSpan>
      );
    }
    return part;
  });
}

export function renderTitle(text: string, highlightValues?: Record<string, string>): React.ReactNode {
  // 1. Highlight placeholders like <Customer's Country> or <name:value>
  if (/<[^>]+>/.test(text)) {
    return highlightPlaceholders(text, highlightValues);
  }

  // 2. Highlight quoted values like '10' or "110"
  const quotedPattern = /('[^']+')|("[^"]+")/g;
  if (quotedPattern.test(text)) {
    return highlightQuotedValues(text, highlightValues);
  }

  // 3. Highlight concrete example values
  if (highlightValues && Object.keys(highlightValues).length > 0) {
    return highlightExampleValues(text, highlightValues);
  }

  return text;
}
