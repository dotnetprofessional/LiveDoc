import { useId, useRef } from 'react';
import { ArrowUp, ArrowDown, Search, X, Eraser } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Popover, PopoverTrigger, PopoverContent, PopoverClose } from './ui/popover';
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from './ui/tooltip';
import type { JsonSearch } from '../hooks/useJsonSearch';
import { jsonFieldLocation } from '../lib/json-search';

export function JsonSearchPanel({ search }: { search: JsonSearch }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const statusId = useId();
  const helpId = useId();
  const active = search.hits[search.active];
  const buttonClass = 'h-11 w-11 shrink-0 text-white/80 hover:bg-white/10 hover:text-white focus-visible:ring-sky-400';
  return (
    <Popover open={search.open} onOpenChange={search.setOpen}>
      <TooltipProvider delayDuration={400}>
        <Tooltip>
          <TooltipTrigger asChild onFocus={(event) => event.preventDefault()}>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Search JSON"
                className={buttonClass}>
                <Search aria-hidden="true" />
              </Button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent className="bg-zinc-800 text-white">Search JSON</TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <PopoverContent align="end" sideOffset={8} collisionPadding={12} aria-label="Search JSON"
        className="w-80 max-w-[calc(100vw-1.5rem)] border-white/15 bg-zinc-900 p-3 text-white"
        onOpenAutoFocus={(event) => { event.preventDefault(); inputRef.current?.focus(); }}
        onKeyDown={(event) => {
          event.stopPropagation();
          if (event.key === 'Enter' && !event.nativeEvent.isComposing && event.target === inputRef.current) {
            event.preventDefault();
            search.navigate(event.shiftKey ? -1 : 1);
          }
        }}>
        <div className="flex items-center gap-2">
          <Input ref={inputRef} type="text" aria-label="Search keys and values" placeholder="Search keys and values"
            aria-describedby={`${statusId} ${helpId}`} value={search.query}
            onChange={(event) => search.search(event.target.value)}
            className="h-11 border-white/20 text-white placeholder:text-white/60 focus-visible:ring-sky-400" />
          <PopoverClose asChild>
            <Button variant="ghost" size="icon" aria-label="Close JSON search" title="Close search" className={buttonClass}>
              <X aria-hidden="true" />
            </Button>
          </PopoverClose>
        </div>
        <div className="mt-1 flex items-center justify-between gap-1">
          <span id={statusId} role="status" aria-live="polite" aria-atomic="true"
            className="min-w-0 text-xs tabular-nums text-white/85" title={active ? jsonFieldLocation(active.field) : undefined}>
            {search.query ? active ? `${search.active + 1} of ${search.hits.length}` : 'No matches' : 'Type to search'}
            {active && <span className="sr-only"> · {jsonFieldLocation(active.field)}</span>}
          </span>
          <div className="flex items-center">
            <Button variant="ghost" size="icon" aria-label="Previous JSON match" title="Previous match (Shift+Enter)"
              disabled={!active} onClick={() => search.navigate(-1)} className={buttonClass}>
              <ArrowUp aria-hidden="true" />
            </Button>
            <Button variant="ghost" size="icon" aria-label="Next JSON match" title="Next match (Enter)"
              disabled={!active} onClick={() => search.navigate(1)} className={buttonClass}>
              <ArrowDown aria-hidden="true" />
            </Button>
            <Button variant="ghost" size="icon" aria-label="Clear JSON search" title="Clear search"
              disabled={!search.query} className={buttonClass}
              onClick={() => { search.search(''); inputRef.current?.focus(); }}>
              <Eraser aria-hidden="true" />
            </Button>
          </div>
        </div>
        <p id={helpId} className="text-xs leading-relaxed text-white/65">
          Matching fields · keys and values, including collapsed branches.
        </p>
        {typeof Highlight === 'undefined' && <p className="mt-1 text-xs text-amber-300">
          Update your browser to see text highlights. Match navigation still works.
        </p>}
      </PopoverContent>
    </Popover>
  );
}
