import type { VercelRequest, VercelResponse } from '@vercel/node';
import { ServiceError, generateHandoff, type HandoffRequest } from '../../lib/clinical.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  let body: HandoffRequest;
  if (typeof req.body === 'string') {
    try {
      body = JSON.parse(req.body) as HandoffRequest;
    } catch {
      res.status(400).json({ error: 'Expected a JSON body.' });
      return;
    }
  } else if (req.body && typeof req.body === 'object') {
    body = req.body as HandoffRequest;
  } else {
    res.status(400).json({ error: 'Expected a JSON body.' });
    return;
  }

  try {
    res.status(200).json({ handoff: await generateHandoff(body) });
  } catch (error) {
    if (error instanceof ServiceError) {
      res.status(error.status).json({ error: error.message });
      return;
    }
    console.error('Error generating handoff:', error);
    res.status(502).json({ error: 'Failed to generate handoff.' });
  }
}
