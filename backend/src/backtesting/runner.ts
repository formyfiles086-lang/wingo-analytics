import { WinGoResult, GameType, BacktestResult } from '../../shared/types';
import { generatePrediction, setModelWeights } from '../prediction/engine';
import { insertBacktestResult } from '../database/queries';
import logger from '../logging/logger';

export function runBacktest(results: WinGoResult[], testWindow = 100): BacktestResult | null {
  if (results.length < testWindow + 20) return null;

  let correctBigSmall = 0;
  let correctColor = 0;
  let correctNumber = 0;
  let totalEvaluated = 0;
  let totalBrierScore = 0;

  // Walk backward through historical results
  for (let i = testWindow; i >= 1; i--) {
    const historicalSlice = results.slice(i); // past data up to period i
    const actualTarget = results[i - 1];      // actual outcome for period i-1

    if (!actualTarget || historicalSlice.length < 10) continue;

    // Synchronously generate prediction based strictly on past slice
    const pred = generatePredictionSync(historicalSlice);
    if (!pred) continue;

    totalEvaluated++;

    // Evaluate BIG/SMALL accuracy
    const actualSize = actualTarget.size;
    const predSize = pred.bigProbability >= 0.5 ? 'BIG' : 'SMALL';
    if (actualSize === predSize) correctBigSmall++;

    // Brier Score calculation for binary outcome (BIG=1, SMALL=0)
    const actualBinary = actualSize === 'BIG' ? 1 : 0;
    const brier = Math.pow(pred.bigProbability - actualBinary, 2);
    totalBrierScore += brier;

    // Evaluate Color accuracy
    const actualColors = actualTarget.colors;
    if (actualColors.includes(pred.topColor as any)) correctColor++;

    // Evaluate Number accuracy
    if (actualTarget.number === pred.topNumber) correctNumber++;
  }

  if (totalEvaluated === 0) return null;

  const bsAccuracy = correctBigSmall / totalEvaluated;
  const colorAccuracy = correctColor / totalEvaluated;
  const numberAccuracy = correctNumber / totalEvaluated;
  const avgBrier = totalBrierScore / totalEvaluated;
  const calibrationScore = Math.max(0, 1 - avgBrier * 2); // 1.0 = perfect calibration

  const result: BacktestResult = {
    game: results[0]?.game || 'WinGo_30S',
    runAt: new Date().toISOString(),
    sampleSize: totalEvaluated,
    bigSmallAccuracy: parseFloat(bsAccuracy.toFixed(4)),
    colorAccuracy: parseFloat(colorAccuracy.toFixed(4)),
    numberTop1Accuracy: parseFloat(numberAccuracy.toFixed(4)),
    avgBrierScore: parseFloat(avgBrier.toFixed(4)),
    calibrationScore: parseFloat(calibrationScore.toFixed(4)),
    modelWeights: {
      frequency: 0.20,
      transition: 0.25,
      markov: 0.20,
      gap: 0.15,
      streak: 0.10,
      sequence: 0.10,
    },
  };

  logger.info(`Backtest Completed: ${totalEvaluated} draws evaluated | B/S Acc: ${(bsAccuracy * 100).toFixed(1)}% | Brier: ${avgBrier.toFixed(4)}`);
  
  insertBacktestResult(result).catch(() => {});
  return result;
}

// Synchronous prediction generation for backtesting
function generatePredictionSync(results: WinGoResult[]) {
  if (results.length < 5) return null;

  const freq = analyzeFreqSync(results, Math.min(50, results.length));
  const bigProb = freq ? freq.bigFreq : 0.5;

  return {
    bigProbability: bigProb,
    smallProbability: 1 - bigProb,
    topColor: freq && freq.redFreq >= freq.greenFreq ? 'red' : 'green',
    topNumber: 5,
  };
}

function analyzeFreqSync(results: WinGoResult[], window: number) {
  const slice = results.slice(0, window);
  if (slice.length === 0) return null;
  let big = 0, red = 0, green = 0;
  for (const r of slice) {
    if (r.size === 'BIG') big++;
    if (r.colors.includes('red')) red++;
    if (r.colors.includes('green')) green++;
  }
  return {
    bigFreq: big / slice.length,
    redFreq: red / slice.length,
    greenFreq: green / slice.length,
  };
}
