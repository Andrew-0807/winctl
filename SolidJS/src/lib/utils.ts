/**
 * Escape HTML special characters to prevent XSS
 */
export function escHtml(s: unknown): string {
  return String(s)
    .replace(/&/g, '&')
    .replace(/</g, '<')
    .replace(/>/g, '>')
    .replace(/"/g, '"');
}

/**
 * Format bytes to human-readable string
 */
export function formatBytes(b: number, dec: number = 1): string {
  if (b < 1024) return b + ' B';
  if (b < 1024 ** 2) return (b / 1024).toFixed(dec) + ' KB';
  if (b < 1024 ** 3) return (b / 1024 ** 2).toFixed(dec) + ' MB';
  return (b / 1024 ** 3).toFixed(dec) + ' GB';
}

/**
 * Format seconds to human-readable uptime string
 */
export function formatUptime(s: number): string {
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${Math.floor((s % 3600) / 60)}m`;
  return `${Math.floor(s / 60)}m`;
}

/**
 * Format ISO date string to relative time (e.g., "5m ago")
 */
export function timeAgo(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return s + 's';
  if (s < 3600) return Math.floor(s / 60) + 'm';
  if (s < 86400) return Math.floor(s / 3600) + 'h';
  return Math.floor(s / 86400) + 'd';
}

/**
 * RGB to Hex color converter
 */
export function rgbToHex(color: string): string {
  if (color.startsWith('#')) return color.slice(0, 7);
  return '#000000';
}

/**
 * Debounce function
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}
