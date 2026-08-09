// ============================================================
// SHARED TYPES — WinGo Analytics Platform
// ============================================================

export type GameType = 'WinGo_30S' | 'WinGo_1M' | 'WinGo_3M' | 'WinGo_5M';
export type SizeType = 'BIG' | 'SMALL';
export type ColorType = 'red' | 'green' | 'violet';
export type ConfidenceLevel = 'VERY_LOW' | 'LOW' | 'MEDIUM' | 'HIGH' | 'VERY_HIGH';
export type SourceStatus = 'LIVE' | 'OFFLINE' | 'STALE' | 'ERROR' | 'UNKNOWN';

// ── Raw API response from draw.ar-lottery01.com ──────────────
export interface RawWinGoResult {
  issueNumber: string;
  number: string;
  color: string;         // may be "red", "green", "red,violet", "green,violet"
  premium: string;
  sum: number;
}

export interface RawWinGoResponse {
  data: {
    list: RawWinGoResult[];
    pageNo: number;
    totalPage: number;
    totalCount: number;
  };
  code: number;
  msg: string;
  msgCode: number;
  serviceTime: number;
}

// ── Normalized result (stored in DB + used in app) ────────────
export interface WinGoResult {
  id?: string;
  game: GameType;
  issueNumber: string;
  number: number;
  size: SizeType;
  colors: ColorType[];          // array: [red], [green], [red, violet]
  premium: string;
  sum: number;
  sourceTimestamp?: number;
  receivedAt?: string;
  createdAt?: string;
}

// ── Prediction output ─────────────────────────────────────────
export interface NumberProbabilities {
  0: number; 1: number; 2: number; 3: number; 4: number;
  5: number; 6: number; 7: number; 8: number; 9: number;
}

export interface PredictionSnapshot {
  id?: string;
  game: GameType;
  targetIssue?: string;
  generatedAt: string;
  bigProbability: number;
  smallProbability: number;
  redProbability: number;
  greenProbability: number;
  violetProbability: number;
  numberProbabilities: NumberProbabilities;
  topNumber: number;
  topColor: ColorType;
  modelAgreement: number;
  sampleSize: number;
  confidenceLevel: ConfidenceLevel;
  signalStrength: number;
  evidence: string[];
  // Evaluation fields (filled after actual result comes in)
  actualNumber?: number;
  actualSize?: SizeType;
  actualColors?: ColorType[];
  evaluatedAt?: string;
  bigCorrect?: boolean;
  colorCorrect?: boolean;
  numberCorrect?: boolean;
}

// ── Pattern types ─────────────────────────────────────────────
export interface TransitionMatrix {
  [from: string]: { [to: string]: number };
}

export interface PatternObservation {
  patternType: string;
  patternKey: string;
  occurrences: number;
  nextOutcomes: { [outcome: string]: number };
  edge: number;          // edge vs expected probability
  significant: boolean;
}

export interface StreakInfo {
  type: string;
  value: string;
  length: number;
  probability: number;   // probability of continuing
}

export interface GapInfo {
  target: string;
  periodsAgo: number;
  expectedGap: number;
  deviation: number;
}

// ── Statistics ────────────────────────────────────────────────
export interface RollingStats {
  window: number;
  bigCount: number;
  smallCount: number;
  redCount: number;
  greenCount: number;
  violetCount: number;
  numberCounts: { [n: number]: number };
  bigFreq: number;
  smallFreq: number;
  redFreq: number;
  greenFreq: number;
  violetFreq: number;
}

export interface StatisticsReport {
  game: GameType;
  totalResults: number;
  windows: RollingStats[];
  currentStreak: StreakInfo;
  gaps: GapInfo[];
  transitionMatrix: { size: TransitionMatrix; color: TransitionMatrix };
  topPatterns: PatternObservation[];
  lastUpdated: string;
}

// ── Backtest ──────────────────────────────────────────────────
export interface BacktestResult {
  id?: string;
  game: GameType;
  runAt: string;
  sampleSize: number;
  bigSmallAccuracy: number;
  colorAccuracy: number;
  numberTop1Accuracy: number;
  avgBrierScore: number;
  calibrationScore: number;
  modelWeights: { [model: string]: number };
}

// ── System status ─────────────────────────────────────────────
export interface SystemHealth {
  dataSource: SourceStatus;
  database: 'OK' | 'ERROR';
  decoder: 'OK' | 'ERROR';
  patternEngine: 'OK' | 'ERROR' | 'BUILDING';
  predictionEngine: 'OK' | 'ERROR' | 'INSUFFICIENT_DATA';
  backtestEngine: 'OK' | 'ERROR' | 'NOT_RUN';
  api: 'OK' | 'ERROR';
  frontend: 'OK' | 'ERROR';
}

export interface SourceStatusInfo {
  sourceName: string;
  status: SourceStatus;
  lastFetch?: string;
  lastSuccess?: string;
  errorMessage?: string;
  consecutiveFailures: number;
  lastPeriod?: string;
  dataAge?: number;       // seconds since last result
}

export interface ApiStatusResponse {
  status: 'OK' | 'DEGRADED' | 'ERROR';
  timestamp: string;
  health: SystemHealth;
  source: SourceStatusInfo;
  totalResults: number;
  latestResult?: WinGoResult;
  latestPrediction?: PredictionSnapshot;
}

// ── SSE events ────────────────────────────────────────────────
export type SSEEventType =
  | 'new_result'
  | 'new_prediction'
  | 'source_status'
  | 'heartbeat';

export interface SSEEvent {
  type: SSEEventType;
  data: unknown;
  timestamp: string;
}
