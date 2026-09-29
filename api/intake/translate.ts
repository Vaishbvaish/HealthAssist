import type { VercelRequest, VercelResponse } from '@vercel/node';
import { translateToEnglish } from '../../lib/clinical.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const body = typeof req.body === 'string' ? safeParse(req.body) : req.body;
  const text = typeof body?.text === 'string' ? body.text : '';
  if (!text.trim()) {
    res.status(400).json({ error: 'Expected { text }.' });
    return;
  }

  res.status(200).json({ text: await translateToEnglish(text) });
}

function safeParse(raw: string): any {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
