import supabase from './client';
import { WinGoResult, PredictionSnapshot, BacktestResult, GameType } from '../shared/types';
import logger from '../logging/logger';

// ── Results ───────────────────────────────────────────────────

export async function insertResult(result: WinGoResult): Promise<boolean> {
  const { error } = await supabase.from('results').insert({
    game: result.game,
    issue_number: result.issueNumber,
    number: result.number,
    size: result.size,
    colors: result.colors,
    premium: result.premium,
    sum: result.sum,
    source_timestamp: result.sourceTimestamp,
    received_at: result.receivedAt || new Date().toISOString(),
  });

  if (error) {
    if (error.code === '23505') return false; // duplicate — silent ignore
    logger.warn(`DB insertResult warning: ${error.message}`);
    return false;
  }
  return true;
}

export async function getLatestResults(game: GameType, limit = 500): Promise<WinGoResult[]> {
  try {
    const { data, error } = await supabase
      .from('results')
      .select('*')
      .eq('game', game)
      .order('issue_number', { ascending: false })
      .limit(limit);

    if (error) { logger.debug(`DB getLatestResults: ${error.message}`); return []; }
    return (data || []).map(dbToResult);
  } catch {
    return [];
  }
}

export async function getResultsPage(
  game: GameType, page = 1, pageSize = 50
): Promise<{ results: WinGoResult[]; total: number }> {
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const { data, error, count } = await supabase
    .from('results')
    .select('*', { count: 'exact' })
    .eq('game', game)
    .order('issue_number', { ascending: false })
    .range(from, to);

  if (error) { logger.error(`DB getResultsPage: ${error.message}`); throw error; }

  return { results: (data || []).map(dbToResult), total: count || 0 };
}

export async function getLatestIssueNumber(game: GameType): Promise<string | null> {
  const { data, error } = await supabase
    .from('results')
    .select('issue_number')
    .eq('game', game)
    .order('issue_number', { ascending: false })
    .limit(1)
    .single();

  if (error && error.code !== 'PGRST116') {
    logger.error(`DB getLatestIssueNumber: ${error.message}`);
  }
  return data?.issue_number || null;
}

export async function countResults(game: GameType): Promise<number> {
  try {
    const { count, error } = await supabase
      .from('results')
      .select('*', { count: 'exact', head: true })
      .eq('game', game);

    if (error) { logger.debug(`DB countResults: ${error.message}`); return 0; }
    return count || 0;
  } catch {
    return 0;
  }
}

// ── Predictions ───────────────────────────────────────────────

export async function insertPrediction(pred: PredictionSnapshot): Promise<string | null> {
  const { data, error } = await supabase
    .from('prediction_snapshots')
    .insert({
      game: pred.game,
      target_issue: pred.targetIssue,
      generated_at: pred.generatedAt,
      big_probability: pred.bigProbability,
      small_probability: pred.smallProbability,
      red_probability: pred.redProbability,
      green_probability: pred.greenProbability,
      violet_probability: pred.violetProbability,
      number_probabilities: pred.numberProbabilities,
      top_number: pred.topNumber,
      top_color: pred.topColor,
      model_agreement: pred.modelAgreement,
      sample_size: pred.sampleSize,
      confidence_level: pred.confidenceLevel,
      signal_strength: pred.signalStrength,
      evidence: pred.evidence,
    })
    .select('id')
    .single();

  if (error) { logger.error(`DB insertPrediction: ${error.message}`); return null; }
  return data?.id || null;
}

