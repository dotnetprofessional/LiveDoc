export const DEFAULT_SIDEBAR_WIDTH = 280;
export const MIN_SIDEBAR_WIDTH = 240;
export const MAX_SIDEBAR_WIDTH = 600;
export const MIN_CONTENT_WIDTH = 480;
export const SIDEBAR_DIVIDER_WIDTH = 12;
export const SIDEBAR_WIDTH_KEY = 'livedoc.viewer.sidebarWidth';

export function clampSidebarWidth(width: number): number {
  return Number.isFinite(width)
    ? Math.min(MAX_SIDEBAR_WIDTH, Math.max(MIN_SIDEBAR_WIDTH, width))
    : DEFAULT_SIDEBAR_WIDTH;
}

export function getInitialSidebarWidth(): number {
  try {
    const stored = localStorage.getItem(SIDEBAR_WIDTH_KEY);
    return stored === null ? DEFAULT_SIDEBAR_WIDTH : clampSidebarWidth(Number(stored));
  } catch {
    return DEFAULT_SIDEBAR_WIDTH;
  }
}
