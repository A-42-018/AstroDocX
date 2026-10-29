import { Suspense, useEffect, useRef } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import BoardPage from './board/BoardPage'
import { CabinPage } from './cabin/lazy'
import { CabinLoader } from './cabin/CabinLoader'
import { seedDemo } from './data/demo'
import { Backdrop } from './shell/Backdrop'
import { Embed, embedFromUrl } from './shell/Embed'
import { ErrorBoundary } from './shell/ErrorBoundary'
import { useInstallPrompt } from './shell/install'
import { lazyPage } from './shell/lazyPage'
import { BottomTabs, StatusBar, TopBar } from './shell/Chrome'
import { routeFor } from './shell/nav'
import { ShellDataContext, useShellData } from './shell/useShellData'
import { useSplashHandoff } from './shell/splash'
import { StateView } from './ui/StateView'
import { Tour } from './tour/Tour'

// The board is the landing screen and loads eagerly; every other screen (Trends carries the chart
// library) is its own chunk. The service worker precaches all chunks, so they still work offline;
// lazyPage reloads once if a chunk is gone after a redeploy.
const AlertsPage = lazyPage(() => import('./alerts/AlertsPage'))
const TrendsPage = lazyPage(() => import('./trends/TrendsPage'))
const CheckInPage = lazyPage(() => import('./checkin/CheckInPage'))
const SimulatorPage = lazyPage(() => import('./sim/SimulatorPage'))
const SyncPage = lazyPage(() => import('./sync/SyncPage'))
const GroundPage = lazyPage(() => import('./ground/GroundPage'))
const NasaPage = lazyPage(() => import('./nasa/NasaPage'))
import { useBootDemo } from './board/hooks'
import { useBoard } from './board/store'

/** Once the board is showing and the browser is idle, fetch the other screens so the first visit to each one is instant. */
function usePreloadPages() {
  const ready = useBoard((s) => s.boot.state === 'ready')
  useEffect(() => {
    if (!ready) return
    const pages = [AlertsPage, TrendsPage, CheckInPage, SimulatorPage, SyncPage, GroundPage, NasaPage]
    const warm = () => pages.forEach((p) => p.preload())
    if ('requestIdleCallback' in window) {
      const id = requestIdleCallback(warm, { timeout: 3000 })
      return () => cancelIdleCallback(id)
    }
    const id = setTimeout(warm, 1500)
    return () => clearTimeout(id)
  }, [ready])
}

/** On navigation: name the page in the tab title and move focus to the new content, so screen-reader and keyboard users land on it. */
function useRouteAnnounce(main: React.RefObject<HTMLElement | null>) {
  const { pathname } = useLocation()
  const first = useRef(true)
  useEffect(() => {
    const label = pathname.startsWith('/cabin') ? '3D Cabin' : routeFor(pathname)?.label
    document.title = label ? `${label} · AstroDocX Crew Console` : 'AstroDocX Crew Console'
    if (first.current) { first.current = false; return }
    main.current?.focus()
  }, [pathname, main])
}

export default function App() {
  useBootDemo()
  useSplashHandoff()
  usePreloadPages()
  const main = useRef<HTMLElement>(null)
  useRouteAnnounce(main)
  const install = useInstallPrompt()
  const shell = useShellData()
  const { pathname, search } = useLocation()
  // A single screen without the frame, for the 3D cabin's wall screens.
  const embed = embedFromUrl(search)
  if (embed) return (
    <ShellDataContext.Provider value={shell}>
      <ErrorBoundary key={pathname} onReset={() => seedDemo().then(() => undefined)}><Embed {...embed} /></ErrorBoundary>
    </ShellDataContext.Provider>
  )
  // 3D mode is full screen: no console frame or animated backdrop drawing behind it.
  if (pathname.startsWith('/cabin')) return (
    <ShellDataContext.Provider value={shell}>
      <ErrorBoundary key={pathname} onReset={() => seedDemo().then(() => undefined)}>
        <Suspense fallback={<CabinLoader />}><CabinPage /></Suspense>
      </ErrorBoundary>
      <Tour />
    </ShellDataContext.Provider>
  )
  return (
    <ShellDataContext.Provider value={shell}>
    <div className="shell">
      <Backdrop />
      <a href="#main" className="skip-link">Skip to content</a>
      <div className="frame">
        <TopBar data={shell} install={install} />
      <main id="main" ref={main} tabIndex={-1}>
        {/* key: a crash on one screen clears when the crew moves to another */}
        <ErrorBoundary key={pathname} onReset={() => seedDemo().then(() => undefined)}>
        <Suspense fallback={<StateView kind="loading" label="Loading screen" />}>
        <Routes>
          <Route path="/" element={<Navigate to="/board" replace />} />
          <Route path="/board" element={<BoardPage />} />
          <Route path="/alerts" element={<AlertsPage />} />
          <Route path="/trends" element={<TrendsPage />} />
          <Route path="/checkin" element={<CheckInPage />} />
          <Route path="/simulator" element={<SimulatorPage />} />
          <Route path="/sync" element={<SyncPage />} />
          <Route path="/ground" element={<GroundPage />} />
          <Route path="/nasa" element={<NasaPage />} />
          <Route path="*" element={<Navigate to="/board" replace />} />
        </Routes>
        </Suspense>
        </ErrorBoundary>
      </main>
      <StatusBar data={shell} />
      </div>
      <BottomTabs alerts={shell?.crew.find((c) => c.id === shell.crewId)?.alerts ?? 0} />
      <Tour />
    </div>
    </ShellDataContext.Provider>
  )
}
