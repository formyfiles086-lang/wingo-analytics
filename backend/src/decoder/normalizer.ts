import { RawWinGoResult, WinGoResult, GameType, ColorType, SizeType } from '../shared/types';
import logger from '../logging/logger';

// ── Color mapping (verified from live data) ───────────────────
// 0 → red + violet
// 1,3,7,9 → green
// 2,4,6,8 → red
// 5 → green + violet

export function numberToColors(num: number): ColorType[] {
  if (num === 0) return ['red', 'violet'];
  if (num === 5) return ['green', 'violet'];
  if (num % 2 === 0) return ['red'];       // 2,4,6,8
  return ['green'];                         // 1,3,7,9
}

export function numberToSize(num: number): SizeType {
  return num >= 5 ? 'BIG' : 'SMALL';
}

// Parse the color string from API ("red,violet" → ['red','violet'])
function parseApiColors(colorStr: string): ColorType[] {
  return colorStr.split(',').map(c => c.trim().toLowerCase()) as ColorType[];
}

// ── Normalize a raw API result ────────────────────────────────
export function normalizeResult(
  raw: RawWinGoResult,
  game: GameType = 'WinGo_30S'
): WinGoResult | null {
  try {
    const num = parseInt(raw.number, 10);

    if (isNaN(num) || num < 0 || num > 9) {
      logger.warn(`Invalid number in result: ${raw.number} (issue: ${raw.issueNumber})`);
      return null;
    }

    if (!raw.issueNumber || raw.issueNumber.trim() === '') {
      logger.warn(`Missing issueNumber in result`);
      return null;
    }

    // Use API colors if available, otherwise derive
    const colors = raw.color
      ? parseApiColors(raw.color)
      : numberToColors(num);

    // Cross-verify
    const derivedColors = numberToColors(num);
    const apiColors = parseApiColors(raw.color || '');

    if (apiColors.length > 0 && !arraysMatchSorted(apiColors, derivedColors)) {
      logger.warn(
        `Color mismatch for number ${num}: API says "${raw.color}", derived says "${derivedColors.join(',')}". Using API value.`
      );
    }

    return {
      game,
      issueNumber: raw.issueNumber.trim(),
      number: num,
      size: numberToSize(num),
      colors,
      premium: raw.premium || String(num),
      sum: raw.sum || 0,
      receivedAt: new Date().toISOString(),
    };
  } catch (err) {
    logger.error(`normalizeResult error: ${err}`);
    return null;
  }
}

function arraysMatchSorted(a: string[], b: string[]): boolean {
  const sa = [...a].sort().join(',');
  const sb = [...b].sort().join(',');
  return sa === sb;
}

// ── Validate a normalized result ──────────────────────────────
export function validateResult(result: WinGoResult): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (result.number < 0 || result.number > 9) errors.push(`Invalid number: ${result.number}`);
  if (!['BIG', 'SMALL'].includes(result.size)) errors.push(`Invalid size: ${result.size}`);
  if (!result.colors || result.colors.length === 0) errors.push('Missing colors');
  if (!result.issueNumber || result.issueNumber.length < 5) errors.push('Invalid issueNumber');

  // Validate issueNumber format (should be numeric)
  if (!/^\d+$/.test(result.issueNumber)) errors.push(`Non-numeric issueNumber: ${result.issueNumber}`);

  // Cross-validate number → size
  const expectedSize = numberToSize(result.number);
  if (result.size !== expectedSize) {
    errors.push(`Size mismatch: number ${result.number} should be ${expectedSize}, got ${result.size}`);
  }

  return { valid: errors.length === 0, errors };
}
