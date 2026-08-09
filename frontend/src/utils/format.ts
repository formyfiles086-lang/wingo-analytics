// Color utilities
export const COLOR_MAP: Record<string, string> = {
  red: '#ef4444',
  green: '#22c55e',
  violet: '#a855f7',
};

export function getPrimaryColor(colors: string[]): string {
  if (colors.includes('red')) return 'red';
  if (colors.includes('green')) return 'green';
  return 'violet';
}

export function numberToColorClass(num: number): string {
  if (num === 0 || num === 5) return 'violet';
  if ([1,3,7,9].includes(num)) return 'green';
  return 'red';
}

export function formatPct(val: number): string {
  return `${(val * 100).toFixed(1)}%`;
}

export function formatPctInt(val: number): string {
  return `${Math.round(val * 100)}%`;
}

export function shortenIssue(issue: string): string {
  if (!issue) return '';
  return issue.length > 12 ? issue.slice(-10) : issue;
}

export function confidenceColor(level: string): string {
  const map: Record<string, string> = {
    VERY_LOW: '#ef4444',
    LOW: '#f97316',
    MEDIUM: '#f59e0b',
    HIGH: '#22c55e',
    VERY_HIGH: '#6366f1',
  };
  return map[level] || '#9898bb';
}

export function timeAgo(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime();
  const secs = Math.floor(diff / 1000);
  if (secs < 60) return `${secs}s ago`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  return `${Math.floor(secs / 3600)}h ago`;
}
