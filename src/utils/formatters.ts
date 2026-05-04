export function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

export function formatTimeAgo(date: Date): string {
  const s = Math.round((Date.now() - date.getTime()) / 1000);
  if (s < 5) return 'Just now';
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  return `${Math.floor(m / 60)}h ago`;
}

export function formatMoisture(value: number): string {
  return `${value.toFixed(1)}%`;
}

export function formatTemperature(value: number): string {
  return `${value.toFixed(1)}°C`;
}
