import * as React from 'react';
import { Search, Tag, X } from 'lucide-react';
import type { AnyTest, TestCase } from '@swedevtools/livedoc-schema';
import { cn } from '../lib/utils';
import { useStore } from '../store';
import { formatTagLabel, normalizeTag, subtreeHasMatch } from '../lib/filter-utils';
import { StatusBadge } from './StatusBadge';

function getNodeChildrenForTraversal(node: TestCase | AnyTest): Array<TestCase | AnyTest> {
  const children: Array<TestCase | AnyTest> = [];
  const anyNode = node as any;
  if (anyNode.background) children.push(anyNode.background);
  if (Array.isArray(anyNode.tests)) children.push(...anyNode.tests);
  if (Array.isArray(anyNode.steps)) children.push(...anyNode.steps);
  if (Array.isArray(anyNode.examples)) children.push(...anyNode.examples);
  if (anyNode.template) children.push(anyNode.template);
  return children;
}

function collectKnownTags(nodes: TestCase[]): string[] {
  const set = new Set<string>();
  const stack: Array<TestCase | AnyTest> = [...nodes];
  while (stack.length > 0) {
    const n = stack.pop();
    if (!n) continue;
    const tags = (n as any).tags as unknown;
    if (Array.isArray(tags)) {
      for (const t of tags) {
        const normalized = normalizeTag(String(t));
        if (normalized) set.add(normalized);
      }
    }
    for (const child of getNodeChildrenForTraversal(n)) stack.push(child);
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}

export function GlobalFilter({ className }: { className?: string }) {
  const { getCurrentRun, filterText, filterTags, setFilterText, setFilterTags, navigate } = useStore();
  const run = getCurrentRun();
  const documents = run?.run.documents ?? [];

  const inputRef = React.useRef<HTMLInputElement | null>(null);

  const knownTags = React.useMemo(() => collectKnownTags(documents), [documents]);

  const [inputValue, setInputValue] = React.useState(filterText ?? '');
  const [tagPickerOpen, setTagPickerOpen] = React.useState(false);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = React.useState(0);
  const [hasFocus, setHasFocus] = React.useState(false);

  React.useEffect(() => {
    if (hasFocus) return;
    setInputValue(filterText ?? '');
  }, [filterText, hasFocus]);

  const lastToken = React.useMemo(() => {
    const parts = inputValue.split(/\s+/);
    return parts.length > 0 ? parts[parts.length - 1] : '';
  }, [inputValue]);

  const tagQuery = React.useMemo(() => {
    if (!lastToken.startsWith('@')) return '';
    return lastToken.slice(1).toLowerCase();
  }, [lastToken]);

  const tagSuggestions = React.useMemo(() => {
    if (!lastToken.startsWith('@')) return [];
    const needle = tagQuery;
    return knownTags
      .filter((t) => !filterTags.includes(t))
      .filter((t) => (needle ? t.slice(1).toLowerCase().includes(needle) : true))
      .slice(0, 8);
  }, [knownTags, filterTags, lastToken, tagQuery]);

  const commitTagToken = React.useCallback((tag: string) => {
    const normalized = normalizeTag(tag);
    if (!normalized) return;
    if (!knownTags.includes(normalized)) return;
    if (filterTags.includes(normalized)) return;

    setFilterTags([...filterTags, normalized]);
    setActiveSuggestionIndex(0);
    setTagPickerOpen(false);

    // Remove the last @... token from inputValue, keep the rest as text
    const parts = inputValue.split(/\s+/);
    parts.pop();
    const remainder = parts.join(' ').trim();
    setInputValue(remainder);
    setFilterText(remainder);
  }, [filterTags, inputValue, knownTags, setFilterTags, setFilterText]);

  const removeTagToken = React.useCallback((tag: string) => {
    setFilterTags(filterTags.filter((t) => t !== tag));
  }, [filterTags, setFilterTags]);

  const handleInputChange = React.useCallback((value: string) => {
    setInputValue(value);
    // If user is actively typing @..., don't treat it as text query.
    const trimmed = value.trimEnd();
    const parts = trimmed.split(/\s+/);
    const maybeLast = parts[parts.length - 1] ?? '';
    if (maybeLast.startsWith('@')) {
      setTagPickerOpen(true);
      setActiveSuggestionIndex(0);
      const withoutLast = parts.slice(0, -1).join(' ').trim();
      setFilterText(withoutLast);
      return;
    }
    setTagPickerOpen(false);
    setFilterText(trimmed);
  }, [setFilterText]);

  const handleInputKeyDown = React.useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (tagPickerOpen && tagSuggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveSuggestionIndex((i) => Math.min(i + 1, tagSuggestions.length - 1));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveSuggestionIndex((i) => Math.max(i - 1, 0));
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        commitTagToken(tagSuggestions[activeSuggestionIndex]);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setTagPickerOpen(false);
        return;
      }
    }

    if (e.key === 'Backspace' && inputValue.length === 0 && filterTags.length > 0) {
      removeTagToken(filterTags[filterTags.length - 1]);
    }
  }, [activeSuggestionIndex, commitTagToken, filterTags, inputValue.length, removeTagToken, tagPickerOpen, tagSuggestions]);

  const resultItems = React.useMemo(() => {
    if (!run) return [] as any[];
    const textLower = (filterText ?? '').trim().toLowerCase();
    const hasText = textLower.length > 0;
    const hasTags = filterTags.length > 0;
    if (!hasText && !hasTags) return [];

    const allItems = Object.values(run.itemById ?? {}) as any[];

    return allItems
      .filter((n) => n && typeof n === 'object' && typeof (n as any).kind === 'string')
      .filter((n) => subtreeHasMatch(n as any, textLower, filterTags))
      .slice(0, 8);
  }, [filterTags, filterText, run]);

  const resultsOpen = hasFocus && !tagPickerOpen && resultItems.length > 0;
  const canClear = inputValue.length > 0 || filterTags.length > 0;

  return (
    <div className={cn('relative', className)}>
      <div className="relative">
        <div className="flex items-center gap-2 rounded-full bg-muted/50 px-3 py-2">
          <Search className="w-4 h-4 text-muted-foreground shrink-0" />
          <div className="flex-1 min-w-0 flex flex-wrap gap-1 items-center">
            {filterTags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-[11px] text-foreground"
              >
                <Tag className="w-3 h-3 opacity-60" />
                {formatTagLabel(tag)}
                <button
                  type="button"
                  className="text-muted-foreground hover:text-foreground transition-colors"
                  onClick={() => removeTagToken(tag)}
                  aria-label={`Remove ${tag}`}
                >
                  ×
                </button>
              </span>
            ))}
            <input
              ref={inputRef}
              type="text"
              placeholder="Filter… (type @ to add tag)"
              value={inputValue}
              onChange={(e) => handleInputChange(e.target.value)}
              onKeyDown={handleInputKeyDown}
              onBlur={() => {
                setHasFocus(false);
                // Delay close so click on suggestion still registers.
                window.setTimeout(() => setTagPickerOpen(false), 120);
              }}
              onFocus={() => {
                setHasFocus(true);
                if (lastToken.startsWith('@')) setTagPickerOpen(true);
              }}
              className="flex-1 min-w-30 bg-transparent outline-none text-sm placeholder:text-muted-foreground"
            />
          </div>

          <button
            type="button"
            disabled={!canClear}
            className={cn(
              "shrink-0 rounded-full p-1.5 transition-colors",
              canClear
                ? "text-foreground/80 hover:text-foreground hover:bg-muted/60"
                : "text-muted-foreground/40"
            )}
            aria-label={canClear ? "Clear search" : "Clear search (disabled)"}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              if (!canClear) return;

              if (inputValue.length > 0) {
                // First click clears text, keeps tags.
                setInputValue('');
                setFilterText('');
                setTagPickerOpen(false);
                setActiveSuggestionIndex(0);
                return;
              }

              // Second click (when text already empty) clears tags too.
              setFilterTags([]);
            }}
            title={canClear ? "Clear (text, then tags)" : undefined}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {tagPickerOpen && lastToken.startsWith('@') && (
          <div
            className="absolute z-10 mt-2 w-full rounded-2xl border bg-card shadow-2xl overflow-hidden"
            role="listbox"
            aria-label="Tag suggestions"
          >
            {tagSuggestions.length === 0 ? (
              <div className="px-4 py-3 text-sm text-muted-foreground">No matching tags</div>
            ) : (
              <div className="max-h-60 overflow-auto">
                {tagSuggestions.map((tag, idx) => (
                  <button
                    key={tag}
                    type="button"
                    role="option"
                    aria-selected={idx === activeSuggestionIndex}
                    className={cn(
                      'w-full text-left px-4 py-3 text-sm hover:bg-muted/40 transition-colors',
                      idx === activeSuggestionIndex && 'bg-muted/40'
                    )}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => commitTagToken(tag)}
                  >
                    <span className="inline-flex items-center gap-2">
                      <Tag className="w-3.5 h-3.5 opacity-60" />
                      <span>{formatTagLabel(tag)}</span>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {resultsOpen && (
          <div className="absolute z-10 mt-2 w-full rounded-2xl border bg-card shadow-2xl overflow-hidden">
            <div className="px-4 py-2 text-[10px] font-bold text-muted-foreground uppercase tracking-widest bg-muted/30 border-b">
              Matches
            </div>
            <div className="max-h-96 overflow-auto">
              {resultItems.map((node) => (
                <button
                  key={String((node as any).id)}
                  type="button"
                  className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/40 transition-colors"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    navigate('node', String((node as any).id));
                    setTagPickerOpen(false);
                    setHasFocus(false);
                    window.setTimeout(() => inputRef.current?.blur(), 0);
                  }}
                >
                  <StatusBadge status={(node as any).execution?.status} size="sm" />
                  <div className="min-w-0 flex-1">
                    <div className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/70">
                      {String((node as any).kind ?? '').toLowerCase() || 'spec'}
                    </div>
                    <div className="text-sm font-semibold truncate">
                      {(node as any).title}
                    </div>
                  </div>
                  <div className="text-[10px] font-bold text-muted-foreground/60">
                    {(node as any).execution?.duration ? `${(node as any).execution.duration}ms` : ''}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
