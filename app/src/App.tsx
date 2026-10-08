import { Suspense, useEffect, useRef } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import BoardPage from './board/BoardPage'
import { seedDemo } from './data/demo'
import { Backdrop } from './shell/Backdrop'
import { ErrorBoundary } from './shell/ErrorBoundary'
import { useInstallPrompt } from './shell/install'
import { lazyPage } from './shell/lazyPage'
import { BottomTabs, Rail, TopBar } from './shell/Chrome'
import { ROUTES } from './shell/nav'
import { ShellDataContext, useShellData } from './shell/useShellData'

// The board is the landing screen and loads eagerly; every other screen (Trends carries the chart
// library) is its own chunk. The service worker precaches all chunks, so they still work offline;
// lazyPage reloads once if a chunk is gone after a redeploy.
const AlertsPage = lazyPage(() => import('./alerts/AlertsPage'))
const TrendsPage = lazyPage(() => import('./trends/TrendsPage'))
const CheckInPage = lazyPage(() => import('./checkin/CheckInPage'))
const SimulatorPage = lazyPage(() => import('./sim/SimulatorPage'))
const SyncPage = lazyPage(() => import('./sync/SyncPage'))
const GroundPage = lazyPage(() => import('./ground/GroundPage'))
import { useBootDemo } from './board/hooks'

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
  const install = useInstallPrompt()
  const shell = useShellData()
  const { pathname } = useLocation()
  return (
    <ShellDataContext.Provider value={shell}>
    <div className="shell">
      <Backdrop />
      <a href="#main" className="skip-link">Skip to content</a>
      <Rail />
      <div className="frame">
        <TopBar data={shell} install={install} />
      <main id="main" ref={main} tabIndex={-1}>
        {/* key: a crash on one screen clears when the crew moves to another */}
        <ErrorBoundary key={pathname} onReset={() => seedDemo().then(() => undefined)}>
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
        </ErrorBoundary>
      </main>
      <footer className="disclaimer">Prototype, not a medical device.</footer>
      </div>
      <BottomTabs />
    </div>
    </ShellDataContext.Provider>
  )
}
