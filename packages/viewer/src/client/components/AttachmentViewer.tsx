import { useState, useCallback, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { motion, AnimatePresence, useIsPresent } from 'framer-motion';
import { JsonView, darkStyles } from 'react-json-view-lite';
import 'react-json-view-lite/dist/index.css';
import './attachment-json.css';
import {
  X, ChevronLeft, ChevronRight, Copy, Check,
  FileText, FileCode, FileJson, Download, AlertTriangle,
  Play, Pause, CheckCircle2, XCircle, AlertCircle, HelpCircle,
  Maximize2, Minimize2, Workflow, Plus, Minus, MoreHorizontal,
} from 'lucide-react';
import type { Status } from '@swedevtools/livedoc-schema';
import { cn } from '../lib/utils';
import { Button } from './ui/button';
import { JsonSearchPanel } from './JsonSearchPanel';
import { useJsonSearch, type JsonSearch } from '../hooks/useJsonSearch';
import {
  isJsonValue, isJsonCollection, jsonFieldElement, jsonHitRanges, type JsonValue,
} from '../lib/json-search';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from './ui/dropdown-menu';
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
  stepCount?: number;
}

export interface AttachmentViewerProps {
  attachments: AttachmentItem[];
  initialIndex?: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AttachmentContentMetadata({
  item,
  fallbackMimeType,
  position,
}: {
  item: AttachmentItem;
  fallbackMimeType: string;
  position?: string;
}) {
  const size = item.base64 ? estimateSize(item.base64) : undefined;
  return (
    <div className="flex min-w-0 flex-col gap-0.5" title={item.title}>
      <span className="line-clamp-2 break-all text-sm font-semibold leading-snug text-white/90">
        {item.title || 'Untitled attachment'}
      </span>
      <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-white/75">
        <span className="max-w-full break-all">{item.mimeType || fallbackMimeType}</span>
        {size && <span aria-label={`Attachment size ${size}`} className="whitespace-nowrap">
          {size}
        </span>}
        {position && <span className="whitespace-nowrap tabular-nums">{position}</span>}
      </div>
    </div>
  );
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

function isMermaid(item: AttachmentItem): boolean {
  const mime = (item.mimeType || '').split(';', 1)[0].trim().toLowerCase();
  return ['text/vnd.mermaid', 'text/x-mermaid', 'text/mermaid', 'application/vnd.mermaid'].includes(mime)
    || [item.title, item.uri].some((name) => /\.(?:mmd|mermaid)$/i.test((name || '').split(/[?#]/, 1)[0]));
}

type ContentCategory = 'image' | 'json' | 'text' | 'mermaid' | 'binary';

function categorize(item: AttachmentItem): ContentCategory {
  if (isMermaid(item)) return 'mermaid';
  const mime = (item.mimeType || '').split(';', 1)[0].trim().toLowerCase();
  if (isImageMime(mime)) return 'image';
  if (isJsonMime(mime)) return 'json';
  if (isTextMime(mime)) return 'text';
  return 'binary';
}

/** Short label for a MIME type (shown in badges). */
function mimeLabel(mime: string | undefined): string {
  if (!mime) return 'file';
  const type = mime.split(';', 1)[0].trim().toLowerCase();
  if (isImageMime(type)) return type.replace('image/', '').toUpperCase();
  if (isJsonMime(type)) return 'JSON';
  if (isTextMime(type)) return type.replace('text/', '').toUpperCase() || 'TEXT';
  return type.split('/').pop()?.toUpperCase() || 'FILE';
}

function attachmentLabel(item: AttachmentItem): string {
  return isMermaid(item) ? 'MERMAID' : mimeLabel(item.mimeType);
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
  const padding = b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0;
  const bytes = Math.max(0, Math.floor((b64.length * 3) / 4) - padding);
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ---------------------------------------------------------------------------
// Copy-to-clipboard hook
// ---------------------------------------------------------------------------

function useCopyToClipboard(resetKey?: number) {
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState<string | null>(null);
  useEffect(() => {
    setCopied(false);
    setCopyError(null);
  }, [resetKey]);

  const copy = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setCopyError(null);
    } catch {
      setCopied(false);
      setCopyError('Could not copy to clipboard. Check browser permissions.');
    }
  }, []);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(t);
  }, [copied]);

  return { copied, copy, copyError };
}

interface PreviewSize {
  width: number;
  height: number;
}

interface ScalablePreviewProps {
  size?: PreviewSize;
  scale: number;
  onSizeChange: (size: PreviewSize | undefined) => void;
  onViewportChange: (size: PreviewSize | undefined) => void;
  onZoomChange: (value: number | null) => void;
}

const minimumPreviewZoom = 0.05;
const maximumPreviewZoom = 4;
const zoomStep = 1.5;

function clampPreviewZoom(value: number): number {
  return Math.min(maximumPreviewZoom, Math.max(minimumPreviewZoom, value));
}

function scaledPreviewZoom(scale: number, factor: number): number {
  return clampPreviewZoom(scale * factor);
}

const jsonStyles = {
  ...darkStyles,
  container: `${darkStyles.container} livedoc-json-tree !bg-transparent [overflow-wrap:anywhere]`,
  basicChildStyle: 'livedoc-json-row',
  childFieldsContainer: 'livedoc-json-children border-l border-white/10',
  label: 'livedoc-json-label mr-1 text-sky-300',
  stringValue: 'livedoc-json-value text-emerald-300',
  numberValue: 'livedoc-json-value text-amber-300',
  booleanValue: 'livedoc-json-value text-violet-300',
  nullValue: 'livedoc-json-value text-rose-300',
  punctuation: 'livedoc-json-punctuation text-zinc-300',
  collapseIcon: `${darkStyles.collapseIcon} livedoc-json-disclosure rounded text-zinc-300 hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-sky-400`,
  expandIcon: `${darkStyles.expandIcon} livedoc-json-disclosure rounded text-zinc-300 hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-sky-400`,
  collapsedContent: `${darkStyles.collapsedContent} text-zinc-400`,
  quotesForFieldNames: true,
  stringifyStringValues: true,
};

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
// Step context (shown in the shared gallery header)
// ---------------------------------------------------------------------------

function stepPosition(stepIndex: number, stepCount?: number): string {
  return `Step ${stepIndex + 1}${stepCount !== undefined && stepCount > stepIndex
    ? ` of ${stepCount}` : ''}`;
}

function StepContext({ item }: { item: AttachmentItem }) {
  if (item.stepIndex === undefined) return null;

  const keywordColors: Record<string, string> = {
    given: 'text-sky-400',
    when: 'text-amber-400',
    then: 'text-emerald-400',
    and: 'text-white/50',
    but: 'text-rose-400',
  };

  const statusIcons: Record<Status, React.ReactElement> = {
    passed: <CheckCircle2 className="h-4 w-4 text-pass" aria-label="Passed" />,
    failed: <XCircle className="h-4 w-4 text-fail" aria-label="Failed" />,
    pending: <AlertCircle className="h-4 w-4 text-pending" aria-label="Pending" />,
    running: <AlertCircle className="h-4 w-4 animate-pulse text-sky-400" aria-label="Running" />,
    skipped: <HelpCircle className="h-4 w-4 text-muted-foreground" aria-label="Skipped" />,
    timedOut: <XCircle className="h-4 w-4 text-fail" aria-label="Timed out" />,
    cancelled: <HelpCircle className="h-4 w-4 text-muted-foreground" aria-label="Cancelled" />,
  };

  return (
    <div className="flex min-w-0 items-center gap-2" aria-live="polite"
      title={`Step ${item.stepIndex + 1}: ${item.stepKeyword || ''} ${item.stepTitle || ''} · ${item.title || 'Attachment'} · ${item.mimeType || 'Unknown type'}`}>
      <span className="shrink-0 text-xs font-medium tabular-nums text-white/75">
        {stepPosition(item.stepIndex, item.stepCount)}
      </span>
      {item.stepKeyword && (
        <span className={cn('shrink-0 text-xs font-semibold capitalize sm:text-sm',
          keywordColors[item.stepKeyword.toLowerCase()] || 'text-white/75')}>
          {item.stepKeyword}
        </span>
      )}
      {item.stepTitle && <span className="line-clamp-2 min-w-0 break-words text-xs text-white/75 sm:text-sm">
        {item.stepTitle}
      </span>}
      {item.stepStatus && <span className="shrink-0">{statusIcons[item.stepStatus]}</span>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-renderers (polished)
// ---------------------------------------------------------------------------

function ImageRenderer({ 
  item, 
  index, 
  direction,
  crossingStepBoundary,
  maximized,
  preview,
}: { 
  item: AttachmentItem; 
  index: number; 
  direction: number;
  crossingStepBoundary: boolean;
  maximized: boolean;
  preview: ScalablePreviewProps;
}) {
  const src = item.base64
    ? `data:${item.mimeType || 'image/png'};base64,${item.base64}`
    : item.uri ?? '';

  const variants = crossingStepBoundary ? stepCrossFadeVariants : slideVariants;
  const transition = crossingStepBoundary ? stepCrossFadeTransition : slideTransition;

  return (
    <motion.div
      className={cn("h-full min-h-0 w-full overflow-hidden rounded-lg shadow-[0_8px_40px_rgb(0,0,0,0.5)] ring-1 ring-white/[0.08]",
        !maximized && "max-w-5xl")}
      custom={direction}
      variants={variants}
      initial="enter"
      animate="center"
      exit="exit"
      transition={transition}
    >
      <ScalablePreview src={src} alt={item.title || `Image ${index + 1}`} kind="image" {...preview} />
    </motion.div>
  );
}

function ScalablePreview({
  src, alt, kind, intrinsicSize, onImageError, size, scale, onSizeChange, onViewportChange, onZoomChange,
}: {
  src: string;
  alt: string;
  kind: 'image' | 'diagram';
  intrinsicSize?: PreviewSize;
  onImageError?: () => void;
} & ScalablePreviewProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const pointerRef = useRef<{ id: number; x: number; y: number; left: number; top: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const [canPan, setCanPan] = useState(false);
  const [loadedSrc, setLoadedSrc] = useState<string>();
  const isPresent = useIsPresent();
  const zoomRef = useRef({ scale, onZoomChange });
  const anchorRef = useRef<{ x: number; y: number; imageX: number; imageY: number } | null>(null);
  const [anchoredLayout, setAnchoredLayout] = useState<{
    left: number; top: number; width: number; height: number; scrollLeft: number; scrollTop: number;
  }>();

  useLayoutEffect(() => {
    zoomRef.current = { scale, onZoomChange };
    const anchor = anchorRef.current;
    const viewport = viewportRef.current;
    const image = imageRef.current;
    if (!anchor || !viewport || !image) {
      setAnchoredLayout(undefined);
      return;
    }
    anchorRef.current = null;
    const bounds = image.getBoundingClientRect();
    const viewportBounds = viewport.getBoundingClientRect();
    const ratioX = viewportBounds.width / viewport.offsetWidth;
    const ratioY = viewportBounds.height / viewport.offsetHeight;
    const width = bounds.width / ratioX;
    const height = bounds.height / ratioY;
    const desiredLeft = (anchor.x - viewportBounds.left) / ratioX - viewport.clientLeft - anchor.imageX * width;
    const desiredTop = (anchor.y - viewportBounds.top) / ratioY - viewport.clientTop - anchor.imageY * height;
    const left = Math.max(16, desiredLeft);
    const top = Math.max(16, desiredTop);
    const scrollLeft = left - desiredLeft;
    const scrollTop = top - desiredTop;
    // Keep space for the anchor even when the image fits: centering alone would move it.
    setAnchoredLayout({
      left, top, scrollLeft, scrollTop,
      width: Math.max(viewport.clientWidth, left + width + 16, scrollLeft + viewport.clientWidth),
      height: Math.max(viewport.clientHeight, top + height + 16, scrollTop + viewport.clientHeight),
    });
  }, [scale, onZoomChange]);

  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport || !anchoredLayout) return;
    viewport.scrollLeft = anchoredLayout.scrollLeft;
    viewport.scrollTop = anchoredLayout.scrollTop;
    setCanPan(viewport.scrollWidth > viewport.clientWidth + 1 || viewport.scrollHeight > viewport.clientHeight + 1);
  }, [anchoredLayout]);

  useEffect(() => {
    return () => onSizeChange(undefined);
  }, [onSizeChange]);

  useEffect(() => {
    const image = imageRef.current;
    if (!image) return;
    const measureImage = () => {
      if (image.naturalWidth && image.naturalHeight) {
        onSizeChange(intrinsicSize ?? { width: image.naturalWidth, height: image.naturalHeight });
        setLoadedSrc(src);
      }
    };
    image.addEventListener('load', measureImage);
    if (image.complete) measureImage();
    return () => image.removeEventListener('load', measureImage);
  }, [src, intrinsicSize, onSizeChange]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport || loadedSrc !== src || !isPresent) return;
    const wheel = (event: WheelEvent) => {
      const image = imageRef.current;
      if (!event.ctrlKey || !image?.complete || !image.naturalWidth || !image.naturalHeight) return;
      event.preventDefault();
      const unit = event.deltaMode === WheelEvent.DOM_DELTA_LINE ? 16
        : event.deltaMode === WheelEvent.DOM_DELTA_PAGE ? viewport.clientHeight : 1;
      const delta = Math.max(-100, Math.min(100, event.deltaY * unit));
      if (!Number.isFinite(delta) || delta === 0) return;
      const current = zoomRef.current;
      if (delta > 0 && current.scale <= minimumPreviewZoom
          || delta < 0 && current.scale >= maximumPreviewZoom) return;
      const next = scaledPreviewZoom(current.scale, Math.pow(zoomStep, -delta / 100));
      if (next === current.scale) return;
      const bounds = image.getBoundingClientRect();
      if (!bounds.width || !bounds.height) return;
      anchorRef.current = {
        x: event.clientX, y: event.clientY,
        imageX: (event.clientX - bounds.left) / bounds.width,
        imageY: (event.clientY - bounds.top) / bounds.height,
      };
      current.scale = next;
      current.onZoomChange(next);
    };
    viewport.addEventListener('wheel', wheel, { passive: false });
    return () => {
      viewport.removeEventListener('wheel', wheel);
      anchorRef.current = null;
    };
  }, [loadedSrc, src, isPresent]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const measure = () => {
      onViewportChange({ width: viewport.clientWidth, height: viewport.clientHeight });
      setCanPan(viewport.scrollWidth > viewport.clientWidth + 1 || viewport.scrollHeight > viewport.clientHeight + 1);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(viewport);
    const image = viewport.querySelector('img');
    if (image) observer.observe(image);
    return () => {
      observer.disconnect();
      onViewportChange(undefined);
    };
  }, [onViewportChange]);

  const stopPanning = (event: React.PointerEvent<HTMLDivElement>) => {
    if (pointerRef.current?.id !== event.pointerId) return;
    pointerRef.current = null;
    setDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  return (
    <div className="flex h-full min-h-0 w-full flex-col">
      <div ref={viewportRef} role="region" aria-label={`${kind === 'diagram' ? 'Mermaid diagram' : 'Image'} viewport`}
        aria-description={loadedSrc === src
          ? 'Ctrl + mouse wheel to zoom. Drag to pan when zoomed; use arrow keys to scroll.'
          : 'Use arrow keys to scroll.'}
        title={loadedSrc === src ? 'Ctrl + mouse wheel to zoom; drag to pan when zoomed' : undefined}
        tabIndex={0}
        className={cn(
          "min-h-0 min-w-0 flex-1 overflow-auto overscroll-contain bg-zinc-900/95",
          canPan && "cursor-grab",
          dragging && "cursor-grabbing select-none"
        )}
        onPointerDown={(event) => {
          if (event.pointerType === 'touch' || event.button !== 0 || !canPan) return;
          const viewport = event.currentTarget;
          viewport.focus({ preventScroll: true });
          pointerRef.current = {
            id: event.pointerId, x: event.clientX, y: event.clientY,
            left: viewport.scrollLeft, top: viewport.scrollTop,
          };
          viewport.setPointerCapture(event.pointerId);
          setDragging(true);
          event.preventDefault();
        }}
        onPointerMove={(event) => {
          const origin = pointerRef.current;
          if (!origin || origin.id !== event.pointerId) return;
          event.currentTarget.scrollLeft = origin.left + origin.x - event.clientX;
          event.currentTarget.scrollTop = origin.top + origin.y - event.clientY;
          event.preventDefault();
        }}
        onPointerUp={stopPanning}
        onPointerCancel={stopPanning}
        onLostPointerCapture={stopPanning}
        onDragStart={(event) => event.preventDefault()}>
        <div className="inline-flex h-max min-h-full w-max min-w-full items-center justify-center p-4"
          style={anchoredLayout ? {
            position: 'relative', width: anchoredLayout.width, height: anchoredLayout.height,
          } : undefined}>
          <img ref={imageRef} src={src} alt={alt} draggable={false} className="block max-w-none shrink-0 rounded-lg"
            style={size || intrinsicSize ? {
              width: (intrinsicSize ?? size)!.width * scale,
              height: (intrinsicSize ?? size)!.height * scale,
              ...(anchoredLayout ? { position: 'absolute', left: anchoredLayout.left, top: anchoredLayout.top } as const : {}),
            } : undefined}
            onError={() => {
              setLoadedSrc(undefined);
              onSizeChange(undefined);
              onImageError?.();
            }} />
        </div>
      </div>
    </div>
  );
}

interface JsonContent {
  formatted: string;
  parsed: JsonValue;
  error: string | null;
}

function readJsonContent(base64: string | undefined): JsonContent {
  if (!base64) return { formatted: '', parsed: null, error: 'No data available' };
  const raw = decodeBase64(base64);
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isJsonValue(parsed)) throw new Error('Not a JSON value');
    return { formatted: JSON.stringify(parsed, null, 2), parsed, error: null };
  } catch {
    return { formatted: raw, parsed: null, error: 'Invalid JSON — showing raw content' };
  }
}

