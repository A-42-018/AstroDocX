import '../styles/pages/embed.css'
import { Suspense, useEffect, useRef, useState } from 'react'
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { useSnapshot } from '../board/hooks'
import { NextAction } from '../board/NextAction'
import { useBoard } from '../board/store'
import { LiveVitals } from '../live/LiveVitals'
import { useLiveTelemetry } from '../live/useLiveTelemetry'
import { StateView } from '../ui/StateView'
import type { Snapshot } from '../board/snapshot'
import { pageLabel, type EmbedView } from './embedMode'
import { ROUTES } from './nav'
import { pageRoutes } from './pages'
import { ScreenRail } from './ScreenRail'

/** The path each embed view opens at. Live Vitals exists only here, as its own page. */
const START: Record<EmbedView, string> = { board: '/board', vitals: '/vitals', alerts: '/alerts', trends: '/trends' }
function Vitals({ snap }: { snap: Snapshot }) {
  const telemetry = useLiveTelemetry(snap.crewId)
  const who = snap.crew.find((c) => c.id === snap.crewId)
  return (
    <div className="em-vitals">
      <h1 className="em-title">Live Vitals <span>· {who?.name ?? 'Crew member'}</span></h1>
      <LiveVitals crewId={snap.crewId} telemetry={telemetry} showWatch={false} />
      <NextAction snap={snap} />
    </div>
  )
}
function VitalsPage() {
  const snap = useSnapshot()
  if (!snap) return <StateView kind="loading" label="Loading vitals" />
  return <Vitals snap={snap} />
}

/**
 * Talks to the cabin that holds this frame: the page we are on goes up; whether it is being used, and where to go, come down.
 * Rendered beside <Embed> (App.tsx keys that by path, so it remounts on every page: this must outlive that to keep the in-use state).
 */
export function EmbedBridge() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const go = useRef(navigate) // the navigate function changes with every page: the listener below must outlive that, or it would drop the in-use state each time
  useEffect(() => { go.current = navigate })
  useEffect(() => {
    if (window.parent !== window) window.parent.postMessage({ adxScreen: 'route', path: pathname, label: pageLabel(pathname) }, location.origin)
  }, [pathname])
  useEffect(() => {
    const root = document.documentElement
    const onMessage = (e: MessageEvent) => {
      if (e.source !== window.parent || e.origin !== location.origin) return
      const d = e.data as { engaged?: boolean; nav?: string } | null
      if (typeof d?.engaged === 'boolean') root.classList.toggle('adx-engaged', d.engaged)
      if (typeof d?.nav === 'string' && d.nav.startsWith('/')) go.current(d.nav)
    }
    // keys go to the frame once it is in use, so the way back (Esc) is passed up to the cabin
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && root.classList.contains('adx-engaged') && window.parent !== window) window.parent.postMessage({ adxScreen: 'escape' }, location.origin)
    }
    window.addEventListener('message', onMessage); window.addEventListener('keydown', onKey)
    return () => { window.removeEventListener('message', onMessage); window.removeEventListener('keydown', onKey); root.classList.remove('adx-engaged') }
  }, [])
  return null
}

/**
 * One console screen without the console frame, for the 3D cabin's wall screens (cabin/screens.ts loads them in
 * iframes). Same app, same local database, so the screens are the real console, live. The crew member comes from
 * the URL and is not saved as the console's selection. With a rail down its side, a visitor who steps up to the screen can open any page the console has.
 */
export function Embed({ view, crew }: { view: EmbedView; crew: string | null }) {
  useState(() => { if (crew) useBoard.setState({ crewId: crew }) })
  const { pathname } = useLocation()
  const page = pathname.startsWith('/vitals') ? 'vitals' : (ROUTES.find((r) => pathname.startsWith(r.path))?.path.slice(1) ?? 'board')
  return (
    <div className="embed-shell">
      <ScreenRail />
      <main className={`embed embed-${page}`} data-view={view}>
        <Suspense fallback={<StateView kind="loading" label="Loading screen" />}>
          <Routes>
            <Route path="/" element={<Navigate to={START[view]} replace />} />
            <Route path="/vitals" element={<VitalsPage />} />
            <Route path="/cabin/*" element={<Navigate to="/board" replace />} />
            {pageRoutes()}
          </Routes>
        </Suspense>
      </main>
    </div>
  )
}
