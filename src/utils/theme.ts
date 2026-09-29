

const FALLBACKS: Record<string, string> = {
  '--color-accent': '#0062FF',
  '--color-accent-tint': '#7FB0FF',
  '--color-critical': '#FF453A',
  '--color-caution': '#FF9F0A',
  '--color-hairline-strong': '#2A364E',
  '--color-surface-sunken': '#1A2333',
};

const cache = new Map<string, string>();


export function token(name: keyof typeof FALLBACKS | string): string {
  const hit = cache.get(name);
  if (hit) return hit;

  let value = '';
  if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }

  const resolved = value || FALLBACKS[name] || '#0062FF';
  if (value) cache.set(name, resolved);
  return resolved;
}
