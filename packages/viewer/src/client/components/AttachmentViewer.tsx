import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, ChevronLeft, ChevronRight, Copy, Check,
  FileText, FileCode, FileJson, Download, AlertTriangle,
  Play, Pause, CheckCircle2, XCircle, AlertCircle, HelpCircle,
} from 'lucide-react';
import type { Status } from '@swedevtools/livedoc-schema';
import { cn } from '../lib/utils';
import { Button } from './ui/button';
import { groupByStep, findGroupAtIndex, jumpToAdjacentGroup } from '../utils/gallery';
import type { GalleryItem, StepGroup } from '../utils/gallery';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AttachmentItem {
  base64?: string;
  uri?: string;
  title?: string;
  mimeType?: string;
  kind?: string;
  // Optional step context for scenario-level galleries
  stepTitle?: string;
  stepKeyword?: string;
  stepStatus?: Status;
  stepIndex?: number;
}

export interface AttachmentViewerProps {
  attachments: AttachmentItem[];
  initialIndex?: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// ---------------------------------------------------------------------------
// MIME helpers
// ---------------------------------------------------------------------------

function isImageMime(mime: string): boolean {
  return mime.startsWith('image/');
}

function isJsonMime(mime: string): boolean {
  return mime === 'application/json' || mime === 'application/ld+json';
}

function isTextMime(mime: string): boolean {
  return mime.startsWith('text/');
}

type ContentCategory = 'image' | 'json' | 'text' | 'binary';

function categorize(item: AttachmentItem): ContentCategory {
  const mime = (item.mimeType || '').toLowerCase();
  if (isImageMime(mime)) return 'image';
  if (isJsonMime(mime)) return 'json';
  if (isTextMime(mime)) return 'text';
  return 'binary';
}

/** Short label for a MIME type (shown in badges). */
function mimeLabel(mime: string | undefined): string {
  if (!mime) return 'file';
  if (isImageMime(mime)) return mime.replace('image/', '').toUpperCase();
  if (isJsonMime(mime)) return 'JSON';
  if (isTextMime(mime)) return mime.replace('text/', '').toUpperCase() || 'TEXT';
  return mime.split('/').pop()?.toUpperCase() || 'FILE';
}

/** Decode a base64 string into UTF-8 text. */
function decodeBase64(b64: string): string {
  try {
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    return new TextDecoder('utf-8').decode(bytes);
  } catch {
    return b64;
  }
}

/** Estimate human-readable file size from base64 length. */
function estimateSize(b64: string | undefined): string {
  if (!b64) return 'Unknown size';
  const bytes = Math.ceil((b64.length * 3) / 4);
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ---------------------------------------------------------------------------
// Copy-to-clipboard hook
// ---------------------------------------------------------------------------

function useCopyToClipboard() {
  const [copied, setCopied] = useState(false);

  const copy = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }, []);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(t);
  }, [copied]);

  return { copied, copy };
}

// ---------------------------------------------------------------------------
// JSON Syntax Highlighter
// ---------------------------------------------------------------------------

interface JsonHighlightProps {
  text: string;
}

function JsonHighlight({ text }: JsonHighlightProps) {
  const tokens = useMemo(() => tokenizeJson(text), [text]);
  return (
    <code>
      {tokens.map((tok, i) => (
        <span key={i} className={tok.className}>{tok.text}</span>
      ))}
    </code>
  );
}

interface Token {
  text: string;
  className: string;
}

