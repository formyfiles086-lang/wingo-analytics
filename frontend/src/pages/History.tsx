import { useState } from 'react';
import { useHistory } from '../hooks/useData';
import { numberToColorClass, shortenIssue } from '../utils/format';

type Filter = 'ALL' | 'BIG' | 'SMALL' | 'RED' | 'GREEN' | 'VIOLET';

export default function HistoryPage() {
  const { results, total, loading, hasMore, loadMore } = useHistory();
  const [filter, setFilter] = useState<Filter>('ALL');

  const filtered = results.filter((r: any) => {
    if (filter === 'ALL') return true;
    if (filter === 'BIG') return r.size === 'BIG';
    if (filter === 'SMALL') return r.size === 'SMALL';
    return (r.colors || []).includes(filter.toLowerCase());
  });

  return (
    <div>
      <div className="app-header">
        <h1>History</h1>
        <span style={{ fontSize: 12, color: '#9898bb' }}>{total} results</span>
      </div>

      <div className="filter-tabs">
        {(['ALL','BIG','SMALL','RED','GREEN','VIOLET'] as Filter[]).map(f => (
          <button key={f} onClick={() => setFilter(f)} className={`filter-tab${filter === f ? ' active' : ''}`}>
            {f}
          </button>
        ))}
      </div>

      <div className="card card-section">
        {/* Table Header */}
        <div style={{ display: 'flex', padding: '6px 0 8px', borderBottom: '1px solid var(--border)' }}>
          <span style={{ fontSize: 11, color: '#5a5a7a', width: 36 }}>#</span>
          <span style={{ fontSize: 11, color: '#5a5a7a', flex: 1 }}>Period</span>
          <span style={{ fontSize: 11, color: '#5a5a7a' }}>Result</span>
        </div>

        {filtered.length === 0 && !loading ? (
          <div style={{ padding: '24px 0', textAlign: 'center', color: '#5a5a7a', fontSize: 13 }}>
            No results match this filter
          </div>
        ) : (
          filtered.map((r: any, i: number) => (
            <div key={r.issueNumber} className="history-row">
              <div className={`number-ball ${numberToColorClass(r.number)}`} style={{ width: 36, height: 36, fontSize: 15, flexShrink: 0 }}>
                {r.number}
              </div>
              <div className="history-period">{shortenIssue(r.issueNumber)}</div>
              <div className="history-badges">
                <span className={`size-badge ${r.size?.toLowerCase()}`}>{r.size}</span>
                {(r.colors || []).map((c: string) => (
                  <span key={c} className={`color-badge ${c}`}>{c[0].toUpperCase()}</span>
                ))}
              </div>
            </div>
          ))
        )}

        {loading && (
          <div className="loading-wrap" style={{ padding: '16px 0' }}>
            <div className="spinner" />
          </div>
        )}

        {hasMore && !loading && (
          <button
            onClick={loadMore}
            style={{
              width: '100%', padding: '12px', marginTop: 8,
              background: 'var(--bg-card)', border: '1px solid var(--border)',
              borderRadius: 10, color: 'var(--accent-light)', fontSize: 13,
              fontWeight: 600, cursor: 'pointer',
            }}
          >
            Load More
          </button>
        )}
      </div>
      <div style={{ height: 8 }} />
    </div>
  );
}
