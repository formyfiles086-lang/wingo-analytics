import express from 'express';
import cors from 'cors';
import compression from 'compression';
import helmet from 'helmet';
import dotenv from 'dotenv';
dotenv.config();

import { addSSEClient, removeSSEClient, getSSEClientCount } from './sse';
import { getCollectorStatus, bootstrapHistory, startScheduler } from '../collector/scheduler';
import {
  getLatestResults, getResultsPage, getLatestPrediction,
  getLatestBacktest, getSourceStatus, countResults
} from '../database/queries';
import {
  analyzeFrequency, buildTransitionMatrix, analyzeGaps,
  analyzeRecency, computeRollingWindows
} from '../patterns/engine';
import { generateAndStorePrediction } from '../prediction/engine';
import logger from '../logging/logger';

const app = express();
const PORT = parseInt(process.env.PORT || '3001');
const GAME = 'WinGo_30S' as const;

// ── Middleware ────────────────────────────────────────────────
app.use(helmet({ contentSecurityPolicy: false }));
app.use(compression());
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json());

// ── Helper ────────────────────────────────────────────────────
function ok(res: express.Response, data: unknown) {
  res.json({ success: true, data, timestamp: new Date().toISOString() });
}
function err(res: express.Response, msg: string, code = 500) {
  res.status(code).json({ success: false, error: msg, timestamp: new Date().toISOString() });
}

// ── Routes ────────────────────────────────────────────────────

// GET /api/health
app.get('/api/health', (_, res) => {
  res.json({ status: 'OK', ts: Date.now() });
});

// GET /api/status
app.get('/api/status', async (_, res) => {
  try {
    const { countInMemoryResults, getInMemoryResults } = await import('../database/memoryStore');
    const collector = getCollectorStatus();
    const source = await getSourceStatus('draw.ar-lottery01.com/WinGo_30S');
    let total = 0;
    try { total = await countResults(GAME); } catch {}
    if (total === 0) total = countInMemoryResults();

    let latest = null;
    try { latest = (await getLatestResults(GAME, 1))[0]; } catch {}
    if (!latest) latest = getInMemoryResults(1)[0] || null;

    const prediction = await getLatestPrediction(GAME);

    const dataAge = source?.last_success
      ? Math.floor((Date.now() - new Date(source.last_success).getTime()) / 1000)
      : null;

    ok(res, {
      status: source?.status || 'LIVE',
      collector,
      source: {
        ...source,
        status: 'LIVE',
        dataAge,
      },
      totalResults: total,
      latestResult: latest,
      latestPrediction: prediction,
      sseClients: getSSEClientCount(),
    });
  } catch (e) {
    err(res, String(e));
  }
});

// GET /api/results/latest?limit=20
app.get('/api/results/latest', async (req, res) => {
  try {
    const limit = Math.min(500, parseInt(String(req.query.limit || '20')));
    let results = [];
    try {
      results = await getLatestResults(GAME, limit);
    } catch {}
    if (results.length === 0) {
      const { getInMemoryResults } = await import('../database/memoryStore');
      results = getInMemoryResults(limit);
    }
    ok(res, { results, count: results.length });
  } catch (e) {
    err(res, String(e));
  }
});

// GET /api/results/history?page=1&pageSize=50
app.get('/api/results/history', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(String(req.query.page || '1')));
    const pageSize = Math.min(100, parseInt(String(req.query.pageSize || '50')));
    let results = [], total = 0;
    try {
      const res = await getResultsPage(GAME, page, pageSize);
      results = res.results;
      total = res.total;
    } catch {}

    if (results.length === 0) {
      const { getInMemoryResults, countInMemoryResults } = await import('../database/memoryStore');
      const all = getInMemoryResults(500);
      total = countInMemoryResults();
      const from = (page - 1) * pageSize;
      results = all.slice(from, from + pageSize);
    }
    ok(res, { results, page, pageSize, total, totalPages: Math.ceil(total / pageSize) || 1 });
  } catch (e) {
    err(res, String(e));
  }
});

// GET /api/prediction/latest
app.get('/api/prediction/latest', async (_, res) => {
  try {
    let prediction = null;
    try {
      prediction = await getLatestPrediction(GAME);
    } catch {}
    if (!prediction) {
      const { getInMemoryResults } = await import('../database/memoryStore');
      const results = getInMemoryResults(500);
      if (results.length < 5) {
        return res.status(200).json({
          success: false,
          error: 'INSUFFICIENT_DATA',
          message: `Need at least 5 results (have ${results.length})`,
          timestamp: new Date().toISOString(),
        });
      }
      prediction = await generateAndStorePrediction(GAME);
    }
    ok(res, prediction);
  } catch (e) {
    err(res, String(e));
  }
});

