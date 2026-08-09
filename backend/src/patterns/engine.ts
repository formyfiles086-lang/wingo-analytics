import { WinGoResult, ColorType, SizeType } from '../shared/types';

// ── Module A: Frequency Analysis ──────────────────────────────
export function analyzeFrequency(results: WinGoResult[], window: number) {
  const slice = results.slice(0, window);
  const n = slice.length;
  if (n === 0) return null;

  const numberCounts: Record<number, number> = {};
  for (let i = 0; i <= 9; i++) numberCounts[i] = 0;

  let big = 0, small = 0, red = 0, green = 0, violet = 0;

  for (const r of slice) {
    numberCounts[r.number]++;
    if (r.size === 'BIG') big++; else small++;
    if (r.colors.includes('red')) red++;
    if (r.colors.includes('green')) green++;
    if (r.colors.includes('violet')) violet++;
  }

  return {
    window: n,
    bigFreq: big / n,
    smallFreq: small / n,
    redFreq: red / n,
    greenFreq: green / n,
    violetFreq: violet / n,
    numberFreqs: Object.fromEntries(
      Object.entries(numberCounts).map(([k, v]) => [k, v / n])
    ),
  };
}

// ── Module B: Recency & Streaks ───────────────────────────────
export function analyzeRecency(results: WinGoResult[]) {
  if (results.length === 0) return null;

  // Current streak (size)
  let sizeStreakLen = 1;
  const latestSize = results[0].size;
  for (let i = 1; i < results.length; i++) {
    if (results[i].size === latestSize) sizeStreakLen++;
    else break;
  }

  // Current streak (primary color)
  let colorStreakLen = 1;
  const latestPrimary = getPrimaryColor(results[0].colors);
  for (let i = 1; i < results.length; i++) {
    if (getPrimaryColor(results[i].colors) === latestPrimary) colorStreakLen++;
    else break;
  }

  // Recent pattern (last 5)
  const recent5 = results.slice(0, 5).map(r => ({
    n: r.number,
    s: r.size[0],
    c: r.colors[0][0].toUpperCase(),
  }));

  return {
    sizeStreak: { value: latestSize, length: sizeStreakLen },
    colorStreak: { value: latestPrimary, length: colorStreakLen },
    recent5,
    lastNumber: results[0].number,
    lastSize: results[0].size,
    lastColors: results[0].colors,
  };
}

// ── Module C: Transition Matrix ───────────────────────────────
export function buildTransitionMatrix(results: WinGoResult[], type: 'size' | 'color' | 'number') {
  const counts: Record<string, Record<string, number>> = {};
  const totals: Record<string, number> = {};

  const getValue = (r: WinGoResult): string => {
    if (type === 'size') return r.size;
    if (type === 'color') return getPrimaryColor(r.colors);
    return String(r.number);
  };

  // Results are newest-first, so prev is index i+1, next is index i
  for (let i = 0; i < results.length - 1; i++) {
    const prev = getValue(results[i + 1]);
    const next = getValue(results[i]);

    if (!counts[prev]) counts[prev] = {};
    if (!counts[prev][next]) counts[prev][next] = 0;
    counts[prev][next]++;

    totals[prev] = (totals[prev] || 0) + 1;
  }

  // Normalize to probabilities
  const matrix: Record<string, Record<string, number>> = {};
  for (const [prev, nexts] of Object.entries(counts)) {
    matrix[prev] = {};
    const total = totals[prev];
    for (const [next, count] of Object.entries(nexts)) {
      matrix[prev][next] = count / total;
    }
  }

  return matrix;
}

// Get probability of next outcome given current state
export function getTransitionProbability(
  matrix: Record<string, Record<string, number>>,
  currentState: string,
  targetState: string
): number {
  return matrix[currentState]?.[targetState] ?? 0;
}

// ── Module D: Run/Streak Analysis ─────────────────────────────
export function analyzeRuns(results: WinGoResult[]) {
  const sizes = results.map(r => r.size);
  const colors = results.map(r => getPrimaryColor(r.colors));

  const sizeRuns = findRuns(sizes);
  const colorRuns = findRuns(colors);

  // After a run of N, what's the probability of continuation vs reversal?
  const sizeContProb = computeContinuationProb(sizes);
  const colorContProb = computeContinuationProb(colors);

  return { sizeRuns, colorRuns, sizeContProb, colorContProb };
}

function findRuns(values: string[]): { value: string; length: number }[] {
  const runs: { value: string; length: number }[] = [];
  let i = 0;
  while (i < values.length) {
    let j = i;
    while (j < values.length && values[j] === values[i]) j++;
    runs.push({ value: values[i], length: j - i });
    i = j;
  }
  return runs;
}

function computeContinuationProb(values: string[]): number {
  let continues = 0, reverses = 0;
  for (let i = 1; i < values.length; i++) {
    if (values[i] === values[i - 1]) continues++;
    else reverses++;
  }
  const total = continues + reverses;
  return total > 0 ? continues / total : 0.5;
}