export async function getLatestPrediction(game: GameType): Promise<PredictionSnapshot | null> {
  try {
    const { data, error } = await supabase
      .from('prediction_snapshots')
      .select('*')
      .eq('game', game)
      .order('generated_at', { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') logger.debug(`DB getLatestPrediction: ${error.message}`);
    return data ? dbToPrediction(data) : null;
  } catch {
    return null;
  }
}

export async function evaluatePrediction(
  predId: string,
  actualResult: WinGoResult
): Promise<void> {
  const { data: pred } = await supabase
    .from('prediction_snapshots')
    .select('top_number, top_color, big_probability')
    .eq('id', predId)
    .single();

  if (!pred) return;

  const bigCorrect = actualResult.size === 'BIG'
    ? pred.big_probability >= 0.5
    : pred.big_probability < 0.5;

  const colorCorrect = actualResult.colors.includes(pred.top_color as any);
  const numberCorrect = actualResult.number === pred.top_number;

  await supabase
    .from('prediction_snapshots')
    .update({
      actual_number: actualResult.number,
      actual_size: actualResult.size,
      actual_colors: actualResult.colors,
      evaluated_at: new Date().toISOString(),
      big_correct: bigCorrect,
      color_correct: colorCorrect,
      number_correct: numberCorrect,
    })
    .eq('id', predId);
}

// ── Source Status ─────────────────────────────────────────────

export async function updateSourceStatus(
  sourceName: string,
  status: string,
  lastPeriod?: string,
  errorMessage?: string
): Promise<void> {
  const update: Record<string, unknown> = {
    status,
    updated_at: new Date().toISOString(),
  };

  if (status === 'LIVE') {
    update.last_success = new Date().toISOString();
    update.consecutive_failures = 0;
    update.error_message = null;
    if (lastPeriod) update.last_period = lastPeriod;
  } else if (status === 'ERROR' || status === 'OFFLINE') {
    update.error_message = errorMessage || null;
  }

  update.last_fetch = new Date().toISOString();

  await supabase
    .from('source_status')
    .upsert({ source_name: sourceName, ...update }, { onConflict: 'source_name' });
}

export async function getSourceStatus(sourceName: string) {
  const { data } = await supabase
    .from('source_status')
    .select('*')
    .eq('source_name', sourceName)
    .single();
  return data;
}

// ── Backtest ──────────────────────────────────────────────────

export async function insertBacktestResult(result: BacktestResult): Promise<void> {
  await supabase.from('backtest_runs').insert({
    game: result.game,
    run_at: result.runAt,
    sample_size: result.sampleSize,
    big_small_accuracy: result.bigSmallAccuracy,
    color_accuracy: result.colorAccuracy,
    number_top1_accuracy: result.numberTop1Accuracy,
    avg_brier_score: result.avgBrierScore,
    calibration_score: result.calibrationScore,
    model_weights: result.modelWeights,
  });
}

export async function getLatestBacktest(game: GameType): Promise<BacktestResult | null> {
  const { data, error } = await supabase
    .from('backtest_runs')
    .select('*')
    .eq('game', game)
    .order('run_at', { ascending: false })
    .limit(1)
    .single();

  if (error && error.code !== 'PGRST116') return null;
  if (!data) return null;

  return {
    id: data.id,
    game: data.game,
    runAt: data.run_at,
    sampleSize: data.sample_size,
    bigSmallAccuracy: data.big_small_accuracy,
    colorAccuracy: data.color_accuracy,
    numberTop1Accuracy: data.number_top1_accuracy,
    avgBrierScore: data.avg_brier_score,
    calibrationScore: data.calibration_score,
    modelWeights: data.model_weights,
  };
}

// ── System Events ─────────────────────────────────────────────

export async function logEvent(type: string, data: unknown): Promise<void> {
  await supabase.from('system_events').insert({
    event_type: type,
    event_data: data,
    created_at: new Date().toISOString(),
  });
}

// ── Helpers ───────────────────────────────────────────────────

function dbToResult(row: Record<string, unknown>): WinGoResult {
  return {
    id: row.id as string,
    game: row.game as GameType,
    issueNumber: row.issue_number as string,
    number: row.number as number,
    size: row.size as 'BIG' | 'SMALL',
    colors: row.colors as ('red' | 'green' | 'violet')[],
    premium: row.premium as string,
    sum: row.sum as number,
    sourceTimestamp: row.source_timestamp as number,
    receivedAt: row.received_at as string,
    createdAt: row.created_at as string,
  };
}

function dbToPrediction(row: Record<string, unknown>): PredictionSnapshot {
  return {
    id: row.id as string,
    game: row.game as GameType,
    targetIssue: row.target_issue as string,
    generatedAt: row.generated_at as string,
    bigProbability: row.big_probability as number,
    smallProbability: row.small_probability as number,
    redProbability: row.red_probability as number,
    greenProbability: row.green_probability as number,
    violetProbability: row.violet_probability as number,
    numberProbabilities: row.number_probabilities as any,
    topNumber: row.top_number as number,
    topColor: row.top_color as any,
    modelAgreement: row.model_agreement as number,
    sampleSize: row.sample_size as number,
    confidenceLevel: row.confidence_level as any,
    signalStrength: row.signal_strength as number,
    evidence: row.evidence as string[],
    actualNumber: row.actual_number as number | undefined,
    actualSize: row.actual_size as any,
    actualColors: row.actual_colors as any,
    evaluatedAt: row.evaluated_at as string | undefined,
    bigCorrect: row.big_correct as boolean | undefined,
    colorCorrect: row.color_correct as boolean | undefined,
    numberCorrect: row.number_correct as boolean | undefined,
  };
}

// ── Backtest ──────────────────────────────────────────────────
export async function insertBacktestResult(result: BacktestResult): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('backtest_results')
      .insert({
        game: result.game,
        run_at: result.runAt,
        sample_size: result.sampleSize,
        big_small_accuracy: result.bigSmallAccuracy,
        color_accuracy: result.colorAccuracy,
        number_top1_accuracy: result.numberTop1Accuracy,
        avg_brier_score: result.avgBrierScore,
        calibration_score: result.calibrationScore,
        model_weights: result.modelWeights,
      });
    if (error) { logger.debug(`DB insertBacktestResult: ${error.message}`); return false; }
    return true;
  } catch {
    return false;
  }
}