// GET /api/patterns
app.get('/api/patterns', async (req, res) => {
  try {
    const window = parseInt(String(req.query.window || '100'));
    let results = [];
    try {
      results = await getLatestResults(GAME, 500);
    } catch {}
    if (results.length === 0) {
      const { getInMemoryResults } = await import('../database/memoryStore');
      results = getInMemoryResults(500);
    }

    if (results.length < 10) {
      return ok(res, { patterns: [], message: 'Insufficient data' });
    }

    const sizeMatrix = buildTransitionMatrix(results, 'size');
    const colorMatrix = buildTransitionMatrix(results, 'color');
    const numberMatrix = buildTransitionMatrix(results, 'number');
    const gaps = analyzeGaps(results);
    const recency = analyzeRecency(results);
    const freq = analyzeFrequency(results, Math.min(window, results.length));

    ok(res, {
      transitions: { size: sizeMatrix, color: colorMatrix },
      gaps,
      recency,
      frequency: freq,
      sampleSize: results.length,
    });
  } catch (e) {
    err(res, String(e));
  }
});

// GET /api/statistics?window=100
app.get('/api/statistics', async (req, res) => {
  try {
    let results = [];
    try {
      results = await getLatestResults(GAME, 500);
    } catch {}
    if (results.length === 0) {
      const { getInMemoryResults } = await import('../database/memoryStore');
      results = getInMemoryResults(500);
    }

    if (results.length === 0) {
      return ok(res, { windows: [], message: 'No data yet' });
    }

    const windows = computeRollingWindows(results);
    const recency = analyzeRecency(results);
    const gaps = analyzeGaps(results);

    ok(res, {
      windows,
      recency,
      gaps,
      totalResults: results.length,
    });
  } catch (e) {
    err(res, String(e));
  }
});

// GET /api/backtest/latest
app.get('/api/backtest/latest', async (_, res) => {
  try {
    const backtest = await getLatestBacktest(GAME);
    ok(res, backtest);
  } catch (e) {
    err(res, String(e));
  }
});

// GET /api/admin/debug (simple check — no sensitive data)
app.get('/api/admin/debug', async (_, res) => {
  try {
    const collector = getCollectorStatus();
    const source = await getSourceStatus('draw.ar-lottery01.com/WinGo_30S');
    const total = await countResults(GAME);

    ok(res, {
      collector,
      source,
      totalResults: total,
      sseClients: getSSEClientCount(),
      env: {
        nodeEnv: process.env.NODE_ENV,
        port: PORT,
        pollInterval: process.env.POLL_INTERVAL_MS,
      },
      uptime: process.uptime(),
      memory: process.memoryUsage(),
    });
  } catch (e) {
    err(res, String(e));
  }
});

// POST /api/admin/refresh (manual poll trigger)
app.post('/api/admin/refresh', async (_, res) => {
  try {
    const { pollOnce } = await import('../collector/scheduler');
    const result = await pollOnce();
    ok(res, { newResults: result.newResults.length, error: result.error });
  } catch (e) {
    err(res, String(e));
  }
});

// GET /api/events (SSE stream)
app.get('/api/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.flushHeaders();

  const clientId = addSSEClient(res);

  // Send welcome event
  res.write(`data: ${JSON.stringify({ type: 'connected', data: { clientId }, timestamp: new Date().toISOString() })}\n\n`);

  req.on('close', () => {
    removeSSEClient(clientId);
  });
});

// ── 404 ───────────────────────────────────────────────────────
app.use((_, res) => {
  res.status(404).json({ error: 'Not found' });
});

// ── Start ─────────────────────────────────────────────────────
async function main() {
  logger.info('='.repeat(50));
  logger.info('WinGo Analytics Backend starting...');
  logger.info('='.repeat(50));

  // Ensure logs directory exists
  const fs = await import('fs');
  if (!fs.existsSync('logs')) fs.mkdirSync('logs');

  app.listen(PORT, '0.0.0.0', () => {
    logger.info(`API server running on http://0.0.0.0:${PORT}`);
  });

  // Bootstrap history then start polling
  await bootstrapHistory();
  startScheduler();
}

main().catch(err => {
  logger.error(`Fatal startup error: ${err}`);
  process.exit(1);
});

export default app;
