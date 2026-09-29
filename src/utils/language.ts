const ENGLISH_MARKERS = /\b(the|and|you|your|are|is|to|of|have|any|this|that|with|for|can|do|please|how|what|feel|pain)\b/gi;

export function looksEnglish(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return true;

  if (/[^\u0000-\u024F\u2000-\u206F\u20A0-\u20CF]/.test(trimmed)) return false;

  const hits = trimmed.match(ENGLISH_MARKERS)?.length ?? 0;
  const words = trimmed.split(/\s+/).length;
  return words < 4 ? true : hits >= 2;
}

export async function toEnglish(text: string): Promise<string> {
  try {
    const response = await fetch('/api/intake/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
    if (!response.ok) return text;
    const data = await response.json();
    return typeof data?.text === 'string' && data.text.trim() ? data.text.trim() : text;
  } catch {
    return text;
  }
}
