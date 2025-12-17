export function getApiBaseUrl(): string {
  if (typeof window !== 'undefined' && (window as any).__LIVEDOC_CONFIG__) {
    return (window as any).__LIVEDOC_CONFIG__.serverUrl || '';
  }
  return '';
}

export function getWsBaseUrl(): string {
  if (typeof window !== 'undefined' && (window as any).__LIVEDOC_CONFIG__) {
    const serverUrl = (window as any).__LIVEDOC_CONFIG__.serverUrl;
    if (serverUrl) {
      return serverUrl.replace(/^http/, 'ws');
    }
  }
  // Default to current origin but ws protocol
  if (typeof window !== 'undefined') {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${window.location.host}`;
  }
  return 'ws://localhost:3000';
}

export function isEmbedded(): boolean {
  if (typeof window !== 'undefined' && (window as any).__LIVEDOC_CONFIG__) {
    return (window as any).__LIVEDOC_CONFIG__.mode === 'embedded';
  }
  return false;
}
