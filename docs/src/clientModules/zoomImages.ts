import mediumZoom from 'medium-zoom';
import type { Zoom } from 'medium-zoom';
import ExecutionEnvironment from '@docusaurus/ExecutionEnvironment';

let zoom: Zoom | null = null;

function applyZoom() {
  if (zoom) zoom.detach();

  zoom = mediumZoom('article img, .hero-screenshots img', {
    margin: 24,
    background: 'rgba(0, 0, 0, 0.85)',
    scrollOffset: 0,
  });
}

if (ExecutionEnvironment.canUseDOM) {
  // Apply on initial load
  setTimeout(applyZoom, 500);

  // Re-apply on client-side navigation
  const observer = new MutationObserver(() => {
    setTimeout(applyZoom, 300);
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });
}