function tokenizeJson(json: string): Token[] {
  const tokens: Token[] = [];
  const regex = /("(?:[^"\\]|\\.)*")\s*:|("(?:[^"\\]|\\.)*")|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\b|(true|false)\b|(null)\b|([{}[\]:,])|(\s+)/g;
  let match;
  let lastIndex = 0;

  while ((match = regex.exec(json)) !== null) {
    if (match.index > lastIndex) {
      tokens.push({ text: json.slice(lastIndex, match.index), className: '' });
    }
    lastIndex = regex.lastIndex;

    if (match[1] !== undefined) {
      tokens.push({ text: match[1], className: 'text-sky-300' });
    } else if (match[2] !== undefined) {
      tokens.push({ text: match[2], className: 'text-emerald-300' });
    } else if (match[3] !== undefined) {
      tokens.push({ text: match[3], className: 'text-amber-300' });
    } else if (match[4] !== undefined) {
      tokens.push({ text: match[4], className: 'text-violet-300' });
    } else if (match[5] !== undefined) {
      tokens.push({ text: match[5], className: 'text-rose-300/70 italic' });
    } else if (match[6] !== undefined) {
      tokens.push({ text: match[6], className: 'text-zinc-400' });
    } else if (match[7] !== undefined) {
      tokens.push({ text: match[7], className: '' });
    }
  }

  if (lastIndex < json.length) {
    tokens.push({ text: json.slice(lastIndex), className: '' });
  }

  return tokens;
}

// ---------------------------------------------------------------------------
// Slide animation variants (direction-aware)
// ---------------------------------------------------------------------------

const slideVariants = {
  enter: (dir: number) => ({
    x: dir > 0 ? 80 : -80,
    opacity: 0,
    scale: 0.97,
  }),
  center: {
    x: 0,
    opacity: 1,
    scale: 1,
  },
  exit: (dir: number) => ({
    x: dir > 0 ? -80 : 80,
    opacity: 0,
    scale: 0.97,
  }),
};

const slideTransition = { duration: 0.28, ease: [0.25, 0.46, 0.45, 0.94] as const };

// Step-boundary crossing variants (fade + dim)
const stepCrossFadeVariants = {
  enter: {
    opacity: 0,
    filter: 'brightness(0.7)',
  },
  center: {
    opacity: 1,
    filter: 'brightness(1)',
  },
  exit: {
    opacity: 0,
    filter: 'brightness(0.7)',
  },
};

const stepCrossFadeTransition = { duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] as const };

// ---------------------------------------------------------------------------
// Step Context Bar (for scenario galleries)
// ---------------------------------------------------------------------------

interface StepContextBarProps {
  item: AttachmentItem;
  currentIndex: number;
  total: number;
  groups?: StepGroup[];
}

function StepContextBar({ item, currentIndex, total, groups }: StepContextBarProps) {
  const stepTitle = item.stepTitle;
  const stepKeyword = item.stepKeyword;
  const stepStatus = item.stepStatus;
  const stepIndex = item.stepIndex;

  if (!stepTitle || !stepKeyword || stepIndex === undefined) return null;

  const currentGroup = groups ? findGroupAtIndex(groups, currentIndex) : null;
  const totalSteps = groups?.length ?? 1;
  const displayStepNumber = (currentGroup?.stepIndex ?? stepIndex) + 1;

  const keywordColors: Record<string, string> = {
    given: 'text-sky-400',
    when: 'text-amber-400',
    then: 'text-emerald-400',
    and: 'text-white/50',
    but: 'text-rose-400',
  };

  const statusIcons: Record<Status, React.ReactElement> = {
    passed: <CheckCircle2 className="w-3.5 h-3.5 text-pass" />,
    failed: <XCircle className="w-3.5 h-3.5 text-fail" />,
    pending: <AlertCircle className="w-3.5 h-3.5 text-pending" />,
    running: <AlertCircle className="w-3.5 h-3.5 text-sky-400 animate-pulse" />,
    skipped: <HelpCircle className="w-3.5 h-3.5 text-muted-foreground/40" />,
    timedOut: <XCircle className="w-3.5 h-3.5 text-fail" />,
    cancelled: <HelpCircle className="w-3.5 h-3.5 text-muted-foreground/40" />,
  };

  return (
    <motion.div
      className={cn(
        "mx-auto mb-4 px-4 py-2.5 rounded-lg",
        "bg-white/[0.03] backdrop-blur-md border border-white/[0.08]",
        "flex items-center gap-3 max-w-4xl"
      )}
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.25 }}
      key={`step-context-${stepIndex}`}
    >
      <span className="text-xs font-medium text-white/40 tabular-nums shrink-0">
        Step {displayStepNumber} of {totalSteps}
      </span>
      <div className="h-4 w-px bg-white/10" />
      <span className={cn('text-sm font-semibold capitalize shrink-0', keywordColors[stepKeyword.toLowerCase()] || 'text-white/50')}>
        {stepKeyword}
      </span>
      <span className="text-sm text-white/70 truncate flex-1 min-w-0">
        {stepTitle}
      </span>
      {stepStatus && (
        <div className="shrink-0">
          {statusIcons[stepStatus]}
        </div>
      )}
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Sub-renderers (polished)
// ---------------------------------------------------------------------------

