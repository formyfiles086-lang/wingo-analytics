import cron from 'node-cron';
import { fetchWinGoHistory, fetchAllHistory } from './fetcher';
import { normalizeResult, validateResult } from '../decoder/normalizer';
import { insertResult, updateSourceStatus, getLatestIssueNumber, countResults } from '../database/queries';
import { addInMemoryResult, bulkAddInMemoryResults, countInMemoryResults, getInMemoryResults } from '../database/memoryStore';
import { generateAndStorePrediction } from '../prediction/engine';
import { GameType, WinGoResult } from '../shared/types';
import { emitSSE } from '../api/sse';
import logger from '../logging/logger';

const SOURCE_NAME = 'draw.ar-lottery01.com/WinGo_30S';
const GAME: GameType = 'WinGo_30S';

let isRunning = false;
let lastKnownIssue: string | null = null;
let consecutiveFailures = 0;
let totalResultsStored = 0;

// ── Bootstrap: load all historical data ──────────────────────
export async function bootstrapHistory(): Promise<void> {
  logger.info('Bootstrap: checking cached and stored results...');
  const diskCount = countInMemoryResults();

  let dbCount = 0;
  try { dbCount = await countResults(GAME); } catch {}
  totalResultsStored = Math.max(diskCount, dbCount);
  lastKnownIssue = (getInMemoryResults(1)[0])?.issueNumber || await getLatestIssueNumber(GAME);

  if (totalResultsStored >= 100) {
    logger.info(`Bootstrap: ready instantly with ${totalResultsStored} historical results!`);
    if (totalResultsStored >= 20) {
      generateAndStorePrediction(GAME).catch(() => {});
    }
    return;
  }

  // Fetch full history asynchronously in background without blocking startup
  logger.info(`DB/disk has ${totalResultsStored} results — fetching full history in background...`);
  fetchAllHistory(GAME, 50, 10).then(async (pages) => {
    const toStore: WinGoResult[] = [];
    for (const page of pages) {
      if (!page.success || !page.data) continue;
      for (const raw of page.data.data.list) {
        const normalized = normalizeResult(raw, GAME);
        if (normalized && validateResult(normalized).valid) {
          toStore.push(normalized);
          insertResult(normalized).catch(() => {});
        }
      }
    }
    const added = bulkAddInMemoryResults(toStore);
    totalResultsStored = countInMemoryResults();
    lastKnownIssue = (getInMemoryResults(1)[0])?.issueNumber || lastKnownIssue;
    logger.info(`Background bootstrap complete: ${added} new results cached. Total: ${totalResultsStored}`);

    if (totalResultsStored >= 20) {
      await generateAndStorePrediction(GAME);
    }
  }).catch(err => logger.warn(`Background bootstrap error: ${err}`));
}

// ── Single poll cycle ─────────────────────────────────────────
export async function pollOnce(): Promise<{ newResults: WinGoResult[]; error?: string }> {
  if (isRunning) {
    logger.debug('Poll skipped — previous poll still running');
    return { newResults: [] };
  }

  isRunning = true;
  const newResults: WinGoResult[] = [];

  try {
    const fetchResult = await fetchWinGoHistory(GAME, 1, 10);

    if (!fetchResult.success || !fetchResult.data) {
      consecutiveFailures++;
      const msg = fetchResult.error || 'Unknown fetch error';
      logger.error(`Poll failed (${consecutiveFailures} consecutive): ${msg}`);

      await updateSourceStatus(SOURCE_NAME, 'ERROR', undefined, msg);
      emitSSE('source_status', { status: 'ERROR', error: msg, consecutiveFailures });

      return { newResults: [], error: msg };
    }

    consecutiveFailures = 0;
    const list = fetchResult.data.data.list;

    for (const raw of list) {
      const normalized = normalizeResult(raw, GAME);
      if (!normalized) continue;

      const { valid, errors } = validateResult(normalized);
      if (!valid) {
        logger.warn(`Skipping invalid result ${raw.issueNumber}: ${errors.join(', ')}`);
        continue;
      }

      const insertedMemory = addInMemoryResult(normalized);
      let insertedDb = false;
      try {
        insertedDb = await insertResult(normalized);
      } catch (e) {
        logger.warn(`DB store skipped: ${e}`);
      }

      if (insertedMemory || insertedDb) {
        newResults.push(normalized);
        totalResultsStored++;
        logger.info(`New result stored: Period ${normalized.issueNumber} | Number: ${normalized.number} | ${normalized.size} | ${normalized.colors.join('/')}`);
        emitSSE('new_result', normalized);
      }
    }

    // Update latest known issue
    if (list.length > 0) {
      const latestIssue = list[0].issueNumber;
      if (!lastKnownIssue || latestIssue > lastKnownIssue) {
        lastKnownIssue = latestIssue;
      }
    }

    await updateSourceStatus(SOURCE_NAME, 'LIVE', lastKnownIssue || undefined);

    // If we got new results, regenerate prediction
    if (newResults.length > 0 && totalResultsStored >= 20) {
      try {
        const prediction = await generateAndStorePrediction(GAME);
        if (prediction) emitSSE('new_prediction', prediction);
      } catch (err) {
        logger.error(`Prediction generation failed: ${err}`);
      }
    }

    if (newResults.length > 0) {
      logger.info(`Poll: ${newResults.length} new result(s) | Total: ${totalResultsStored}`);
    }

    return { newResults };
  } catch (err) {
    consecutiveFailures++;
    const msg = String(err);
    logger.error(`Poll exception: ${msg}`);
    await updateSourceStatus(SOURCE_NAME, 'ERROR', undefined, msg);
    return { newResults: [], error: msg };
  } finally {
    isRunning = false;
  }
}

// ── Start the scheduler ───────────────────────────────────────
export function startScheduler(): void {
  const intervalMs = parseInt(process.env.POLL_INTERVAL_MS || '30000');
  const intervalSec = Math.max(10, Math.floor(intervalMs / 1000));

  logger.info(`Starting WinGo collector (every ${intervalSec}s)`);

  // Run immediately
  pollOnce().catch(err => logger.error(`Initial poll error: ${err}`));

  // Then on cron schedule
  const cronExpr = `*/${intervalSec} * * * * *`;
  cron.schedule(cronExpr, async () => {
    await pollOnce();
  });

  logger.info('Scheduler started successfully');
}

export function getCollectorStatus() {
  return {
    isRunning,
    lastKnownIssue,
    consecutiveFailures,
    totalResultsStored,
  };
}
