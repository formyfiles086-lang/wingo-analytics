import { useState, useEffect, useCallback, useRef } from 'react';
import { api, createSSEConnection } from '../services/api';

// ── useStatus ─────────────────────────────────────────────────
export function useStatus() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    try {
      const d = await api.status();
      setData(d);
      setError(null);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetch();
    const t = setInterval(fetch, 30000);
    return () => clearInterval(t);
  }, [fetch]);

  return { data, loading, error, refetch: fetch };
}

// ── usePrediction ─────────────────────────────────────────────
export function usePrediction() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  const fetch = useCallback(async () => {
    try {
      const d = await api.latestPrediction();
      setData(d);
      setUpdatedAt(new Date());
      setError(null);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetch();
    const timer = setInterval(fetch, 10000); // refresh predictions every 10s
    return () => clearInterval(timer);
  }, [fetch]);

  return { data, loading, error, updatedAt, refetch: fetch };
}

// ── useResults ────────────────────────────────────────────────
export function useResults(limit = 50) {
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchResults = useCallback(() => {
    api.latestResults(limit)
      .then((d: any) => {
        setResults(d.results || d);
        setLoading(false);
        setError(null);
      })
      .catch((e: any) => {
        setError(String(e));
        setLoading(false);
      });
  }, [limit]);

  useEffect(() => {
    fetchResults();
    const interval = setInterval(fetchResults, 15000); // Polling every 15 seconds
    return () => clearInterval(interval);
  }, [fetchResults]);

  return { results, setResults, loading, error, refetch: fetchResults };
}

// ── useHistory ────────────────────────────────────────────────
export function useHistory() {
  const [results, setResults] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const loadPage = useCallback(async (p: number, append = false) => {
    setLoading(true);
    try {
      const d = await api.historyResults(p, 50);
      setTotal(d.total);
      setHasMore(p < d.totalPages);
      setResults(prev => append ? [...prev, ...(d.results || [])] : (d.results || []));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadPage(1); }, [loadPage]);

  const loadMore = () => {
    if (!loading && hasMore) {
      const next = page + 1;
      setPage(next);
      loadPage(next, true);
    }
  };

  return { results, total, loading, hasMore, loadMore };
}

// ── useSSE ────────────────────────────────────────────────────
export function useSSE(onNewResult?: (r: any) => void, onNewPrediction?: (p: any) => void) {
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const disconnect = createSSEConnection((type, data) => {
      if (type === 'connected') { setConnected(true); return; }
      if (type === 'heartbeat') return;
      if (type === 'new_result' && onNewResult) onNewResult(data);
      if (type === 'new_prediction' && onNewPrediction) onNewPrediction(data);
    });

    return () => { disconnect(); setConnected(false); };
  }, []);

  return { connected };
}

// ── usePatterns ───────────────────────────────────────────────
export function usePatterns() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.patterns().then(d => { setData(d); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  return { data, loading };
}

// ── useStatistics ─────────────────────────────────────────────
export function useStatistics() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.statistics().then(d => { setData(d); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  return { data, loading };
}
