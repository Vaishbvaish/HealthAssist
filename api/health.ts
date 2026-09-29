import type { VercelRequest, VercelResponse } from '@vercel/node';
import { LIVE_MODEL, TEXT_MODEL, createLiveToken, geminiApiKey } from '../lib/clinical.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const key = geminiApiKey();
  const base = {
    ok: true,
    node: process.version,
    region: process.env.VERCEL_REGION ?? null,
    env: process.env.VERCEL_ENV ?? 'local',
    keyPresent: key.length > 0,
    keyLength: key.length,
    liveModel: LIVE_MODEL,
    textModel: TEXT_MODEL,
  };

  if (req.query.probe !== '1') {
    res.status(200).json(base);
    return;
  }

  const started = Date.now();
  try {
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('probe timed out after 15s')), 15_000)
    );
    await Promise.race([createLiveToken(), timeout]);
    res.status(200).json({ ...base, probe: 'ok', probeMs: Date.now() - started });
  } catch (error) {
    res.status(200).json({
      ...base,
      probe: 'failed',
      probeMs: Date.now() - started,
      probeError: error instanceof Error ? error.message : String(error),
    });
  }
}
