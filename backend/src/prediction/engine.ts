import { WinGoResult, PredictionSnapshot, NumberProbabilities, GameType, ConfidenceLevel, ColorType } from '../shared/types';
import {
  analyzeFrequency, analyzeRecency, buildTransitionMatrix,
  analyzeRuns, analyzeGaps, findSimilarSequences,
  getPrimaryColor, normalizeProbabilities
} from '../patterns/engine';
import { getLatestResults, insertPrediction } from '../database/queries';
import logger from '../logging/logger';

// ── Model weights (will be updated by backtesting) ───────────
let modelWeights = {
  frequency: 0.20,
  transition: 0.25,
  markov:     0.20,
  gap:        0.15,
  streak:     0.10,
  sequence:   0.10,
};

export function setModelWeights(weights: typeof modelWeights) {
  modelWeights = weights;
}

// ── Main prediction engine ────────────────────────────────────
export async function generatePrediction(
  results: WinGoResult[],
  game: GameType = 'WinGo_30S'
): Promise<PredictionSnapshot | null> {
  if (results.length < 5) {
    logger.warn(`Insufficient data for prediction: ${results.length} results (need 5+)`);
    return null;
  }

  const evidence: string[] = [];

  // ── Size probabilities ──────────────────────────────────────
  let bigScore = 0, smallScore = 0;
  const modelBigScores: number[] = [];

  // Model 1: Frequency (last 50)
  const freq50 = analyzeFrequency(results, Math.min(50, results.length));
  if (freq50) {
    const freqBig = freq50.bigFreq;
    const freqSmall = freq50.smallFreq;
    bigScore += freqBig * modelWeights.frequency;
    smallScore += freqSmall * modelWeights.frequency;
    modelBigScores.push(freqBig);
    evidence.push(`rolling frequency (${results.length} samples)`);
  }

  // Model 2b: 2nd-Order Markov (last 2 states)
  if (results.length >= 3) {
    const { buildSecondOrderMarkov } = require('../patterns/engine');
    const markov2 = buildSecondOrderMarkov(results, 'size');
    const stateKey = `${results[1].size}->${results[0].size}`;
    const markov2BigProb = markov2[stateKey]?.['BIG'] ?? 0.5;
    bigScore += markov2BigProb * modelWeights.markov;
    smallScore += (1 - markov2BigProb) * modelWeights.markov;
    modelBigScores.push(markov2BigProb);
    evidence.push(`2nd-order Markov chain (${stateKey})`);
  }

  // Model 3: Streak — if long streak, mean-reversion signal
  const recency = analyzeRecency(results);
  if (recency) {
    const streakLen = recency.sizeStreak.length;
    const streakBig = recency.sizeStreak.value === 'BIG' ? 1 : 0;
    // After long streak, slightly favor reversal
    const reversionBias = Math.min(0.1, (streakLen - 1) * 0.02);
    const streakBigProb = streakBig === 1
      ? Math.max(0.3, 0.5 - reversionBias)
      : Math.min(0.7, 0.5 + reversionBias);
    bigScore += streakBigProb * modelWeights.streak;
    smallScore += (1 - streakBigProb) * modelWeights.streak;
    modelBigScores.push(streakBigProb);
    if (streakLen >= 3) evidence.push(`streak analysis (${streakLen} ${recency.sizeStreak.value})`);
  }

  // Model 4: Gap analysis
  const gaps = analyzeGaps(results);
  const bigGap = gaps.sizeGaps['BIG'] ?? 0;
  const smallGap = gaps.sizeGaps['SMALL'] ?? 0;
  const totalGap = bigGap + smallGap || 1;
  const gapBigProb = bigGap > smallGap ? 0.6 : 0.4;
  bigScore += gapBigProb * modelWeights.gap;
  smallScore += (1 - gapBigProb) * modelWeights.gap;
  modelBigScores.push(gapBigProb);

  // Normalize size
  const sizeTotal = bigScore + smallScore;
  const bigProb = bigScore / sizeTotal;
  const smallProb = smallScore / sizeTotal;

  // ── Color probabilities ──────────────────────────────────────
  const colorMatrix = buildTransitionMatrix(results, 'color');
  const currentColor = getPrimaryColor(results[0].colors);
  const freq100 = analyzeFrequency(results, Math.min(100, results.length));

  let redScore = freq100?.redFreq ?? 0.45;
  let greenScore = freq100?.greenFreq ?? 0.45;
  let violetScore = freq100?.violetFreq ?? 0.10;

  // Blend with transition
  redScore = redScore * 0.5 + (colorMatrix[currentColor]?.['red'] ?? redScore) * 0.5;
  greenScore = greenScore * 0.5 + (colorMatrix[currentColor]?.['green'] ?? greenScore) * 0.5;
  violetScore = violetScore * 0.5 + (colorMatrix[currentColor]?.['violet'] ?? violetScore) * 0.5;

  const colorNorm = normalizeProbabilities({ red: redScore, green: greenScore, violet: violetScore });
  evidence.push('color transition model');

  // ── Number probabilities ─────────────────────────────────────
  const numberMatrix = buildTransitionMatrix(results, 'number');
  const currentNum = String(results[0].number);
  const freq200 = analyzeFrequency(results, Math.min(200, results.length));

  const numberProbs: Record<string, number> = {};
  for (let i = 0; i <= 9; i++) {
    const freqP = freq200?.numberFreqs[i] ?? 0.1;
    const transP = numberMatrix[currentNum]?.[String(i)] ?? 0.1;
    const gapWeight = Math.min(1.5, 1 + (gaps.numberGaps[i] - 10) * 0.02);
    numberProbs[String(i)] = (freqP * 0.4 + transP * 0.4) * gapWeight;
  }

  const normNumProbs = normalizeProbabilities(numberProbs);
  const topNum = parseInt(
    Object.entries(normNumProbs).sort(([, a], [, b]) => b - a)[0][0]
  );

  evidence.push('number frequency deviation');

  // Sequence similarity
  const seqResult = findSimilarSequences(results, 5, 3);
  if (seqResult.matches >= 3) {
    evidence.push(`historical similarity (${seqResult.matches} matches)`);
  }

  // ── Model agreement ──────────────────────────────────────────
  const bigVotes = modelBigScores.filter(s => s > 0.5).length;
  const modelAgreement = Math.abs(bigVotes / modelBigScores.length - 0.5) * 2;

  // ── Confidence level ─────────────────────────────────────────
  const sampleSize = results.length;
  let confidence: ConfidenceLevel;
  if (sampleSize < 50 || modelAgreement < 0.3) confidence = 'VERY_LOW';
  else if (sampleSize < 100 || modelAgreement < 0.5) confidence = 'LOW';
  else if (sampleSize < 200 || modelAgreement < 0.65) confidence = 'MEDIUM';
  else if (sampleSize < 400 || modelAgreement < 0.8) confidence = 'HIGH';
  else confidence = 'VERY_HIGH';

  const topColor = Object.entries(colorNorm).sort(([, a], [, b]) => b - a)[0][0] as ColorType;

  const prediction: PredictionSnapshot = {
    game,
    generatedAt: new Date().toISOString(),
    bigProbability: parseFloat(bigProb.toFixed(4)),
    smallProbability: parseFloat(smallProb.toFixed(4)),
    redProbability: parseFloat(colorNorm.red.toFixed(4)),
    greenProbability: parseFloat(colorNorm.green.toFixed(4)),
    violetProbability: parseFloat(colorNorm.violet.toFixed(4)),
    numberProbabilities: Object.fromEntries(
      Object.entries(normNumProbs).map(([k, v]) => [k, parseFloat(v.toFixed(4))])
    ) as NumberProbabilities,
    topNumber: topNum,
    topColor,
    modelAgreement: parseFloat(modelAgreement.toFixed(4)),
    sampleSize,
    confidenceLevel: confidence,
    signalStrength: parseFloat((modelAgreement * (sampleSize / 500)).toFixed(4)),
    evidence,
  };

  logger.info(
    `Prediction: BIG=${(bigProb * 100).toFixed(1)}% | ` +
    `RED=${(colorNorm.red * 100).toFixed(1)}% ` +
    `GREEN=${(colorNorm.green * 100).toFixed(1)}% | ` +
    `Top#${topNum} | Agreement=${(modelAgreement * 100).toFixed(1)}%`
  );

  return prediction;
}

// ── Generate and store in DB ──────────────────────────────────
export async function generateAndStorePrediction(game: GameType): Promise<PredictionSnapshot | null> {
  let results = [];
  try {
    results = await getLatestResults(game, 500);
  } catch {}
  
  if (results.length === 0) {
    const { getInMemoryResults } = await import('../database/memoryStore');
    results = getInMemoryResults(500);
  }

  const prediction = await generatePrediction(results, game);
  if (!prediction) return null;

  try {
    const id = await insertPrediction(prediction);
    if (id) prediction.id = id;
  } catch (e) {
    logger.warn(`DB prediction store skipped: ${e}`);
  }

  return prediction;
}