function JsonRenderer({ content, direction, crossingStepBoundary, maximized, search }: {
  content: JsonContent; direction: number; crossingStepBoundary: boolean; maximized: boolean; search: JsonSearch;
}) {
  const { formatted, parsed, error } = content;
  const viewportRef = useRef<HTMLDivElement>(null);
  const expansionRef = useRef(new WeakMap<object, boolean>());
  const active = search.hits[search.active];
  const reveal = useMemo(() => new Set<object>(active?.field.ancestors),
    [active, search.revision]);
  const shouldExpandNode = useCallback((level: number, value: unknown) => {
    if (typeof value !== 'object' || value === null) return level === 0;
    if (reveal.has(value)) {
      expansionRef.current.set(value, true);
      return true;
    }
    return expansionRef.current.get(value) ?? level === 0;
  }, [reveal]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport || error) return;
    const highlights = typeof CSS !== 'undefined' && 'highlights' in CSS && typeof Highlight !== 'undefined'
      ? CSS.highlights : undefined;
    const matches = highlights ? new Highlight() : undefined;
    const selected = highlights ? new Highlight() : undefined;
    if (selected) selected.priority = 1;
    let scrolled = false;
    let frame = 0;
    const update = () => {
      matches?.clear();
      selected?.clear();
      for (const hit of search.hits) {
        const element = jsonFieldElement(viewport, hit.field);
        if (!element) continue;
        const ranges = jsonHitRanges(element, hit);
        for (const range of ranges) {
          matches?.add(range);
          if (hit === active) selected?.add(range);
        }
        if (hit === active && !scrolled) {
          const bounds = ranges[0]?.getBoundingClientRect() ?? element.getBoundingClientRect();
          const container = viewport.getBoundingClientRect();
          if (bounds.top < container.top + 12 || bounds.bottom > container.bottom - 12) {
            viewport.scrollTop += bounds.top - container.top - viewport.clientHeight / 2;
          }
          scrolled = true;
        }
      }
      if (matches && selected && highlights) {
        highlights.set('livedoc-json-match', matches);
        highlights.set('livedoc-json-active', selected);
      }
    };
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(update);
    };
    const observer = new MutationObserver(schedule);
    observer.observe(viewport, { childList: true, subtree: true });
    schedule();
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
      if (highlights?.get('livedoc-json-match') === matches) highlights?.delete('livedoc-json-match');
      if (highlights?.get('livedoc-json-active') === selected) highlights?.delete('livedoc-json-active');
    };
  }, [search.hits, active, search.revision, error]);

  const variants = crossingStepBoundary ? stepCrossFadeVariants : slideVariants;
  const transition = crossingStepBoundary ? stepCrossFadeTransition : slideTransition;

  return (
    <motion.div
      className={cn(
        "relative w-full min-h-0 flex flex-col overflow-hidden",
        !maximized && "max-w-4xl",
        "max-h-full"
      )}
      custom={direction}
      variants={variants}
      initial="enter"
      animate="center"
      exit="exit"
      transition={transition}
    >
      <div ref={viewportRef} role="region" className="min-w-0 flex-1 overflow-auto overscroll-contain bg-zinc-900/95 p-4 text-[13px] font-mono" aria-label="JSON preview">
        {error && <p role="alert" className="mb-3 flex items-center gap-2 text-xs text-amber-300">
          <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />{error}
        </p>}
        {error
          ? <pre className="leading-relaxed whitespace-pre text-zinc-300">{formatted}</pre>
          : isJsonCollection(parsed)
            ? <JsonView data={parsed} style={jsonStyles} shouldExpandNode={shouldExpandNode}
                beforeExpandChange={({ value, newExpandValue }: { value: unknown; newExpandValue: boolean }) => {
                  if (typeof value === 'object' && value !== null) expansionRef.current.set(value, newExpandValue);
                  return true;
                }} />
            : <code className="livedoc-json-value break-all text-zinc-200">{formatted}</code>}
      </div>
    </motion.div>
  );
}

