import { Routes, Route, NavLink } from 'react-router-dom';
import HomePage from './pages/Home';
import HistoryPage from './pages/History';
import PatternsPage from './pages/Patterns';
import AnalysisPage from './pages/Analysis';
import AdminPage from './pages/Admin';

const NAV = [
  { to: '/',         icon: '🏠', label: 'Home'     },
  { to: '/history',  icon: '📋', label: 'History'  },
  { to: '/patterns', icon: '📊', label: 'Patterns' },
  { to: '/analysis', icon: '🔬', label: 'Analysis' },
];

export default function App() {
  return (
    <div className="app-layout">
      <main className="page-content">
        <Routes>
          <Route path="/"         element={<HomePage />} />
          <Route path="/history"  element={<HistoryPage />} />
          <Route path="/patterns" element={<PatternsPage />} />
          <Route path="/analysis" element={<AnalysisPage />} />
          <Route path="/admin"    element={<AdminPage />} />
        </Routes>
      </main>

      <nav className="bottom-nav" role="navigation">
        {NAV.map(({ to, icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
            aria-label={label}
          >
            <div className="nav-icon">{icon}</div>
            <span className="nav-label">{label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
