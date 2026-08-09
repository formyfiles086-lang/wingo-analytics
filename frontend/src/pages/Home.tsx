import { useState, useEffect } from 'react';
import { useStatus, usePrediction, useResults, useSSE } from '../hooks/useData';
import { formatPct, numberToColorClass, confidenceColor, timeAgo, shortenIssue } from '../utils/format';

export default function HomePage() {
  const [selectedGame, setSelectedGame] = useState<'WinGo_30S' | 'WinGo_1M' | 'WinGo_3M' | 'WinGo_5M'>('WinGo_30S');
  const [soundEnabled, setSoundEnabled] = useState(false);
  const { data: status } = useStatus();
  const { data: pred, loading: predLoading, refetch: refetchPred } = usePrediction();
  const { results, setResults } = useResults(10);
  const [pulseNum, setPulseNum] = useState(false);
  const [newResultFlash, setNewResultFlash] = useState<any>(null);

  // Play audio chime on new high-confidence predictions if enabled
  const playChime = () => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5 note
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.15);
    } catch {}
  };

  const { connected } = useSSE(
    (newResult) => {
      setResults(prev => [newResult, ...prev].slice(0, 10));
      setNewResultFlash(newResult);
      setPulseNum(true);
      if (soundEnabled) playChime();
      setTimeout(() => setPulseNum(false), 500);
      setTimeout(() => setNewResultFlash(null), 3000);
      setTimeout(() => refetchPred(), 1500);
    },
    () => { refetchPred(); }
  );

  const srcStatus = status?.source?.status || status?.status || 'LIVE';
  const totalResults = status?.totalResults || 0;

  return (
    <div>
      {/* Header */}
      <div className="app-header">
        <h1>WinGo Analytics</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            style={{
              background: soundEnabled ? 'rgba(99,102,241,0.2)' : 'var(--bg-card)',
              border: `1px solid ${soundEnabled ? 'var(--accent)' : 'var(--border)'}`,
              borderRadius: 8, padding: '4px 8px', fontSize: 12, cursor: 'pointer',
              color: soundEnabled ? 'var(--accent-light)' : 'var(--text-muted)'
            }}
            title="Toggle Sound Alerts"
          >
            {soundEnabled ? '🔔' : '🔕'}
          </button>
          <span className={`status-badge ${srcStatus === 'LIVE' ? 'live' : srcStatus === 'ERROR' ? 'offline' : 'stale'}`}>
            <span className="status-dot" />
            {srcStatus}
          </span>
        </div>
      </div>

      {/* Game Speed Variant Selector */}
      <div className="filter-tabs" style={{ padding: '10px 12px 2px' }}>
        {[
          { id: 'WinGo_30S', label: '⚡ 30 Sec' },
          { id: 'WinGo_1M',  label: '⏱️ 1 Min' },
          { id: 'WinGo_3M',  label: '⏳ 3 Min' },
          { id: 'WinGo_5M',  label: '🕐 5 Min' },
        ].map(g => (
          <button
            key={g.id}
            onClick={() => setSelectedGame(g.id as any)}
            className={`filter-tab${selectedGame === g.id ? ' active' : ''}`}
          >
            {g.label}
          </button>
        ))}
      </div>

      {/* New result flash */}
      {newResultFlash && (
        <div style={{
          margin: '8px 12px', padding: '10px 14px', borderRadius: 12,
          background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.3)',
          display: 'flex', alignItems: 'center', gap: 10,
          animation: 'pulse-in 0.3s ease'
        }}>
          <span style={{ fontSize: 11, color: '#9898bb' }}>NEW RESULT</span>
          <div className={`number-ball ${numberToColorClass(newResultFlash.number)}`}>
            {newResultFlash.number}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              <span className={`size-badge ${newResultFlash.size?.toLowerCase()}`}>{newResultFlash.size}</span>
              {(newResultFlash.colors || []).map((c: string) => (
                <span key={c} className={`color-badge ${c}`}>{c}</span>
              ))}
            </div>
            <div style={{ fontSize: 10, color: '#5a5a7a', marginTop: 2, fontFamily: 'JetBrains Mono' }}>
              #{shortenIssue(newResultFlash.issueNumber)}
            </div>
          </div>
        </div>
      )}

      {/* Disclaimer */}
      <div className="disclaimer">
        ⚠️ <strong>Statistical Analysis Only</strong> — Probabilities are based on historical patterns. Results are random. No prediction is guaranteed. This tool does not place bets.
      </div>

      {/* Prediction Header */}
      <div className="section-title">Next Round Probability</div>

      {predLoading ? (
        <div className="loading-wrap"><div className="spinner" /><span>Computing probabilities…</span></div>
      ) : pred?.error === 'INSUFFICIENT_DATA' ? (
        <div className="card card-section">
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{ fontSize: 24, marginBottom: 8 }}>⏳</div>
            <div style={{ fontWeight: 600 }}>Collecting Data…</div>
            <div style={{ fontSize: 12, color: '#9898bb', marginTop: 4 }}>Need 20+ results to generate predictions</div>
            <div style={{ fontSize: 11, color: '#5a5a7a', marginTop: 8 }}>{totalResults} results collected so far</div>
          </div>
        </div>
      ) : pred ? (
        <>
          {/* BIG / SMALL */}
          <div className="card-section">
            <div className="bs-grid">
              <div className={`bs-card big${pred.bigProbability > pred.smallProbability ? ' leader' : ''}`}>
                <div className="bs-label">BIG</div>
                <div className="bs-prob">{formatPct(pred.bigProbability)}</div>
                <div style={{ fontSize: 10, color: '#f59e0b', marginTop: 4, opacity: 0.7 }}>5 – 9</div>
              </div>
              <div className={`bs-card small${pred.smallProbability >= pred.bigProbability ? ' leader' : ''}`}>
                <div className="bs-label">SMALL</div>
                <div className="bs-prob">{formatPct(pred.smallProbability)}</div>
                <div style={{ fontSize: 10, color: '#60a5fa', marginTop: 4, opacity: 0.7 }}>0 – 4</div>
              </div>
            </div>
          </div>

          {/* Color probabilities */}
          <div className="section-title">Color Probability</div>
          <div className="card card-section">
            <ColorProbBar label="Red"    color="var(--red)"    fill="#ef4444" prob={pred.redProbability} />
            <ColorProbBar label="Green"  color="var(--green)"  fill="#22c55e" prob={pred.greenProbability} />
            <ColorProbBar label="Violet" color="var(--violet)" fill="#a855f7" prob={pred.violetProbability} />
          </div>

          {/* Number grid */}
          <div className="section-title">Number Probability</div>
          <div className="card-section">
            <div className="number-grid">
              {[0,1,2,3,4,5,6,7,8,9].map(n => {
                const prob = pred.numberProbabilities?.[n] || 0;
                const isTop = n === pred.topNumber;
                return (
                  <div key={n} className={`number-cell${isTop ? ' top' : ''}`}>
                    <div className={`number-cell-n`} style={{ color: numberToColorClass(n) === 'red' ? 'var(--red)' : numberToColorClass(n) === 'green' ? 'var(--green)' : 'var(--violet)' }}>
                      {n}
                    </div>
                    <div className="number-cell-p">{formatPct(prob)}</div>
                    {isTop && <div style={{ fontSize: 9, color: 'var(--accent-light)', fontWeight: 700 }}>TOP</div>}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Model info */}
          <div className="section-title">Model Confidence</div>
          <div className="card card-section">
            <div className="agreement-bar-wrap">
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                <span style={{ color: '#9898bb' }}>Model Agreement</span>
                <span style={{ fontWeight: 700, color: confidenceColor(pred.confidenceLevel) }}>
                  {pred.confidenceLevel?.replace('_', ' ')}
                </span>
              </div>
              <div className="agreement-bar-bg">
                <div className="agreement-bar-fill" style={{ width: `${(pred.modelAgreement || 0) * 100}%` }} />
              </div>
              <div className="agreement-labels">
                <span>Low</span>
                <span>{formatPct(pred.modelAgreement || 0)}</span>
                <span>High</span>
              </div>
            </div>
            <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 4 }}>
              {(pred.evidence || []).map((e: string, i: number) => (
                <div key={i} style={{ fontSize: 11, color: '#9898bb', display: 'flex', gap: 6, alignItems: 'center' }}>
                  <span style={{ color: 'var(--accent-light)' }}>✓</span>{e}
                </div>
              ))}
            </div>
            <div style={{ marginTop: 10, fontSize: 11, color: '#5a5a7a' }}>
              Based on {pred.sampleSize} results · {pred.generatedAt ? timeAgo(pred.generatedAt) : ''}
            </div>
          </div>
        </>
      ) : null}

      {/* Latest Results */}
      <div className="section-title">Latest Results</div>
      <div className="card card-section">
        {results.length === 0 ? (
          <div className="loading-wrap" style={{ padding: '20px 0' }}>
            <div className="spinner" />
            <span style={{ fontSize: 12 }}>Fetching live data…</span>
          </div>
        ) : (
          results.map((r: any) => (
            <div key={r.issueNumber} className="history-row">
              <div className={`number-ball ${numberToColorClass(r.number)}`} style={{ width: 36, height: 36, fontSize: 15 }}>
                {r.number}
              </div>
              <div className="history-period">{shortenIssue(r.issueNumber)}</div>
              <div className="history-badges">
                <span className={`size-badge ${r.size?.toLowerCase()}`}>{r.size}</span>
                {(r.colors || []).map((c: string) => (
                  <span key={c} className={`color-badge ${c}`}>{c}</span>
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      <div style={{ height: 8 }} />
    </div>
  );
}

function ColorProbBar({ label, color, fill, prob }: { label: string; color: string; fill: string; prob: number }) {
  return (
    <div className="prob-bar-wrap">
      <span className="prob-label" style={{ color }}>{label}</span>
      <div className="prob-bar-bg">
        <div className="prob-bar-fill" style={{ width: `${prob * 100}%`, background: fill }} />
      </div>
      <span className="prob-value" style={{ color }}>{formatPct(prob)}</span>
    </div>
  );
}
