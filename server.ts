

import 'dotenv/config';
import express, { Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  ServiceError,
  createLiveToken,
  generateHandoff,
  translateToEnglish,
} from './lib/clinical.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '10mb' }));


function fail(res: Response, error: unknown, fallback: string) {
  if (error instanceof ServiceError) {
    res.status(error.status).json({ error: error.message });
    return;
  }
  console.error(fallback, error);
  res.status(502).json({ error: fallback });
}

app.post('/api/live/token', async (_req: Request, res: Response) => {
  try {
    res.set('Cache-Control', 'no-store').json(await createLiveToken());
  } catch (error) {
    fail(res, error, 'Could not mint a Live API ephemeral token.');
  }
});

app.post('/api/intake/handoff', async (req: Request, res: Response) => {
  try {
    res.json({ handoff: await generateHandoff(req.body ?? {}) });
  } catch (error) {
    fail(res, error, 'Failed to generate handoff.');
  }
});

app.post('/api/intake/translate', async (req: Request, res: Response) => {
  const text = typeof req.body?.text === 'string' ? req.body.text : '';
  if (!text.trim()) {
    res.status(400).json({ error: 'Expected { text }.' });
    return;
  }
  res.json({ text: await translateToEnglish(text) });
});

async function startServer() {
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, () => {
    console.log(`NSOffice Live Health Intake server running on http://localhost:${PORT}`);
  });
}

startServer();