function TextRenderer({ text, direction, crossingStepBoundary, maximized }: { text: string; direction: number; crossingStepBoundary: boolean; maximized: boolean }) {
  const variants = crossingStepBoundary ? stepCrossFadeVariants : slideVariants;
  const transition = crossingStepBoundary ? stepCrossFadeTransition : slideTransition;

  return (
    <motion.div
      className={cn(
        "relative w-full min-h-0 flex flex-col overflow-hidden",
        !maximized && "max-w-4xl",
        "max-h-full"
      )}
      custom={direction}
      variants={variants}
      initial="enter"
      animate="center"
      exit="exit"
      transition={transition}
    >
      <div role="region" aria-label="Text preview" className="flex-1 overflow-auto bg-zinc-900/95 p-4">
        <pre className="text-[13px] leading-relaxed font-mono text-zinc-300 whitespace-pre">
          {text}
        </pre>
      </div>
    </motion.div>
  );
}

let mermaidRenderId = 0;
let mermaidLoader: Promise<typeof import('mermaid')['default']> | undefined;

function loadMermaid() {
  mermaidLoader ??= import('mermaid').then(({ default: mermaid }) => {
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: 'strict',
      theme: 'dark',
      flowchart: { htmlLabels: false },
      suppressErrorRendering: true,
      maxTextSize: 100_000,
    });
    return mermaid;
  }).catch((error: unknown) => {
    mermaidLoader = undefined;
    throw error;
  });
  return mermaidLoader;
}