function ImageRenderer({ 
  item, 
  index, 
  direction,
  crossingStepBoundary 
}: { 
  item: AttachmentItem; 
  index: number; 
  direction: number;
  crossingStepBoundary: boolean;
}) {
  const src = item.base64
    ? `data:${item.mimeType || 'image/png'};base64,${item.base64}`
    : item.uri ?? '';

  const variants = crossingStepBoundary ? stepCrossFadeVariants : slideVariants;
  const transition = crossingStepBoundary ? stepCrossFadeTransition : slideTransition;

  return (
    <motion.img
      key={`img-${index}`}
      src={src}
      alt={item.title || `Image ${index + 1}`}
      className={cn(
        "max-w-full max-h-full object-contain rounded-lg",
        "shadow-[0_8px_40px_rgb(0,0,0,0.5)] ring-1 ring-white/[0.08]"
      )}
      custom={direction}
      variants={variants}
      initial="enter"
      animate="center"
      exit="exit"
      transition={transition}
      draggable={false}
    />
  );
}

function JsonRenderer({ item, direction, crossingStepBoundary }: { item: AttachmentItem; direction: number; crossingStepBoundary: boolean }) {
  const { copied, copy } = useCopyToClipboard();

  const { formatted, error } = useMemo(() => {
    if (!item.base64) return { formatted: '', error: 'No data available' };
    const raw = decodeBase64(item.base64);
    try {
      const obj = JSON.parse(raw);
      return { formatted: JSON.stringify(obj, null, 2), error: null };
    } catch {
      return { formatted: raw, error: 'Invalid JSON — showing raw content' };
    }
  }, [item.base64]);

  const variants = crossingStepBoundary ? stepCrossFadeVariants : slideVariants;
  const transition = crossingStepBoundary ? stepCrossFadeTransition : slideTransition;

  return (
    <motion.div
      className={cn(
        "relative w-full max-w-4xl flex flex-col rounded-xl overflow-hidden",
        "shadow-[0_8px_40px_rgb(0,0,0,0.5)] ring-1 ring-white/[0.08]",
        "max-h-[calc(100vh-12rem)]"
      )}
      custom={direction}
      variants={variants}
      initial="enter"
      animate="center"
      exit="exit"
      transition={transition}
    >
      <div className="flex items-center justify-between px-4 py-2.5 bg-zinc-800/95 border-b border-white/[0.06]">
        <div className="flex items-center gap-2">
          <FileJson className="w-4 h-4 text-sky-400" />
          <span className="text-xs font-medium text-white/50">
            {item.mimeType || 'application/json'}
          </span>
          {error && (
            <span className="flex items-center gap-1 text-[10px] text-amber-400/90 font-medium">
              <AlertTriangle className="w-3 h-3" />
              {error}
            </span>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => copy(formatted)}
          className="h-7 px-2.5 text-white/50 hover:text-white hover:bg-white/10"
        >
          {copied
            ? <><Check className="w-3.5 h-3.5 text-emerald-400" /><span className="text-[11px]">Copied</span></>
            : <><Copy className="w-3.5 h-3.5" /><span className="text-[11px]">Copy</span></>
          }
        </Button>
      </div>

      <div className="flex-1 overflow-auto bg-zinc-900/95 p-4">
        <pre className="text-[13px] leading-relaxed font-mono whitespace-pre">
          {error && !formatted.startsWith('{') && !formatted.startsWith('[')
            ? <span className="text-zinc-300">{formatted}</span>
            : <JsonHighlight text={formatted} />
          }
        </pre>
      </div>
    </motion.div>
  );
}

function TextRenderer({ item, direction, crossingStepBoundary }: { item: AttachmentItem; direction: number; crossingStepBoundary: boolean }) {
  const { copied, copy } = useCopyToClipboard();

  const text = useMemo(() => {
    if (!item.base64) return '';
    return decodeBase64(item.base64);
  }, [item.base64]);

  const variants = crossingStepBoundary ? stepCrossFadeVariants : slideVariants;
  const transition = crossingStepBoundary ? stepCrossFadeTransition : slideTransition;

  return (
    <motion.div
      className={cn(
        "relative w-full max-w-4xl flex flex-col rounded-xl overflow-hidden",
        "shadow-[0_8px_40px_rgb(0,0,0,0.5)] ring-1 ring-white/[0.08]",
        "max-h-[calc(100vh-12rem)]"
      )}
      custom={direction}
      variants={variants}
      initial="enter"
      animate="center"
      exit="exit"
      transition={transition}
    >
      <div className="flex items-center justify-between px-4 py-2.5 bg-zinc-800/95 border-b border-white/[0.06]">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-zinc-400" />
          <span className="text-xs font-medium text-white/50">
            {item.mimeType || 'text/plain'}
          </span>
          <span className="text-[10px] text-white/30">
            {estimateSize(item.base64)}
          </span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => copy(text)}
          className="h-7 px-2.5 text-white/50 hover:text-white hover:bg-white/10"
        >
          {copied
            ? <><Check className="w-3.5 h-3.5 text-emerald-400" /><span className="text-[11px]">Copied</span></>
            : <><Copy className="w-3.5 h-3.5" /><span className="text-[11px]">Copy</span></>
          }
        </Button>
      </div>

      <div className="flex-1 overflow-auto bg-zinc-900/95 p-4">
        <pre className="text-[13px] leading-relaxed font-mono text-zinc-300 whitespace-pre">
          {text}
        </pre>
      </div>
    </motion.div>
  );
}

