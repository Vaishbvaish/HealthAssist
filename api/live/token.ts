import type { VercelRequest, VercelResponse } from '@vercel/node';
import { ServiceError, createLiveToken } from '../../lib/clinical.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  res.setHeader('Cache-Control', 'no-store');

  try {
    res.status(200).json(await createLiveToken());
  } catch (error) {
    if (error instanceof ServiceError) {
      res.status(error.status).json({ error: error.message });
      return;
    }
    console.error('Failed to mint Live API token:', error);
    res.status(502).json({ error: 'Could not mint a Live API ephemeral token.' });
  }
}