function decodeMermaidSource(base64: string | undefined): string | null {
  if (!base64) return null;
  try {
    const bytes = Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return null;
  }
}

function MermaidRenderer({ item, direction, crossingStepBoundary, maximized, preview, source, showSource }: {
  item: AttachmentItem; direction: number; crossingStepBoundary: boolean; maximized: boolean;
  preview: ScalablePreviewProps; source: string | null; showSource: boolean;
}) {
  const [imageUrl, setImageUrl] = useState<string>();
  const [diagramSize, setDiagramSize] = useState<{ width: number; height: number }>();
  const [error, setError] = useState(false);
  useEffect(() => {
    let cancelled = false;
    let url: string | undefined;
    setImageUrl(undefined);
    setDiagramSize(undefined);
    setError(false);

    if (!source?.trim()) {
      setError(true);
    } else {
      void loadMermaid()
        .then((mermaid) => mermaid.render(`attachment-mermaid-${++mermaidRenderId}`, source))
        .then(({ svg }) => {
          if (cancelled) return;
          // SVG remains an image resource: never insert an attachment's SVG into the document DOM.
          const viewBox = svg.match(/\bviewBox="([^"]+)"/)?.[1].trim().split(/[\s,]+/).map(Number);
          if (viewBox?.length === 4 && viewBox[2] > 0 && viewBox[3] > 0
              && Number.isFinite(viewBox[2]) && Number.isFinite(viewBox[3])) {
            setDiagramSize({ width: viewBox[2], height: viewBox[3] });
          }
          url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
          setImageUrl(url);
        })
        .catch(() => {
          if (!cancelled) setError(true);
        });
    }

    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [source]);

  const variants = crossingStepBoundary ? stepCrossFadeVariants : slideVariants;
  const transition = crossingStepBoundary ? stepCrossFadeTransition : slideTransition;

  return (
    <motion.div
      className={cn("relative w-full h-full max-h-full min-h-0 flex flex-col overflow-hidden bg-zinc-900/95",
        !maximized && "max-w-5xl")}
      custom={direction}
      variants={variants}
      initial="enter"
      animate="center"
      exit="exit"
      transition={transition}
    >
      {error && (
        <p role="alert" className="flex shrink-0 items-center gap-2 px-4 py-2 text-sm text-amber-300 bg-amber-950/30">
          <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden="true" />
          Could not render this Mermaid diagram. Check the source below.
        </p>
      )}
      {error || showSource ? (
        <pre className="min-h-0 flex-1 overflow-auto p-4 text-[13px] leading-relaxed font-mono text-zinc-200 whitespace-pre" aria-label="Mermaid source">
          {source ?? (item.base64 || 'No diagram source available')}
        </pre>
      ) : imageUrl ? (
        <div className="min-h-0 flex-1">
          <ScalablePreview src={imageUrl} alt={`Mermaid diagram: ${item.title || 'attachment'}`}
            kind="diagram" intrinsicSize={diagramSize} onImageError={() => setError(true)} {...preview} />
        </div>
      ) : (
        <p role="status" className="p-6 text-center text-sm text-zinc-300">Rendering Mermaid diagram…</p>
      )}
    </motion.div>
  );
}

