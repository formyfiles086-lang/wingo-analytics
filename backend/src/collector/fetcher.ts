import axios, { AxiosInstance } from 'axios';
import { RawWinGoResponse, GameType } from '../../shared/types';
import logger from '../logging/logger';
import dotenv from 'dotenv';
dotenv.config();

const GAME_URLS: Record<GameType, string> = {
  WinGo_30S: process.env.WINGO_30S_URL || 'https://draw.ar-lottery01.com/WinGo/WinGo_30S/GetHistoryIssuePage.json',
  WinGo_1M:  process.env.WINGO_1M_URL  || 'https://draw.ar-lottery01.com/WinGo/WinGo_1M/GetHistoryIssuePage.json',
  WinGo_3M:  'https://draw.ar-lottery01.com/WinGo/WinGo_3M/GetHistoryIssuePage.json',
  WinGo_5M:  'https://draw.ar-lottery01.com/WinGo/WinGo_5M/GetHistoryIssuePage.json',
};

const httpClient: AxiosInstance = axios.create({
  timeout: parseInt(process.env.FETCH_TIMEOUT_MS || '10000'),
  headers: {
    'Accept': 'application/json, text/plain, */*',
    'Accept-Encoding': 'gzip, deflate, br',
    'Origin': process.env.SOURCE_ORIGIN || 'https://pakgames.top',
    'Referer': process.env.SOURCE_REFERER || 'https://pakgames.top/',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
  },
  responseType: 'arraybuffer',  // get raw bytes, we decode manually
});

export interface FetchResult {
  success: boolean;
  data?: RawWinGoResponse;
  error?: string;
  statusCode?: number;
  responseSize?: number;
  fetchedAt: string;
}

export async function fetchWinGoHistory(
  game: GameType = 'WinGo_30S',
  pageNo = 1,
  pageSize = 10,
  retries = 3
): Promise<FetchResult> {
  const baseUrl = GAME_URLS[game];
  const ts = Date.now();
  const url = `${baseUrl}?ts=${ts}`;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      logger.debug(`Fetching ${game} page ${pageNo} (attempt ${attempt}): ${url}`);

      const response = await httpClient.get(url, {
        params: { pageNo, pageSize },
      });

      // Decode the response — it's JSON served as octet-stream
      const buffer: Buffer = Buffer.from(response.data);
      const text = buffer.toString('utf8');

      let parsed: RawWinGoResponse;
      try {
        parsed = JSON.parse(text);
      } catch {
        // Might be gzip-compressed
        const zlib = await import('zlib');
        const decompressed = await new Promise<Buffer>((resolve, reject) => {
          zlib.gunzip(buffer, (err, result) => {
            if (err) reject(err); else resolve(result);
          });
        });
        parsed = JSON.parse(decompressed.toString('utf8'));
      }

      if (parsed.code !== 0) {
        return {
          success: false,
          error: `API returned error code ${parsed.code}: ${parsed.msg}`,
          statusCode: response.status,
          fetchedAt: new Date().toISOString(),
        };
      }

      return {
        success: true,
        data: parsed,
        statusCode: response.status,
        responseSize: buffer.length,
        fetchedAt: new Date().toISOString(),
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.warn(`Fetch attempt ${attempt}/${retries} failed: ${msg}`);

      if (attempt < retries) {
        const backoff = parseInt(process.env.BACKOFF_BASE_MS || '2000') * attempt;
        logger.debug(`Retrying in ${backoff}ms...`);
        await sleep(backoff);
      } else {
        return {
          success: false,
          error: msg,
          fetchedAt: new Date().toISOString(),
        };
      }
    }
  }

  return { success: false, error: 'Max retries exceeded', fetchedAt: new Date().toISOString() };
}

// Fetch all available pages (up to maxPages)
export async function fetchAllHistory(
  game: GameType = 'WinGo_30S',
  maxPages = 50,
  pageSize = 10
): Promise<FetchResult[]> {
  const results: FetchResult[] = [];
  
  // Fetch page 1 to learn totalPage
  const first = await fetchWinGoHistory(game, 1, pageSize);
  results.push(first);

  if (!first.success || !first.data) return results;

  const totalPages = Math.min(first.data.data.totalPage, maxPages);
  logger.info(`Fetching ${totalPages} pages of ${game} history...`);

  for (let page = 2; page <= totalPages; page++) {
    const result = await fetchWinGoHistory(game, page, pageSize);
    results.push(result);
    await sleep(200); // polite delay
  }

  return results;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
