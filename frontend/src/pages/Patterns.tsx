import { usePatterns } from '../hooks/useData';
import { formatPct } from '../utils/format';

export default function PatternsPage() {
  const { data, loading } = usePatterns();

  if (loading) return (
    <div>
      <div className="app-header"><h1>Patterns</h1></div>
      <div className="loading-wrap"><div className="spinner" /><span>Analyzing patterns…</span></div>
    </div>
  );

  if (!data) return (
    <div>
      <div className="app-header"><h1>Patterns</h1></div>
      <div className="error-wrap">No pattern data available yet. Data is still being collected.</div>
    </div>
  );

  const { transitions, gaps, recency, frequency, sampleSize } = data;

  return (
    <div>
      <div className="app-header">
        <h1>Patterns</h1>
        <span style={{ fontSize: 12, color: '#9898bb' }}>{sampleSize} samples</span>
      </div>

      {/* Current Streak */}
      {recency && (
        <>
          <div className="section-title">Current Streak</div>
          <div className="card-section" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div className="card" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 11, color: '#9898bb', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 }}>Size Streak</div>
              <div style={{ fontSize: 28, fontWeight: 800, color: recency.sizeStreak?.value === 'BIG' ? 'var(--big-color)' : 'var(--small-color)' }}>
                {recency.sizeStreak?.length}×
              </div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{recency.sizeStreak?.value}</div>
            </div>
            <div className="card" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 11, color: '#9898bb', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 }}>Color Streak</div>
              <div style={{ fontSize: 28, fontWeight: 800, color: `var(--${recency.colorStreak?.value})` }}>
                {recency.colorStreak?.length}×
              </div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{recency.colorStreak?.value}</div>
            </div>
          </div>
        </>
      )}

      {/* Size Transitions */}
      {transitions?.size && (
        <>
          <div className="section-title">Size Transition Matrix</div>
          <div className="card card-section">
            <TransitionGrid matrix={transitions.size} labels={['BIG', 'SMALL']} />
          </div>
        </>
      )}

      {/* Color Transitions */}
      {transitions?.color && (
        <>
          <div className="section-title">Color Transition Matrix</div>
          <div className="card card-section">
            <TransitionGrid matrix={transitions.color} labels={['red', 'green', 'violet']} />
          </div>
        </>
      )}

      {/* Overdue Numbers */}
      {gaps?.overdueNumbers && gaps.overdueNumbers.length > 0 && (
        <>
          <div className="section-title">Overdue Numbers</div>
          <div className="card card-section">
            <div style={{ fontSize: 11, color: '#9898bb', marginBottom: 10 }}>
              Numbers that haven't appeared recently (vs expected avg of 10 periods)
            </div>
            {gaps.overdueNumbers.slice(0, 5).map((g: any) => (
              <div key={g.number} className="info-row">
                <span className="info-label">Number {g.number}</span>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span style={{ fontSize: 11, color: '#9898bb' }}>Last seen {g.gapLength} periods ago</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--red)' }}>+{g.overdue}</span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Rolling Frequency (last 50) */}
      {frequency && (
        <>
          <div className="section-title">Rolling Frequency (last {frequency.window})</div>
          <div className="card card-section">
            <div style={{ marginBottom: 12 }}>
              <FreqBar label="BIG"    pct={frequency.bigFreq}    fill="#f59e0b" />
              <FreqBar label="SMALL"  pct={frequency.smallFreq}  fill="#60a5fa" />
              <FreqBar label="RED"    pct={frequency.redFreq}    fill="#ef4444" />
              <FreqBar label="GREEN"  pct={frequency.greenFreq}  fill="#22c55e" />
              <FreqBar label="VIOLET" pct={frequency.violetFreq} fill="#a855f7" />
            </div>
            <div style={{ fontSize: 11, color: '#5a5a7a' }}>
              Expected: BIG/SMALL ≈ 50% each · RED ≈ 45% · GREEN ≈ 45% · VIOLET ≈ 20%
            </div>
          </div>
        </>
      )}

      <div style={{ height: 8 }} />
    </div>
  );
}

function FreqBar({ label, pct, fill }: { label: string; pct: number; fill: string }) {
  return (
    <div className="prob-bar-wrap">
      <span className="prob-label" style={{ color: fill, fontSize: 12 }}>{label}</span>
      <div className="prob-bar-bg">
        <div className="prob-bar-fill" style={{ width: `${pct * 100}%`, background: fill }} />
      </div>
      <span className="prob-value" style={{ color: fill }}>{formatPct(pct)}</span>
    </div>
  );
}

function TransitionGrid({ matrix, labels }: { matrix: Record<string, Record<string, number>>; labels: string[] }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: '#9898bb', marginBottom: 8 }}>
        P(next → column | current row)
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr>
              <th style={{ padding: '4px 8px', color: '#5a5a7a', textAlign: 'left' }}>From ↓ To →</th>
              {labels.map(l => <th key={l} style={{ padding: '4px 8px', color: '#9898bb', textAlign: 'center' }}>{l}</th>)}
            </tr>
          </thead>
          <tbody>
            {labels.map(from => (
              <tr key={from} style={{ borderTop: '1px solid var(--border)' }}>
                <td style={{ padding: '6px 8px', fontWeight: 700, color: 'var(--text-primary)' }}>{from}</td>
                {labels.map(to => {
                  const prob = matrix[from]?.[to] ?? 0;
                  const highlight = prob > 0.55;
                  return (
                    <td key={to} style={{
                      padding: '6px 8px', textAlign: 'center',
                      fontFamily: 'JetBrains Mono', fontWeight: highlight ? 700 : 400,
                      color: highlight ? '#22c55e' : 'var(--text-secondary)',
                    }}>
                      {formatPct(prob)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
