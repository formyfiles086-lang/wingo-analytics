import { useStatistics } from '../hooks/useData';
import { formatPct } from '../utils/format';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';

export default function AnalysisPage() {
  const { data, loading } = useStatistics();

  if (loading) return (
    <div>
      <div className="app-header"><h1>Analysis</h1></div>
      <div className="loading-wrap"><div className="spinner" /><span>Loading statistics…</span></div>
    </div>
  );

  const windows = data?.windows || [];
  const gaps = data?.gaps;
  const totalResults = data?.totalResults || 0;

  return (
    <div>
      <div className="app-header">
        <h1>Analysis</h1>
        <span style={{ fontSize: 12, color: '#9898bb' }}>{totalResults} total</span>
      </div>

      {/* Rolling Windows Table */}
      {windows.length > 0 && (
        <>
          <div className="section-title">Rolling Window Analysis</div>
          <div className="card card-section" style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  <th style={{ padding: '6px 8px', color: '#5a5a7a', textAlign: 'left' }}>Window</th>
                  <th style={{ padding: '6px 4px', color: '#f59e0b', textAlign: 'center' }}>BIG</th>
                  <th style={{ padding: '6px 4px', color: '#60a5fa', textAlign: 'center' }}>SML</th>
                  <th style={{ padding: '6px 4px', color: '#ef4444', textAlign: 'center' }}>RED</th>
                  <th style={{ padding: '6px 4px', color: '#22c55e', textAlign: 'center' }}>GRN</th>
                  <th style={{ padding: '6px 4px', color: '#a855f7', textAlign: 'center' }}>VLT</th>
                </tr>
              </thead>
              <tbody>
                {windows.map((w: any) => (
                  <tr key={w.window} style={{ borderTop: '1px solid var(--border)' }}>
                    <td style={{ padding: '7px 8px', fontWeight: 700, fontFamily: 'JetBrains Mono' }}>Last {w.window}</td>
                    <td style={{ padding: '7px 4px', textAlign: 'center', color: '#f59e0b', fontFamily: 'JetBrains Mono', fontWeight: w.bigFreq > 0.53 ? 700 : 400 }}>{formatPct(w.bigFreq)}</td>
                    <td style={{ padding: '7px 4px', textAlign: 'center', color: '#60a5fa', fontFamily: 'JetBrains Mono', fontWeight: w.smallFreq > 0.53 ? 700 : 400 }}>{formatPct(w.smallFreq)}</td>
                    <td style={{ padding: '7px 4px', textAlign: 'center', color: '#ef4444', fontFamily: 'JetBrains Mono' }}>{formatPct(w.redFreq)}</td>
                    <td style={{ padding: '7px 4px', textAlign: 'center', color: '#22c55e', fontFamily: 'JetBrains Mono' }}>{formatPct(w.greenFreq)}</td>
                    <td style={{ padding: '7px 4px', textAlign: 'center', color: '#a855f7', fontFamily: 'JetBrains Mono' }}>{formatPct(w.violetFreq)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Number frequency chart */}
      {windows.length > 0 && windows[windows.length - 1]?.numberFreqs && (
        <>
          <div className="section-title">Number Distribution</div>
          <div className="card card-section">
            <ResponsiveContainer width="100%" height={160}>
              <BarChart
                data={Object.entries(windows[windows.length - 1].numberFreqs || {}).map(([n, f]) => ({
                  number: n, freq: parseFloat(((f as number) * 100).toFixed(1))
                }))}
                margin={{ top: 4, right: 4, left: -24, bottom: 0 }}
              >
                <XAxis dataKey="number" tick={{ fontSize: 11, fill: '#9898bb' }} />
                <YAxis tick={{ fontSize: 10, fill: '#5a5a7a' }} />
                <Tooltip
                  contentStyle={{ background: '#1a1a2e', border: '1px solid #333', borderRadius: 8, fontSize: 12 }}
                  formatter={(v: any) => [`${v}%`, 'Frequency']}
                />
                <ReferenceLine y={10} stroke="#333" strokeDasharray="3 3" />
                <Bar dataKey="freq" fill="#6366f1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
            <div style={{ fontSize: 11, color: '#5a5a7a', marginTop: 6 }}>
              Dashed line = expected frequency (10%). Bars above = higher occurrence.
            </div>
          </div>
        </>
      )}

      {/* Number gaps */}
      {gaps?.numberGaps && (
        <>
          <div className="section-title">Number Gap Analysis</div>
          <div className="card card-section">
            <div style={{ fontSize: 11, color: '#9898bb', marginBottom: 10 }}>
              Periods since each number last appeared (expected: ~10)
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
              {[0,1,2,3,4,5,6,7,8,9].map(n => {
                const gap = gaps.numberGaps[n] ?? 0;
                const hot = gap <= 5;
                const cold = gap >= 15;
                const color = cold ? 'var(--red)' : hot ? 'var(--green)' : 'var(--text-secondary)';
                return (
                  <div key={n} style={{
                    textAlign: 'center', padding: '10px 4px', borderRadius: 10,
                    background: cold ? 'rgba(239,68,68,0.08)' : hot ? 'rgba(34,197,94,0.08)' : 'var(--bg-card)',
                    border: `1px solid ${cold ? 'rgba(239,68,68,0.2)' : hot ? 'rgba(34,197,94,0.2)' : 'var(--border)'}`,
                  }}>
                    <div style={{ fontSize: 16, fontWeight: 800, color, fontFamily: 'JetBrains Mono' }}>{n}</div>
                    <div style={{ fontSize: 10, color, fontWeight: 600, marginTop: 2 }}>{gap}p</div>
                  </div>
                );
              })}
            </div>
            <div style={{ display: 'flex', gap: 12, marginTop: 10, fontSize: 11, color: '#9898bb' }}>
              <span><span style={{ color: 'var(--green)' }}>■</span> Hot (&lt;5)</span>
              <span><span style={{ color: 'var(--red)' }}>■</span> Cold (&gt;15)</span>
            </div>
          </div>
        </>
      )}

      {/* Statistical note */}
      <div className="card card-section" style={{ marginTop: 4 }}>
        <div style={{ fontSize: 11, color: '#5a5a7a', lineHeight: 1.6 }}>
          <strong style={{ color: '#9898bb' }}>Note on Independence</strong><br />
          Each WinGo draw is an independent random event. Patterns observed in historical data reflect statistical variance, not predictive certainty. The Law of Large Numbers applies — over thousands of draws, frequencies converge toward theoretical expectations, but individual outcomes remain unpredictable.
        </div>
      </div>

      <div style={{ height: 8 }} />
    </div>
  );
}
