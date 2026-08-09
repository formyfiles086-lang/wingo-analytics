const BACKEND_URL = import.meta.env.VITE_API_URL || 'https://wingo-analytics-production.up.railway.app';

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BACKEND_URL}${path}`);
  if (!res.ok) throw new Error(`API ${path} returned ${res.status}`);
  const json = await res.json();
  return json.data ?? json;
}

export const api = {
  health:          () => apiFetch<{ status: string }>('/api/health'),
  status:          () => apiFetch<any>('/api/status'),
  latestResults:   (limit = 20) => apiFetch<any>(`/api/results/latest?limit=${limit}`),
  historyResults:  (page = 1, pageSize = 50) => apiFetch<any>(`/api/results/history?page=${page}&pageSize=${pageSize}`),
  latestPrediction:() => apiFetch<any>('/api/prediction/latest'),
  patterns:        () => apiFetch<any>('/api/patterns'),
  statistics:      () => apiFetch<any>('/api/statistics'),
  backtest:        () => apiFetch<any>('/api/backtest/latest'),
  adminDebug:      () => apiFetch<any>('/api/admin/debug'),
};

export function createSSEConnection(onEvent: (type: string, data: unknown) => void): () => void {
  const url = `${BACKEND_URL}/api/events`;
  let source: EventSource;
  let retryTimeout: ReturnType<typeof setTimeout>;
  let alive = true;

  const connect = () => {
    source = new EventSource(url);
    source.onmessage = (e) => {
      try {
        const parsed = JSON.parse(e.data);
        onEvent(parsed.type, parsed.data);
      } catch {}
    };
    source.onerror = () => {
      source.close();
      if (alive) retryTimeout = setTimeout(connect, 5000);
    };
  };

  connect();

  return () => {
    alive = false;
    clearTimeout(retryTimeout);
    source?.close();
  };
}
