-- ================================================================
-- WinGo Analytics Platform — Supabase Database Schema
-- Run this entire script in Supabase → SQL Editor → New Query
-- ================================================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── results ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS results (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  game         TEXT NOT NULL DEFAULT 'WinGo_30S',
  issue_number TEXT NOT NULL,
  number       INTEGER NOT NULL CHECK (number >= 0 AND number <= 9),
  size         TEXT NOT NULL CHECK (size IN ('BIG', 'SMALL')),
  colors       TEXT[] NOT NULL,
  premium      TEXT,
  sum          INTEGER DEFAULT 0,
  source_timestamp BIGINT,
  received_at  TIMESTAMPTZ DEFAULT NOW(),
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (game, issue_number)
);

CREATE INDEX IF NOT EXISTS idx_results_game_created ON results (game, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_results_issue ON results (issue_number);
CREATE INDEX IF NOT EXISTS idx_results_number ON results (number);

-- ── prediction_snapshots ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS prediction_snapshots (
  id                    UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  game                  TEXT NOT NULL DEFAULT 'WinGo_30S',
  target_issue          TEXT,
  generated_at          TIMESTAMPTZ DEFAULT NOW(),
  big_probability       FLOAT NOT NULL,
  small_probability     FLOAT NOT NULL,
  red_probability       FLOAT NOT NULL,
  green_probability     FLOAT NOT NULL,
  violet_probability    FLOAT NOT NULL,
  number_probabilities  JSONB NOT NULL,
  top_number            INTEGER,
  top_color             TEXT,
  model_agreement       FLOAT DEFAULT 0,
  sample_size           INTEGER DEFAULT 0,
  confidence_level      TEXT DEFAULT 'LOW',
  signal_strength       FLOAT DEFAULT 0,
  evidence              TEXT[],
  -- Evaluation (filled after actual result)
  actual_number         INTEGER,
  actual_size           TEXT,
  actual_colors         TEXT[],
  evaluated_at          TIMESTAMPTZ,
  big_correct           BOOLEAN,
  color_correct         BOOLEAN,
  number_correct        BOOLEAN
);

CREATE INDEX IF NOT EXISTS idx_predictions_game_generated ON prediction_snapshots (game, generated_at DESC);

-- ── pattern_observations ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS pattern_observations (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  game          TEXT NOT NULL DEFAULT 'WinGo_30S',
  pattern_type  TEXT NOT NULL,
  pattern_key   TEXT NOT NULL,
  occurrences   INTEGER DEFAULT 0,
  next_outcomes JSONB DEFAULT '{}',
  edge          FLOAT DEFAULT 0,
  significant   BOOLEAN DEFAULT FALSE,
  last_updated  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (game, pattern_type, pattern_key)
);

CREATE INDEX IF NOT EXISTS idx_patterns_game_type ON pattern_observations (game, pattern_type);

-- ── backtest_runs ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS backtest_runs (
  id                    UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  game                  TEXT NOT NULL DEFAULT 'WinGo_30S',
  run_at                TIMESTAMPTZ DEFAULT NOW(),
  sample_size           INTEGER,
  big_small_accuracy    FLOAT,
  color_accuracy        FLOAT,
  number_top1_accuracy  FLOAT,
  avg_brier_score       FLOAT,
  calibration_score     FLOAT,
  model_weights         JSONB DEFAULT '{}'
);

-- ── source_status ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS source_status (
  id                    UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  source_name           TEXT NOT NULL UNIQUE,
  last_fetch            TIMESTAMPTZ,
  last_success          TIMESTAMPTZ,
  status                TEXT DEFAULT 'UNKNOWN',
  error_message         TEXT,
  consecutive_failures  INTEGER DEFAULT 0,
  last_period           TEXT,
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

-- Seed default source
INSERT INTO source_status (source_name, status)
VALUES ('draw.ar-lottery01.com/WinGo_30S', 'UNKNOWN')
ON CONFLICT (source_name) DO NOTHING;

-- ── system_events ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS system_events (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_type  TEXT NOT NULL,
  event_data  JSONB,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_events_type_created ON system_events (event_type, created_at DESC);

-- ── RLS policies (disable for server-side use) ────────────────
ALTER TABLE results             DISABLE ROW LEVEL SECURITY;
ALTER TABLE prediction_snapshots DISABLE ROW LEVEL SECURITY;
ALTER TABLE pattern_observations DISABLE ROW LEVEL SECURITY;
ALTER TABLE backtest_runs       DISABLE ROW LEVEL SECURITY;
ALTER TABLE source_status       DISABLE ROW LEVEL SECURITY;
ALTER TABLE system_events       DISABLE ROW LEVEL SECURITY;

-- Done!
SELECT 'Schema created successfully' AS status;