// ── Module E: Gap Analysis ────────────────────────────────────
export function analyzeGaps(results: WinGoResult[]) {
  const numberGaps: Record<number, number> = {};
  const sizeGaps: Record<string, number> = {};
  const colorGaps: Record<string, number> = {};

  // Initialize
  for (let i = 0; i <= 9; i++) numberGaps[i] = results.length; // assume not seen
  sizeGaps['BIG'] = results.length;
  sizeGaps['SMALL'] = results.length;
  colorGaps['red'] = results.length;
  colorGaps['green'] = results.length;
  colorGaps['violet'] = results.length;

  // Find last occurrence (results are newest-first)
  const foundNumbers = new Set<number>();
  const foundSizes = new Set<string>();
  const foundColors = new Set<string>();

  for (let i = 0; i < results.length; i++) {
    const r = results[i];

    if (!foundNumbers.has(r.number)) {
      numberGaps[r.number] = i;
      foundNumbers.add(r.number);
    }
    if (!foundSizes.has(r.size)) {
      sizeGaps[r.size] = i;
      foundSizes.add(r.size);
    }
    for (const c of r.colors) {
      if (!foundColors.has(c)) {
        colorGaps[c] = i;
        foundColors.add(c);
      }
    }

    if (foundNumbers.size === 10 && foundSizes.size === 2 && foundColors.size === 3) break;
  }

  // Expected gaps
  const expectedNumberGap = 10;  // on average every 10 periods
  const expectedSizeGap = 2;
  const expectedColorGap = results.length > 0 ? results.length / 3 : 3; // rough

  return {
    numberGaps,
    sizeGaps,
    colorGaps,
    overdueNumbers: Object.entries(numberGaps)
      .filter(([, g]) => g > expectedNumberGap)
      .sort(([, a], [, b]) => b - a)
      .map(([n, g]) => ({ number: parseInt(n), gapLength: g, overdue: g - expectedNumberGap })),
    overdueSize: Object.entries(sizeGaps)
      .filter(([, g]) => g > expectedSizeGap)
      .map(([s, g]) => ({ size: s, gapLength: g })),
  };
}

// ── Module F: Sequence Similarity ────────────────────────────
export function findSimilarSequences(
  results: WinGoResult[],
  sequenceLength = 5,
  minMatches = 3
) {
  if (results.length < sequenceLength + 1) return { matches: 0, nextOutcomes: {} };

  const recent = results.slice(0, sequenceLength).map(r => r.number);
  const nextOutcomes: Record<string, number> = {};
  let matches = 0;

  // Search historical sequences
  for (let i = sequenceLength; i < results.length - sequenceLength; i++) {
    const candidate = results.slice(i, i + sequenceLength).map(r => r.number);

    if (sequencesMatch(recent, candidate, sequenceLength)) {
      matches++;
      // Record what came after this historical sequence
      const after = results[i - 1]; // one period before (newest-first)
      if (after) {
        const key = `${after.number}:${after.size}:${after.colors[0]}`;
        nextOutcomes[key] = (nextOutcomes[key] || 0) + 1;
      }
    }
  }

  return { matches, nextOutcomes, minSampleMet: matches >= minMatches };
}

function sequencesMatch(a: number[], b: number[], len: number): boolean {
  for (let i = 0; i < len; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

// ── Module G2: 2nd-Order Markov Chain ─────────────────────────
export function buildSecondOrderMarkov(results: WinGoResult[], type: 'size' | 'color') {
  const counts: Record<string, Record<string, number>> = {};
  const getValue = (r: WinGoResult) => type === 'size' ? r.size : getPrimaryColor(r.colors);

  // Results are newest-first, so i+2 is 2 periods ago, i+1 is 1 period ago, i is target
  for (let i = 0; i < results.length - 2; i++) {
    const prev2 = getValue(results[i + 2]);
    const prev1 = getValue(results[i + 1]);
    const next = getValue(results[i]);
    const stateKey = `${prev2}->${prev1}`;

    if (!counts[stateKey]) counts[stateKey] = {};
    counts[stateKey][next] = (counts[stateKey][next] || 0) + 1;
  }

  // Normalize
  const matrix: Record<string, Record<string, number>> = {};
  for (const [key, nexts] of Object.entries(counts)) {
    matrix[key] = {};
    const total = Object.values(nexts).reduce((a, b) => a + b, 0);
    for (const [next, count] of Object.entries(nexts)) {
      matrix[key][next] = count / total;
    }
  }
  return matrix;
}

// ── Module H2: Chi-Square Goodness-of-Fit Anomaly Test ───────
export function computeChiSquareAnomaly(results: WinGoResult[], window = 50) {
  const slice = results.slice(0, window);
  if (slice.length < window) return { chiSquareScore: 0, isAnomaly: false };

  let observedBig = 0;
  for (const r of slice) {
    if (r.size === 'BIG') observedBig++;
  }
  const expectedBig = window / 2;
  const expectedSmall = window / 2;
  const observedSmall = window - observedBig;

  // Chi-Square formula: SUM((O - E)^2 / E)
  const chiSquare = Math.pow(observedBig - expectedBig, 2) / expectedBig +
                    Math.pow(observedSmall - expectedSmall, 2) / expectedSmall;

  // Critical value for 1 degree of freedom at p=0.05 is 3.841
  return {
    chiSquareScore: parseFloat(chiSquare.toFixed(4)),
    isAnomaly: chiSquare > 3.841,
    observedRatio: `${observedBig}B / ${observedSmall}S`,
  };
}

// ── Module H: Rolling Windows ─────────────────────────────────
export function computeRollingWindows(results: WinGoResult[], windows = [10, 20, 50, 100, 200, 500]) {
  return windows
    .filter(w => w <= results.length)
    .map(w => analyzeFrequency(results, w))
    .filter(Boolean);
}

// ── Helpers ───────────────────────────────────────────────────
export function getPrimaryColor(colors: ColorType[]): string {
  // If red+violet, primary is red; if green+violet, primary is green
  if (colors.includes('red')) return 'red';
  if (colors.includes('green')) return 'green';
  return 'violet';
}

// Normalize probabilities to sum to 1.0
export function normalizeProbabilities(probs: Record<string, number>): Record<string, number> {
  const total = Object.values(probs).reduce((a, b) => a + b, 0);
  if (total === 0) return probs;
  return Object.fromEntries(
    Object.entries(probs).map(([k, v]) => [k, v / total])
  );
}
