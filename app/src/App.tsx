import { NavLink, Navigate, Route, Routes } from 'react-router-dom'
import AlertsPage from './alerts/AlertsPage'
import BoardPage from './board/BoardPage'
import { useBootDemo } from './board/hooks'

const ROUTES = [
  { path: '/board', label: 'Status Board', phase: 'C5', blurb: 'Per-crew hazard tiles, readiness ring, mission clock.' },
  { path: '/alerts', label: 'Alerts', phase: 'C6', blurb: 'Explained alerts and checkable action cards.' },
  { path: '/trends', label: 'Trends', phase: 'C7', blurb: 'Each metric against the personal baseline band.' },
  { path: '/checkin', label: 'Check-in', phase: 'C8', blurb: 'Mood, sleep, symptoms and the reaction-time test.' },
  { path: '/simulator', label: 'Simulator', phase: 'C9', blurb: 'Inject scenarios and fast-forward time.' },
  { path: '/sync', label: 'Ground Sync', phase: 'C10', blurb: 'Outbox, link windows and blackouts.' },
] as const

function Placeholder({ label, phase, blurb }: { label: string; phase: string; blurb: string }) {
  return (
    <section className="glass">
      <h1 style={{ marginTop: 0 }}>{label}</h1>
      <p className="muted">{blurb}</p>
      <p className="mono muted">Planned in phase {phase}</p>
    </section>
  )
}

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
          {ROUTES.filter((r) => r.path !== '/board' && r.path !== '/alerts').map((r) => (
            <Route key={r.path} path={r.path} element={<Placeholder {...r} />} />
          ))}
          <Route path="*" element={<Navigate to="/board" replace />} />
        </Routes>
      </main>
      <footer className="disclaimer">Concept prototype, not a medical device.</footer>
    </div>
  )
}