function BinaryFallback({ item, direction, crossingStepBoundary }: { item: AttachmentItem; direction: number; crossingStepBoundary: boolean }) {
  const variants = crossingStepBoundary ? stepCrossFadeVariants : slideVariants;
  const transition = crossingStepBoundary ? stepCrossFadeTransition : slideTransition;

  return (
    <motion.div
      className="w-full max-w-md"
      custom={direction}
      variants={variants}
      initial="enter"
      animate="center"
      exit="exit"
      transition={transition}
    >
      <div className="p-8 flex flex-col items-center gap-5 text-center">
        <div className="flex h-16 w-16 items-center justify-center">
          <FileText className="w-8 h-8 text-zinc-500" />
        </div>

        <div className="space-y-1.5">
          <p className="text-sm font-semibold text-white/90">Preview unavailable</p>
          <p className="text-xs text-white/65">
            {item.mimeType || 'Unknown type'} · {estimateSize(item.base64)}
          </p>
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
    mermaid: { Icon: Workflow, color: 'text-sky-400' },
    binary: { Icon: FileText, color: 'text-zinc-500' },
  } as const;

  const { Icon, color } = iconMap[cat];
  const label = attachmentLabel(item);

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

function ZoomControls({
  kind, scale, zoom, onZoomChange,
}: {
  kind: 'image' | 'diagram';
  scale: number;
  zoom: number | null;
  onZoomChange: (value: number | null) => void;
}) {
  const buttonClass = "h-11 w-11 shrink-0 rounded-md p-0 text-white/80 hover:bg-white/10 hover:text-white focus-visible:ring-sky-400";
  const selectedClass = "bg-sky-400/15 text-sky-200";
  return (
    <div role="toolbar" aria-label={`${kind === 'diagram' ? 'Diagram' : 'Image'} zoom`}
      className="flex min-w-0 items-center gap-0.5">
      <Button variant="ghost" size="sm" aria-label={`Fit ${kind}`} title={`Fit ${kind}`}
        aria-pressed={zoom === null} onClick={() => onZoomChange(null)}
        className={cn(buttonClass, zoom === null && selectedClass)}>Fit</Button>
      <Button variant="ghost" size="icon" aria-label="Zoom out" title="Zoom out · Ctrl + mouse wheel"
        disabled={scale <= minimumPreviewZoom} onClick={() => onZoomChange(scaledPreviewZoom(scale, 1 / zoomStep))}
        className={buttonClass}>
        <Minus aria-hidden="true" />
      </Button>
      <span role="status" aria-live="polite" className="w-10 shrink-0 text-center text-xs font-semibold tabular-nums text-white/85">
        {Math.round(scale * 100)}%
      </span>
      <Button variant="ghost" size="icon" aria-label="Zoom in" title="Zoom in · Ctrl + mouse wheel"
        disabled={scale >= maximumPreviewZoom} onClick={() => onZoomChange(scaledPreviewZoom(scale, zoomStep))}
        className={buttonClass}>
        <Plus aria-hidden="true" />
      </Button>
      <Button variant="ghost" size="sm" aria-label="Actual size" title="Actual size"
        aria-pressed={zoom === 1} onClick={() => onZoomChange(1)}
        className={cn(buttonClass, "text-xs", zoom === 1 && selectedClass)}>100%</Button>
    </div>
  );
}

interface HeaderAction {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  pressed?: boolean;
}

function HeaderActions({ actions, compact }: { actions: HeaderAction[]; compact: boolean }) {
  if (!actions.length) return null;
  if (compact) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="Attachment actions" title="Attachment actions"
            className="h-11 w-11 shrink-0 text-white/80 hover:bg-white/10 hover:text-white focus-visible:ring-sky-400">
            <MoreHorizontal aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" sideOffset={4} className="border-white/10 bg-zinc-900 text-white">
          {actions.map(({ label, icon, onClick }) => (
            <DropdownMenuItem key={label} onSelect={onClick} className="min-h-11 gap-2">
              {icon}{label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }
  return (
    <div className="flex shrink-0 items-center gap-0.5" aria-label="Attachment actions">
      {actions.map(({ label, icon, onClick, pressed }) => (
        <Button key={label} variant="ghost" size="icon" onClick={onClick}
          aria-label={label} title={label} aria-pressed={pressed}
          className="h-11 w-11 text-white/80 hover:bg-white/10 hover:text-white focus-visible:ring-sky-400">
          {icon}
        </Button>
      ))}
    </div>
  );
}

function downloadAttachment(item: AttachmentItem) {
  if (!item.base64) return;
  const link = document.createElement('a');
  link.href = `data:${item.mimeType || 'application/octet-stream'};base64,${item.base64}`;
  link.download = item.title || 'attachment';
  link.click();
}

function HeaderBar({
  item, category, currentIndex, total, onClose, isPlaying, onTogglePlay, hasStepContext,
  maximized, onToggleMaximize, zoomControls, copyText, copyLabel, showSource, onToggleSource, jsonSearch,
}: {
  item: AttachmentItem;
  category: ContentCategory;
  currentIndex: number;
  total: number;
  onClose: () => void;
  isPlaying: boolean;
  onTogglePlay: () => void;
  hasStepContext: boolean;
  maximized: boolean;
  onToggleMaximize: () => void;
  zoomControls?: React.ComponentProps<typeof ZoomControls>;
  copyText: string | null;
  copyLabel: string;
  showSource: boolean;
  onToggleSource: () => void;
  jsonSearch?: JsonSearch;
}) {
  const { copied, copy, copyError } = useCopyToClipboard(currentIndex);
  const actions: HeaderAction[] = [];
  if (category === 'mermaid') {
    actions.push({
      label: showSource ? 'Show diagram' : 'View source',
      icon: <FileCode className="h-4 w-4" aria-hidden="true" />,
      onClick: onToggleSource,
      pressed: showSource,
    });
  }
  if (copyText !== null) {
    actions.push({
      label: copied ? 'Copied' : copyLabel,
      icon: copied ? <Check className="h-4 w-4 text-emerald-400" aria-hidden="true" />
        : <Copy className="h-4 w-4" aria-hidden="true" />,
      onClick: () => { void copy(copyText); },
    });
  }
  if (item.base64) {
    actions.push({
      label: 'Download',
      icon: <Download className="h-4 w-4" aria-hidden="true" />,
      onClick: () => downloadAttachment(item),
    });
  }
  if (hasStepContext && total > 1) {
    actions.push({
      label: isPlaying ? 'Pause slideshow' : 'Play slideshow',
      icon: isPlaying ? <Pause className="h-4 w-4" aria-hidden="true" />
        : <Play className="h-4 w-4" aria-hidden="true" />,
      onClick: onTogglePlay,
    });
  }

  return (
    <motion.header
      className="relative z-10 grid shrink-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-1 gap-y-1 border-b border-white/10 bg-zinc-950/95 px-2 py-1.5 sm:gap-x-2 sm:px-3"
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.08, duration: 0.25 }}
    >
      <div className="col-start-1 row-start-1 min-w-0">
        <AttachmentContentMetadata item={item} fallbackMimeType="application/octet-stream"
          position={total > 1 ? `${currentIndex + 1} / ${total}` : undefined} />
      </div>

      <div className="col-start-2 row-start-1 flex shrink-0 items-center justify-end gap-0.5">
        {jsonSearch && <JsonSearchPanel search={jsonSearch} />}
        <div className="hidden items-center gap-0.5 sm:flex">
          {zoomControls && <ZoomControls {...zoomControls} />}
          <HeaderActions actions={actions} compact={false} />
        </div>
        {!zoomControls && <div className="sm:hidden"><HeaderActions actions={actions} compact /></div>}
        <Button variant="ghost" size="icon" onClick={onToggleMaximize}
          className="h-11 w-11 rounded-lg text-white/80 hover:text-white hover:bg-white/10 focus-visible:ring-sky-400"
          aria-label={maximized ? 'Restore viewer' : 'Maximize viewer'} aria-pressed={maximized}
          title={maximized ? 'Restore viewer' : 'Maximize viewer'}>
          {maximized ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
        </Button>
        <DialogPrimitive.Close asChild>
          <Button variant="ghost" size="icon" aria-label="Close viewer" title="Close viewer"
            onClick={onClose}
            className="h-11 w-11 rounded-lg text-white/80 hover:text-white hover:bg-white/10 focus-visible:ring-sky-400">
            <X aria-hidden="true" />
          </Button>
        </DialogPrimitive.Close>
      </div>
      {item.stepIndex !== undefined && (
        <div className="col-span-2 min-w-0 border-t border-white/10 pt-1.5">
          <StepContext item={item} />
        </div>
      )}
      {zoomControls && (
        <div className="col-span-2 flex items-center justify-center gap-1 sm:hidden">
          <ZoomControls {...zoomControls} />
          <HeaderActions actions={actions} compact />
        </div>
      )}
      {copyError && <p role="alert" className="col-span-2 text-xs text-amber-300">{copyError}</p>}
    </motion.header>
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
  const [maximized, setMaximized] = useState(false);
  const [previewSize, setPreviewSize] = useState<PreviewSize>();
  const [previewViewportSize, setPreviewViewportSize] = useState<PreviewSize>();
  const [previewZoom, setPreviewZoom] = useState<number | null>(null);
  const [showMermaidSource, setShowMermaidSource] = useState(false);
  const changePreviewZoom = useCallback((value: number | null) => {
    setPreviewZoom(value === null ? null : clampPreviewZoom(value));
  }, []);
  const openerRef = useRef<HTMLElement | null>(null);
  const galleryRef = useRef<HTMLDivElement>(null);
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
      setMaximized(false);
      setPreviewSize(undefined);
      setPreviewViewportSize(undefined);
      setPreviewZoom(null);
      setShowMermaidSource(false);
    }
  }, [open, initialIndex, attachments]);

  // Check if we're crossing step boundary
  const current = attachments[currentIndex] ?? attachments[0];
  const category = current ? categorize(current) : 'binary';
  const mermaidSource = useMemo(
    () => category === 'mermaid' ? decodeMermaidSource(current.base64) : null,
    [category, current?.base64]
  );
  const jsonContent = useMemo(
    () => category === 'json' ? readJsonContent(current.base64) : undefined,
    [category, current?.base64]
  );
  const jsonSearch = useJsonSearch(jsonContent?.parsed ?? null, `${currentIndex}:${current?.base64 ?? ''}:${open}`);
  const textContent = useMemo(
    () => category === 'text' && current.base64 ? decodeBase64(current.base64) : '',
    [category, current?.base64]
  );
  const currentStepIndex = current?.stepIndex;
  const crossingStepBoundary = hasStepContext && 
    prevStepIndex !== undefined && 
    currentStepIndex !== undefined && 
    prevStepIndex !== currentStepIndex;

  const goNext = useCallback(() => {
    setShowMermaidSource(false);
    setPreviewSize(undefined);
    setPreviewViewportSize(undefined);
    setPreviewZoom(null);
    setPrevStepIndex(attachments[currentIndex]?.stepIndex);
    setDirection(1);
    setCurrentIndex((i) => (i + 1) % attachments.length);
  }, [attachments, currentIndex]);

  const goPrev = useCallback(() => {
    setShowMermaidSource(false);
    setPreviewSize(undefined);
    setPreviewViewportSize(undefined);
    setPreviewZoom(null);
    setPrevStepIndex(attachments[currentIndex]?.stepIndex);
    setDirection(-1);
    setCurrentIndex((i) => (i - 1 + attachments.length) % attachments.length);
  }, [attachments, currentIndex]);

  const goTo = useCallback((idx: number) => {
    setShowMermaidSource(false);
    setPreviewSize(undefined);
    setPreviewViewportSize(undefined);
    setPreviewZoom(null);
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
      if (e.defaultPrevented) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f'
          && jsonContent && !jsonContent.error && e.target instanceof Node
          && galleryRef.current?.contains(e.target)) {
        e.preventDefault();
        setIsPlaying(false);
        jsonSearch.setOpen(true);
        return;
      }
      if (e.target instanceof HTMLElement
          && e.target.closest('input, textarea, select, [contenteditable="true"], [aria-label="Search JSON"][role="dialog"]')) return;
      if (e.key.startsWith('Arrow') && e.target instanceof HTMLElement
          && e.target.closest('[aria-label="Mermaid diagram viewport"], [aria-label="Image viewport"]')) return;
      if (e.target instanceof HTMLElement && e.target.closest('[role="tree"]')) return;
      if (e.key === 'ArrowRight' && hasMultiple) { e.preventDefault(); goNext(); }
      if (e.key === 'ArrowLeft' && hasMultiple) { e.preventDefault(); goPrev(); }
      if (e.key === '[' && hasStepContext) { e.preventDefault(); jumpToPrevStep(); }
      if (e.key === ']' && hasStepContext) { e.preventDefault(); jumpToNextStep(); }
      if (e.key === ' ' && hasStepContext
        && !(e.target instanceof HTMLElement && e.target.closest('button, input, textarea, select, [contenteditable="true"]'))) {
        e.preventDefault();
        togglePlay();
      }
      if (e.key === 'Home') { e.preventDefault(); goToStart(); }
      if (e.key === 'End') { e.preventDefault(); goToEnd(); }
      if (!e.ctrlKey && !e.metaKey && (e.key === 'f' || e.key === 'F') && !(e.target instanceof HTMLElement
        && e.target.closest('input, textarea, select, [contenteditable="true"]'))) {
        e.preventDefault();
        setMaximized((value) => !value);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, hasMultiple, hasStepContext, goNext, goPrev, jumpToPrevStep, jumpToNextStep, togglePlay, goToStart, goToEnd, jsonContent, jsonSearch]);

  useEffect(() => {
    if (jsonSearch.open) setIsPlaying(false);
  }, [jsonSearch.open]);

  if (attachments.length === 0) return null;

  const navLabel = category === 'image' ? 'image' : 'attachment';
  const copyText = category === 'mermaid' ? mermaidSource
    : category === 'json' && current.base64 && jsonContent ? jsonContent.formatted
    : category === 'text' && current.base64 ? textContent
    : category === 'binary' ? current.base64 ?? null : null;
  const copyLabel = category === 'mermaid' ? 'Copy source'
    : category === 'binary' ? 'Copy Base64'
    : category === 'text' ? 'Copy text' : 'Copy';
  const fitScale = previewSize && previewViewportSize
    ? Math.min(category === 'mermaid' ? 3 : 1,
      (previewViewportSize.width - 32) / previewSize.width,
      (previewViewportSize.height - 32) / previewSize.height)
    : 1;
  const previewScale = previewZoom ?? Math.max(0.01, fitScale);
  const preview: ScalablePreviewProps = {
    size: previewSize,
    scale: previewScale,
    onSizeChange: setPreviewSize,
    onViewportChange: setPreviewViewportSize,
    onZoomChange: changePreviewZoom,
  };

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <AnimatePresence>
          {open && (
            <>
              {/* Overlay */}
              <DialogPrimitive.Overlay asChild forceMount>
                <motion.div
                  className={cn(
                    "fixed inset-0 z-50 backdrop-blur-sm",
                    maximized ? "bg-black" : "bg-black/85"
                  )}
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
                onOpenAutoFocus={() => {
                  if (document.activeElement instanceof HTMLElement) openerRef.current = document.activeElement;
                }}
                onCloseAutoFocus={(event) => {
                  event.preventDefault();
                  openerRef.current?.focus();
                  openerRef.current = null;
                }}
                onEscapeKeyDown={(event) => {
                  if (maximized) {
                    event.preventDefault();
                    setMaximized(false);
                  }
                }}
              >
                <motion.div
                  ref={galleryRef}
                  className={cn(
                    "fixed z-50 flex min-h-0 flex-col overflow-hidden bg-zinc-950 text-white",
                    maximized
                      ? "inset-0 h-dvh w-screen"
                      : "inset-4 m-auto h-[calc(100dvh-2rem)] max-h-[900px] w-[calc(100vw-2rem)] max-w-6xl rounded-xl shadow-2xl ring-1 ring-white/10"
                  )}
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
                  <DialogPrimitive.Description className="sr-only">
                    {current.stepIndex !== undefined &&
                      `${stepPosition(current.stepIndex, current.stepCount)}: ${current.stepKeyword || ''} ${current.stepTitle || ''}. `}
                    {current.stepStatus && `Status: ${current.stepStatus}. `}
                    {current.mimeType || 'Unknown file type'}.
                  </DialogPrimitive.Description>

                  {/* Header bar */}
                  <HeaderBar
                    item={current}
                    category={category}
                    currentIndex={currentIndex}
                    total={attachments.length}
                    onClose={() => onOpenChange(false)}
                    isPlaying={isPlaying}
                    onTogglePlay={togglePlay}
                    hasStepContext={hasStepContext}
                    maximized={maximized}
                    onToggleMaximize={() => setMaximized((value) => !value)}
                    copyText={copyText}
                    copyLabel={copyLabel}
                    showSource={showMermaidSource}
                    onToggleSource={() => setShowMermaidSource((value) => !value)}
                    jsonSearch={jsonContent && !jsonContent.error ? jsonSearch : undefined}
                    zoomControls={(category === 'image' || category === 'mermaid') && previewSize && previewViewportSize
                      ? { kind: category === 'mermaid' ? 'diagram' : 'image',
                          scale: previewScale, zoom: previewZoom, onZoomChange: changePreviewZoom }
                      : undefined}
                  />

                  {/* Content area — takes remaining space, content constrained to fit */}
                  <div
                    className={cn(
                      "flex-1 min-h-0 relative flex items-center justify-center overflow-hidden",
                      maximized ? "px-3 sm:px-14" : "px-2 sm:px-14"
                    )}
                    onClick={(e) => {
                      if (e.target === e.currentTarget) onOpenChange(false);
                    }}
                  >
                    {/* Navigation arrows — positioned within content area */}
                    {hasMultiple && (
                      <>
                        <NavArrow direction="prev" onClick={goPrev} label={`Previous ${navLabel}`} />
                        <NavArrow direction="next" onClick={goNext} label={`Next ${navLabel}`} />
                      </>
                    )}

                    {/* Main content */}
                    <AnimatePresence mode="wait" custom={direction}>
                      {category === 'image' && (
                        <ImageRenderer 
                          key={`img-${currentIndex}`} 
                          item={current} 
                          index={currentIndex} 
                          direction={direction}
                          crossingStepBoundary={crossingStepBoundary}
                          maximized={maximized}
                          preview={preview}
                        />
                      )}
                      {category === 'json' && jsonContent && (
                        <JsonRenderer 
                          key={`json-${currentIndex}`} 
                          content={jsonContent}
                          search={jsonSearch}
                          direction={direction}
                          crossingStepBoundary={crossingStepBoundary}
                          maximized={maximized}
                        />
                      )}
                      {category === 'text' && (
                        <TextRenderer 
                          key={`text-${currentIndex}`} 
                          text={textContent}
                          direction={direction}
                          crossingStepBoundary={crossingStepBoundary}
                          maximized={maximized}
                        />
                      )}
                      {category === 'mermaid' && (
                        <MermaidRenderer
                          key={`mermaid-${currentIndex}`}
                          item={current}
                          direction={direction}
                          crossingStepBoundary={crossingStepBoundary}
                          maximized={maximized}
                          preview={preview}
                          source={mermaidSource}
                          showSource={showMermaidSource}
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
                  </div>

                  {/* Auto-play progress bar — at very bottom */}
                  {isPlaying && (
                    <div className="shrink-0 flex justify-center px-16">
                      <motion.div 
                        className="w-full max-w-4xl h-1 bg-white/5 rounded-full overflow-hidden"
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
                    </div>
                  )}

                  {/* Film strip — always at bottom, never shrinks */}
                  {hasMultiple && (
                    <div
                      className={cn(
                        "shrink-0 flex justify-center px-4",
                        maximized ? "pb-3 pt-1" : "pb-4 pt-2"
                      )}
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
