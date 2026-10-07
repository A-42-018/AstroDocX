import { Suspense, lazy, useEffect, useRef } from 'react'
import { NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import BoardPage from './board/BoardPage'

// The board is the landing screen and loads eagerly; every other screen (Trends carries the chart
// library) is its own chunk. The service worker precaches all chunks, so they still work offline.
const AlertsPage = lazy(() => import('./alerts/AlertsPage'))
const TrendsPage = lazy(() => import('./trends/TrendsPage'))
const CheckInPage = lazy(() => import('./checkin/CheckInPage'))
const SimulatorPage = lazy(() => import('./sim/SimulatorPage'))
const SyncPage = lazy(() => import('./sync/SyncPage'))
const GroundPage = lazy(() => import('./ground/GroundPage'))
import { useBootDemo } from './board/hooks'

const ROUTES = [
  { path: '/board', label: 'Status Board' },
  { path: '/alerts', label: 'Alerts' },
  { path: '/trends', label: 'Trends' },
  { path: '/checkin', label: 'Check-in' },
  { path: '/simulator', label: 'Simulator' },
  { path: '/sync', label: 'Ground Sync' },
  { path: '/ground', label: 'Ground View' },
] as const

/** On navigation: name the page in the tab title and move focus to the new content, so screen-reader and keyboard users land on it. */
function useRouteAnnounce(main: React.RefObject<HTMLElement | null>) {
  const { pathname } = useLocation()
  const first = useRef(true)
  useEffect(() => {
    const label = ROUTES.find((r) => pathname.startsWith(r.path))?.label
    document.title = label ? `${label} · AstroDocX Crew Console` : 'AstroDocX Crew Console'
    if (first.current) { first.current = false; return }
    main.current?.focus()
  }, [pathname, main])
}

export default function App() {
  useBootDemo()
  const main = useRef<HTMLElement>(null)
  useRouteAnnounce(main)
  return (
    <div className="shell">
      <a href="#main" className="skip-link">Skip to content</a>
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
      <main id="main" ref={main} tabIndex={-1}>
        <Suspense fallback={<p className="glass muted" role="status">Loading…</p>}>
        <Routes>
          <Route path="/" element={<Navigate to="/board" replace />} />
          <Route path="/board" element={<BoardPage />} />
          <Route path="/alerts" element={<AlertsPage />} />
          <Route path="/trends" element={<TrendsPage />} />
          <Route path="/checkin" element={<CheckInPage />} />
          <Route path="/simulator" element={<SimulatorPage />} />
          <Route path="/sync" element={<SyncPage />} />
          <Route path="/ground" element={<GroundPage />} />
          <Route path="*" element={<Navigate to="/board" replace />} />
        </Routes>
        </Suspense>
      </main>
      <footer className="disclaimer">Concept prototype, not a medical device.</footer>
    </div>
  )
}