function BinaryFallback({ item, direction, crossingStepBoundary }: { item: AttachmentItem; direction: number; crossingStepBoundary: boolean }) {
  const { copied, copy } = useCopyToClipboard();

  const handleDownload = useCallback(() => {
    if (!item.base64) return;
    const mime = item.mimeType || 'application/octet-stream';
    const link = document.createElement('a');
    link.href = `data:${mime};base64,${item.base64}`;
    link.download = item.title || 'attachment';
    link.click();
  }, [item]);

  const variants = crossingStepBoundary ? stepCrossFadeVariants : slideVariants;
  const transition = crossingStepBoundary ? stepCrossFadeTransition : slideTransition;

  return (
    <motion.div
      className={cn(
        "w-full max-w-md rounded-xl overflow-hidden bg-zinc-800/95",
        "shadow-[0_8px_40px_rgb(0,0,0,0.5)] ring-1 ring-white/[0.08]"
      )}
      custom={direction}
      variants={variants}
      initial="enter"
      animate="center"
      exit="exit"
      transition={transition}
    >
      <div className="p-8 flex flex-col items-center gap-5 text-center">
        <div className="w-16 h-16 rounded-2xl bg-zinc-700/40 flex items-center justify-center ring-1 ring-white/[0.06]">
          <FileText className="w-8 h-8 text-zinc-500" />
        </div>

        <div className="space-y-1.5">
          {item.title && (
            <h3 className="text-sm font-semibold text-white/90">{item.title}</h3>
          )}
          <p className="text-xs text-white/40">
            {item.mimeType || 'Unknown type'} · {estimateSize(item.base64)}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {item.base64 && (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => copy(item.base64!)}
                className="h-8 px-3 text-white/50 hover:text-white hover:bg-white/10"
              >
                {copied
                  ? <><Check className="w-3.5 h-3.5 text-emerald-400" /><span className="text-xs">Copied</span></>
                  : <><Copy className="w-3.5 h-3.5" /><span className="text-xs">Copy Base64</span></>
                }
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDownload}
                className="h-8 px-3 text-white/50 hover:text-white hover:bg-white/10"
              >
                <Download className="w-3.5 h-3.5" />
                <span className="text-xs">Download</span>
              </Button>
            </>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Thumbnail for the film strip
// ---------------------------------------------------------------------------

function ThumbnailIcon({ item }: { item: AttachmentItem }) {
  const cat = categorize(item);

  if (cat === 'image') {
    const src = item.base64
      ? `data:${item.mimeType || 'image/png'};base64,${item.base64}`
      : item.uri ?? '';
    return (
      <img
        src={src}
        alt=""
        className="absolute inset-0 w-full h-full object-cover"
        draggable={false}
      />
    );
  }

  const iconMap = {
    json: { Icon: FileJson, color: 'text-sky-400' },
    text: { Icon: FileCode, color: 'text-zinc-400' },
    binary: { Icon: FileText, color: 'text-zinc-500' },
  } as const;

  const { Icon, color } = iconMap[cat];
  const label = mimeLabel(item.mimeType);

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5 bg-zinc-800">
      <Icon className={cn('w-4 h-4', color)} />
      <span className="text-[8px] font-medium text-white/40 uppercase leading-none tracking-wide">
        {label}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Film strip (with step dividers for galleries)
// ---------------------------------------------------------------------------

function FilmStrip({
  attachments,
  currentIndex,
  onSelect,
  groups,
}: {
  attachments: AttachmentItem[];
  currentIndex: number;
  onSelect: (index: number) => void;
  groups?: StepGroup[];
}) {
  const stripRef = useRef<HTMLDivElement>(null);

  // Scroll active thumbnail into view
  useEffect(() => {
    const container = stripRef.current;
    if (!container) return;
    const active = container.children[currentIndex] as HTMLElement | undefined;
    if (!active) return;
    active.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }, [currentIndex]);

  const currentGroup = groups ? findGroupAtIndex(groups, currentIndex) : null;

  return (
    <motion.div
      className={cn(
        "flex items-center gap-1.5 px-3 py-2",
        "overflow-x-auto scrollbar-none",
        "bg-zinc-900/80 backdrop-blur-sm rounded-xl",
        "ring-1 ring-white/[0.06]"
      )}
      ref={stripRef}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.12, duration: 0.25 }}
    >
      {attachments.map((att, idx) => {
        const isActive = idx === currentIndex;
        const isFirstOfGroup = groups?.some((g) => g.startIndex === idx);
        const group = groups?.find((g) => idx >= g.startIndex && idx < g.startIndex + g.attachments.length);
        const isActiveGroup = group === currentGroup;

        return (
          <div key={idx} className="flex items-center gap-1.5">
            {isFirstOfGroup && idx > 0 && group && (
              <div className="flex flex-col items-center justify-center px-2 shrink-0">
                <div className="h-10 w-px bg-white/10" />
                <span className={cn(
                  'text-[8px] font-semibold uppercase tracking-wider mt-0.5',
                  group.keyword === 'given' && 'text-sky-400/60',
                  group.keyword === 'when' && 'text-amber-400/60',
                  group.keyword === 'then' && 'text-emerald-400/60',
                  ['and', 'but'].includes(group.keyword) && 'text-white/30'
                )}>
                  {group.keyword}
                </span>
              </div>
            )}
            <button
              onClick={() => onSelect(idx)}
              className={cn(
                "relative shrink-0 w-12 h-12 rounded-lg overflow-hidden",
                "transition-all duration-200 cursor-pointer",
                "ring-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400",
                isActive
                  ? "ring-2 ring-sky-400 shadow-[0_0_12px_rgba(56,189,248,0.25)] scale-105"
                  : "ring-white/[0.08] opacity-60 hover:opacity-90 hover:ring-white/20",
                isActiveGroup && !isActive && "ring-white/[0.12] bg-white/[0.03]"
              )}
              aria-label={att.title || `Attachment ${idx + 1}`}
              aria-current={isActive ? 'true' : undefined}
            >
              <ThumbnailIcon item={att} />
            </button>
          </div>
        );
      })}
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Header bar (with auto-play controls for galleries)
// ---------------------------------------------------------------------------

function HeaderBar({
  item,
  currentIndex,
  total,
  onClose,
  isPlaying,
  onTogglePlay,
  hasStepContext,
}: {
  item: AttachmentItem;
  currentIndex: number;
  total: number;
  onClose: () => void;
  isPlaying?: boolean;
  onTogglePlay?: () => void;
  hasStepContext?: boolean;
}) {
  const hasMultiple = total > 1;
  const label = mimeLabel(item.mimeType);

  return (
    <motion.div
      className={cn(
        "absolute top-0 left-0 right-0 z-20",
        "flex items-center justify-between",
        "px-4 py-3",
        "bg-gradient-to-b from-black/60 via-black/30 to-transparent"
      )}
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.08, duration: 0.25 }}
    >
      {/* Left: title + badge */}
      <div className="flex items-center gap-3 min-w-0">
        {item.title && (
          <span className="text-sm font-medium text-white/90 truncate max-w-[30vw]">
            {item.title}
          </span>
        )}
        <span className={cn(
          "shrink-0 px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider",
          "bg-white/[0.08] text-white/50 ring-1 ring-white/[0.06]"
        )}>
          {label}
        </span>
        {hasMultiple && (
          <span className={cn(
            "shrink-0 tabular-nums text-xs font-medium",
            "text-white/40"
          )}>
            {currentIndex + 1} <span className="text-white/20">/</span> {total}
          </span>
        )}
        {hasStepContext && hasMultiple && onTogglePlay && (
          <button
            onClick={onTogglePlay}
            className={cn(
              "shrink-0 h-7 px-2.5 rounded-lg flex items-center gap-1.5",
              "text-white/50 hover:text-white hover:bg-white/10",
              "transition-colors duration-150 text-xs font-medium",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
            )}
            aria-label={isPlaying ? 'Pause slideshow' : 'Play slideshow'}
          >
            {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            {isPlaying ? 'Pause' : 'Play'}
          </button>
        )}
      </div>

      {/* Right: close */}
      <DialogPrimitive.Close asChild>
        <button
          className={cn(
            "h-8 w-8 rounded-lg flex items-center justify-center",
            "text-white/50 hover:text-white hover:bg-white/10",
            "transition-colors duration-150",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
          )}
          aria-label="Close viewer"
          onClick={onClose}
        >
          <X className="w-4.5 h-4.5" />
        </button>
      </DialogPrimitive.Close>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Navigation arrows
// ---------------------------------------------------------------------------

function NavArrow({
  direction,
  onClick,
  label,
}: {
  direction: 'prev' | 'next';
  onClick: () => void;
  label: string;
}) {
  const isPrev = direction === 'prev';
  return (
    <motion.button
      className={cn(
        "absolute top-1/2 -translate-y-1/2 z-20",
        isPrev ? "left-3" : "right-3",
        "h-11 w-11 rounded-xl flex items-center justify-center",
        "bg-white/[0.06] backdrop-blur-sm",
        "text-white/50 hover:text-white hover:bg-white/[0.12]",
        "ring-1 ring-white/[0.08]",
        "transition-colors duration-150",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
      )}
      onClick={onClick}
      aria-label={label}
      initial={{ opacity: 0, x: isPrev ? -8 : 8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.1, duration: 0.2 }}
      whileHover={{ scale: 1.06 }}
      whileTap={{ scale: 0.95 }}
    >
      {isPrev
        ? <ChevronLeft className="w-5 h-5" />
        : <ChevronRight className="w-5 h-5" />
      }
    </motion.button>
  );
}

// ---------------------------------------------------------------------------
// Main AttachmentViewer
// ---------------------------------------------------------------------------

export function AttachmentViewer({ attachments, initialIndex = 0, open, onOpenChange }: AttachmentViewerProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [direction, setDirection] = useState(0); // +1 = forward, -1 = backward
  const [isPlaying, setIsPlaying] = useState(false);
  const [prevStepIndex, setPrevStepIndex] = useState<number | undefined>();
  const hasMultiple = attachments.length > 1;

  // Detect step context
  const hasStepContext = attachments.some(att => att.stepIndex !== undefined);
  const groups = useMemo(() => {
    if (!hasStepContext) return undefined;
    return groupByStep(attachments as GalleryItem[]);
  }, [attachments, hasStepContext]);

  useEffect(() => {
    if (open) {
      setCurrentIndex(initialIndex);
      setDirection(0);
      setIsPlaying(false);
      setPrevStepIndex(attachments[initialIndex]?.stepIndex);
    }
  }, [open, initialIndex, attachments]);

  // Check if we're crossing step boundary
  const current = attachments[currentIndex] ?? attachments[0];
  const currentStepIndex = current?.stepIndex;
  const crossingStepBoundary = hasStepContext && 
    prevStepIndex !== undefined && 
    currentStepIndex !== undefined && 
    prevStepIndex !== currentStepIndex;

  const goNext = useCallback(() => {
    setPrevStepIndex(attachments[currentIndex]?.stepIndex);
    setDirection(1);
    setCurrentIndex((i) => (i + 1) % attachments.length);
  }, [attachments, currentIndex]);

  const goPrev = useCallback(() => {
    setPrevStepIndex(attachments[currentIndex]?.stepIndex);
    setDirection(-1);
    setCurrentIndex((i) => (i - 1 + attachments.length) % attachments.length);
  }, [attachments, currentIndex]);

  const goTo = useCallback((idx: number) => {
    setPrevStepIndex(attachments[currentIndex]?.stepIndex);
    setDirection(idx > currentIndex ? 1 : -1);
    setCurrentIndex(idx);
  }, [currentIndex, attachments]);

  const goToStart = useCallback(() => {
    goTo(0);
  }, [goTo]);

  const goToEnd = useCallback(() => {
    goTo(attachments.length - 1);
  }, [goTo, attachments.length]);

  const jumpToPrevStep = useCallback(() => {
    if (!groups) return;
    const target = jumpToAdjacentGroup(groups, currentIndex, 'prev');
    if (target !== null) goTo(target);
  }, [groups, currentIndex, goTo]);

  const jumpToNextStep = useCallback(() => {
    if (!groups) return;
    const target = jumpToAdjacentGroup(groups, currentIndex, 'next');
    if (target !== null) goTo(target);
  }, [groups, currentIndex, goTo]);

  const togglePlay = useCallback(() => {
    setIsPlaying(p => !p);
  }, []);

  // Auto-play logic
  useEffect(() => {
    if (!isPlaying || !open) return;

    const currentGroup = groups ? findGroupAtIndex(groups, currentIndex) : null;
    const nextIndex = (currentIndex + 1) % attachments.length;
    const nextGroup = groups ? findGroupAtIndex(groups, nextIndex) : null;
    const willCrossStepBoundary = currentGroup && nextGroup && currentGroup !== nextGroup;

    // Base interval + step boundary pause
    const interval = willCrossStepBoundary ? 4000 : 3000;

    const timer = setTimeout(() => {
      if (nextIndex === 0) {
        // End of gallery
        setIsPlaying(false);
      } else {
        goNext();
      }
    }, interval);

    return () => clearTimeout(timer);
  }, [isPlaying, open, currentIndex, attachments.length, groups, goNext]);

  // Keyboard navigation
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' && hasMultiple) { e.preventDefault(); goNext(); }
      if (e.key === 'ArrowLeft' && hasMultiple) { e.preventDefault(); goPrev(); }
      if (e.key === '[' && hasStepContext) { e.preventDefault(); jumpToPrevStep(); }
      if (e.key === ']' && hasStepContext) { e.preventDefault(); jumpToNextStep(); }
      if (e.key === ' ' && hasStepContext) { e.preventDefault(); togglePlay(); }
      if (e.key === 'Home') { e.preventDefault(); goToStart(); }
      if (e.key === 'End') { e.preventDefault(); goToEnd(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, hasMultiple, hasStepContext, goNext, goPrev, jumpToPrevStep, jumpToNextStep, togglePlay, goToStart, goToEnd]);

  if (attachments.length === 0) return null;

  const category = categorize(current);
  const navLabel = category === 'image' ? 'image' : 'attachment';

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <AnimatePresence>
          {open && (
            <>
              {/* Overlay */}
              <DialogPrimitive.Overlay asChild forceMount>
                <motion.div
                  className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.25 }}
                />
              </DialogPrimitive.Overlay>

              {/* Content */}
              <DialogPrimitive.Content
                asChild
                forceMount
                onOpenAutoFocus={(e) => e.preventDefault()}
                onInteractOutside={(e) => e.preventDefault()}
              >
                <motion.div
                  className="fixed inset-0 z-50 flex flex-col"
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  transition={{ duration: 0.25, ease: [0.25, 0.46, 0.45, 0.94] }}
                  onClick={(e) => {
                    if (e.target === e.currentTarget) onOpenChange(false);
                  }}
                >
                  {/* Accessible title (visually hidden) */}
                  <DialogPrimitive.Title className="sr-only">
                    {current.title || 'Attachment preview'}
                  </DialogPrimitive.Title>

                  {/* Header bar */}
                  <HeaderBar
                    item={current}
                    currentIndex={currentIndex}
                    total={attachments.length}
                    onClose={() => onOpenChange(false)}
                    isPlaying={isPlaying}
                    onTogglePlay={togglePlay}
                    hasStepContext={hasStepContext}
                  />

                  {/* Navigation arrows */}
                  {hasMultiple && (
                    <>
                      <NavArrow direction="prev" onClick={goPrev} label={`Previous ${navLabel}`} />
                      <NavArrow direction="next" onClick={goNext} label={`Next ${navLabel}`} />
                    </>
                  )}

                  {/* Content area */}
                  <div
                    className={cn(
                      "flex-1 flex flex-col items-center justify-center",
                      "px-16 pt-14",
                      hasMultiple ? "pb-4" : "pb-8"
                    )}
                    onClick={(e) => {
                      if (e.target === e.currentTarget) onOpenChange(false);
                    }}
                  >
                    {/* Step context bar */}
                    <AnimatePresence mode="wait">
                      {hasStepContext && (
                        <StepContextBar 
                          key={`context-${currentIndex}`}
                          item={current} 
                          currentIndex={currentIndex}
                          total={attachments.length}
                          groups={groups}
                        />
                      )}
                    </AnimatePresence>

                    {/* Main content */}
                    <AnimatePresence mode="wait" custom={direction}>
                      {category === 'image' && (
                        <ImageRenderer 
                          key={`img-${currentIndex}`} 
                          item={current} 
                          index={currentIndex} 
                          direction={direction}
                          crossingStepBoundary={crossingStepBoundary}
                        />
                      )}
                      {category === 'json' && (
                        <JsonRenderer 
                          key={`json-${currentIndex}`} 
                          item={current} 
                          direction={direction}
                          crossingStepBoundary={crossingStepBoundary}
                        />
                      )}
                      {category === 'text' && (
                        <TextRenderer 
                          key={`text-${currentIndex}`} 
                          item={current} 
                          direction={direction}
                          crossingStepBoundary={crossingStepBoundary}
                        />
                      )}
                      {category === 'binary' && (
                        <BinaryFallback 
                          key={`bin-${currentIndex}`} 
                          item={current} 
                          direction={direction}
                          crossingStepBoundary={crossingStepBoundary}
                        />
                      )}
                    </AnimatePresence>

                    {/* Auto-play progress bar */}
                    {isPlaying && (
                      <motion.div 
                        className="w-full max-w-4xl mt-2 h-1 bg-white/5 rounded-full overflow-hidden"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                      >
                        <motion.div 
                          className="h-full bg-sky-400/60"
                          initial={{ width: '0%' }}
                          animate={{ width: '100%' }}
                          transition={{ 
                            duration: crossingStepBoundary ? 4 : 3, 
                            ease: 'linear' 
                          }}
                          key={currentIndex}
                        />
                      </motion.div>
                    )}
                  </div>

                  {/* Film strip — only when multiple attachments */}
                  {hasMultiple && (
                    <div
                      className="flex justify-center pb-4 px-4"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <FilmStrip
                        attachments={attachments}
                        currentIndex={currentIndex}
                        onSelect={goTo}
                        groups={groups}
                      />
                    </div>
                  )}
                </motion.div>
              </DialogPrimitive.Content>
            </>
          )}
        </AnimatePresence>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
