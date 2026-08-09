import fs from 'fs';
import path from 'path';
import { WinGoResult } from '../shared/types';
import logger from '../logging/logger';

const DATA_DIR = path.join(process.cwd(), 'data');
const CACHE_FILE = path.join(DATA_DIR, 'results_cache.json');

let memoryStore: WinGoResult[] = [];

// Ensure data directory exists and load cached results from disk
export function initMemoryStore(): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    if (fs.existsSync(CACHE_FILE)) {
      const raw = fs.readFileSync(CACHE_FILE, 'utf8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        memoryStore = parsed;
        logger.info(`Loaded ${memoryStore.length} historical results from disk cache (${CACHE_FILE})`);
      }
    }
  } catch (err) {
    logger.warn(`Failed to read results disk cache: ${err}`);
  }
}

// Persist memory store to disk
function persistToDisk(): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(CACHE_FILE, JSON.stringify(memoryStore, null, 2), 'utf8');
  } catch (err) {
    logger.warn(`Failed to write results disk cache: ${err}`);
  }
}

export function addInMemoryResult(result: WinGoResult): boolean {
  if (memoryStore.some(r => r.issueNumber === result.issueNumber)) {
    return false;
  }
  memoryStore.unshift(result); // newest first
  if (memoryStore.length > 1000) memoryStore.pop(); // keep up to 1000 results
  persistToDisk();
  return true;
}

export function bulkAddInMemoryResults(results: WinGoResult[]): number {
  let added = 0;
  for (const r of results) {
    if (!memoryStore.some(existing => existing.issueNumber === r.issueNumber)) {
      memoryStore.push(r);
      added++;
    }
  }
  // Sort newest first
  memoryStore.sort((a, b) => b.issueNumber.localeCompare(a.issueNumber));
  if (memoryStore.length > 1000) memoryStore = memoryStore.slice(0, 1000);
  persistToDisk();
  return added;
}

export function getInMemoryResults(limit = 50): WinGoResult[] {
  return memoryStore.slice(0, limit);
}

export function countInMemoryResults(): number {
  return memoryStore.length;
}

// Initialize on module import
initMemoryStore();
