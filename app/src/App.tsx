import { NavLink, Navigate, Route, Routes } from 'react-router-dom'
import AlertsPage from './alerts/AlertsPage'
import TrendsPage from './trends/TrendsPage'
import CheckInPage from './checkin/CheckInPage'
import SimulatorPage from './sim/SimulatorPage'
import SyncPage from './sync/SyncPage'
import BoardPage from './board/BoardPage'
import { useBootDemo } from './board/hooks'

const ROUTES = [
  { path: '/board', label: 'Status Board' },
  { path: '/alerts', label: 'Alerts' },
  { path: '/trends', label: 'Trends' },
  { path: '/checkin', label: 'Check-in' },
  { path: '/simulator', label: 'Simulator' },
  { path: '/sync', label: 'Ground Sync' },
] as const

export default function App() {
  useBootDemo()
  return (
    <div className="shell">
      <header className="topbar">
        <span className="brand">&lt;astrodocX/&gt;</span>
        <nav aria-label="Crew Console">
          {ROUTES.map((r) => (
            <NavLink key={r.path} to={r.path} className={({ isActive }) => (isActive ? 'active' : '')}>
              {r.label}
            </NavLink>
          ))}
        </nav>
      </header>
      <main>
        <Routes>
          <Route path="/" element={<Navigate to="/board" replace />} />
          <Route path="/board" element={<BoardPage />} />
          <Route path="/alerts" element={<AlertsPage />} />
          <Route path="/trends" element={<TrendsPage />} />
          <Route path="/checkin" element={<CheckInPage />} />
          <Route path="/simulator" element={<SimulatorPage />} />
          <Route path="/sync" element={<SyncPage />} />
          <Route path="*" element={<Navigate to="/board" replace />} />
        </Routes>
      </main>
      <footer className="disclaimer">Concept prototype, not a medical device.</footer>
    </div>
  )
}
