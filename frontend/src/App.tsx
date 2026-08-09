import { Routes, Route, NavLink } from 'react-router-dom';
import HomePage from './pages/Home';
import HistoryPage from './pages/History';
import PatternsPage from './pages/Patterns';
import AnalysisPage from './pages/Analysis';
import AdminPage from './pages/Admin';

const APP_PASSCODE = '7271'; // App passcode

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return localStorage.getItem('wingo_auth') === 'true';
  });
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState(false);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (pinInput === APP_PASSCODE) {
      localStorage.setItem('wingo_auth', 'true');
      setIsAuthenticated(true);
      setPinError(false);
    } else {
      setPinError(true);
      setPinInput('');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('wingo_auth');
    setIsAuthenticated(false);
  };

  // Passcode Lock Screen
  if (!isAuthenticated) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg-primary)',
        padding: 20
      }}>
        <form onSubmit={handleLogin} className="card" style={{ width: '100%', maxWidth: 360, textAlign: 'center', padding: '32px 24px' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🔒</div>
          <h2 style={{ fontSize: 20, marginBottom: 6, color: 'var(--text-primary)' }}>WinGo Analytics</h2>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 24 }}>Enter Access Passcode to Continue</p>
          
          <input
            type="password"
            maxLength={10}
            placeholder="Enter Passcode"
            value={pinInput}
            onChange={(e) => setPinInput(e.target.value)}
            style={{
              width: '100%',
              padding: '14px',
              borderRadius: 12,
              border: `1px solid ${pinError ? '#ef4444' : 'var(--border)'}`,
              background: 'rgba(255,255,255,0.05)',
              color: '#fff',
              fontSize: 18,
              textAlign: 'center',
              letterSpacing: 4,
              outline: 'none',
              marginBottom: 16
            }}
            autoFocus
          />
          
          {pinError && (
            <p style={{ color: '#ef4444', fontSize: 13, marginBottom: 16 }}>
              ❌ Incorrect Passcode. Try again.
            </p>
          )}

          <button
            type="submit"
            style={{
              width: '100%',
              padding: '14px',
              borderRadius: 12,
              border: 'none',
              background: 'linear-gradient(135deg, var(--accent), #4f46e5)',
              color: '#fff',
              fontWeight: 600,
              fontSize: 15,
              cursor: 'pointer'
            }}
          >
            Unlock Dashboard
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="app-container">
      {/* Top Header Logout Action */}
      <div style={{ position: 'fixed', top: 12, right: 12, zIndex: 1000 }}>
        <button
          onClick={handleLogout}
          style={{
            background: 'rgba(255,255,255,0.08)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            padding: '4px 10px',
            fontSize: 11,
            color: 'var(--text-muted)',
            cursor: 'pointer'
          }}
          title="Lock App"
        >
          🔒 Lock
        </button>
      </div>

      <div className="app-body">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/history" element={<HistoryPage />} />
          <Route path="/patterns" element={<PatternsPage />} />
          <Route path="/analysis" element={<AnalysisPage />} />
          <Route path="/admin" element={<AdminPage />} />
        </Routes>
      </div>

      <nav className="bottom-nav">
        <NavLink to="/" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
          <span className="nav-icon">🏠</span>
          <span>Home</span>
        </NavLink>
        <NavLink to="/history" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
          <span className="nav-icon">📋</span>
          <span>History</span>
        </NavLink>
        <NavLink to="/patterns" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
          <span className="nav-icon">📊</span>
          <span>Patterns</span>
        </NavLink>
        <NavLink to="/analysis" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
          <span className="nav-icon">🔬</span>
          <span>Analysis</span>
        </NavLink>
      </nav>
    </div>
  );
}
