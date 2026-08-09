import { useState, useEffect } from 'react';
import { api } from '../services/api';

export default function AdminPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshMsg, setRefreshMsg] = useState('');

  useEffect(() => {
    api.adminDebug()
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const r = await fetch('/api/admin/refresh', { method: 'POST' });
      const j = await r.json();
      setRefreshMsg(`Done: ${j.data?.newResults ?? 0} new results`);
    } catch (e) {
      setRefreshMsg(`Error: ${e}`);
    } finally {
      setRefreshing(false);
      setTimeout(() => setRefreshMsg(''), 3000);
    }
  };

  if (loading) return (
    <div>
      <div className="app-header"><h1>Admin</h1></div>
      <div className="loading-wrap"><div className="spinner" /></div>
    </div>
  );

  const memory = data?.memory;
  const mbUsed = memory ? Math.round(memory.heapUsed / 1024 / 1024) : null;
  const mbTotal = memory ? Math.round(memory.heapTotal / 1024 / 1024) : null;

  return (
    <div>
      <div className="app-header">
        <h1>🔧 Admin</h1>
        <span style={{ fontSize: 11, color: '#5a5a7a' }}>Debug Panel</span>
      </div>

      <div className="section-title">System</div>
      <div className="card card-section">
        {[
          ['Total Results', data?.totalResults ?? '—'],
          ['SSE Clients', data?.sseClients ?? 0],
          ['Uptime', data?.uptime ? `${Math.floor(data.uptime / 60)}m ${Math.floor(data.uptime % 60)}s` : '—'],
          ['Memory', mbUsed != null ? `${mbUsed}MB / ${mbTotal}MB` : '—'],
          ['Node Env', data?.env?.nodeEnv || '—'],
          ['Port', data?.env?.port || '—'],
          ['Poll Interval', data?.env?.pollInterval ? `${data.env.pollInterval}ms` : '—'],
        ].map(([k, v]) => (
          <div key={k} className="info-row">
            <span className="info-label">{k}</span>
            <span className="info-value">{String(v)}</span>
          </div>
        ))}
      </div>

      <div className="section-title">Collector</div>
      <div className="card card-section">
        {[
          ['Status', data?.collector?.isRunning ? 'Running' : 'Idle'],
          ['Last Issue', data?.collector?.lastKnownIssue || '—'],
          ['Failures', data?.collector?.consecutiveFailures ?? 0],
          ['Total Stored', data?.collector?.totalResultsStored ?? 0],
        ].map(([k, v]) => (
          <div key={k} className="info-row">
            <span className="info-label">{k}</span>
            <span className="info-value" style={{ color: k === 'Failures' && (v as number) > 0 ? 'var(--red)' : undefined }}>
              {String(v)}
            </span>
          </div>
        ))}
      </div>

      <div className="section-title">Data Source</div>
      <div className="card card-section">
        {[
          ['Status', data?.source?.status || '—'],
          ['Last Fetch', data?.source?.last_fetch ? new Date(data.source.last_fetch).toLocaleTimeString() : '—'],
          ['Last Success', data?.source?.last_success ? new Date(data.source.last_success).toLocaleTimeString() : '—'],
          ['Failures', data?.source?.consecutive_failures ?? 0],
          ['Last Period', data?.source?.last_period || '—'],
        ].map(([k, v]) => (
          <div key={k} className="info-row">
            <span className="info-label">{k}</span>
            <span className="info-value">{String(v)}</span>
          </div>
        ))}
      </div>

      <div style={{ padding: '0 12px 12px' }}>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          style={{
            width: '100%', padding: '14px', borderRadius: 12,
            background: refreshing ? 'var(--bg-card)' : 'var(--accent)',
            border: 'none', color: 'white', fontSize: 14, fontWeight: 700,
            cursor: refreshing ? 'not-allowed' : 'pointer',
            transition: 'all 0.2s',
          }}
        >
          {refreshing ? 'Polling…' : '🔄 Manual Poll Now'}
        </button>
        {refreshMsg && (
          <div style={{ marginTop: 8, fontSize: 12, color: '#22c55e', textAlign: 'center' }}>
            {refreshMsg}
          </div>
        )}
      </div>

      <div style={{ height: 8 }} />
    </div>
  );
}
