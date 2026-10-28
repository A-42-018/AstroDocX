import '../styles/pages/embed.css'
import { Suspense, useState } from 'react'
import BoardPage from '../board/BoardPage'
import { useSnapshot } from '../board/hooks'
import { NextAction } from '../board/NextAction'
import { useBoard } from '../board/store'
import { LiveVitals } from '../live/LiveVitals'
import { useLiveTelemetry } from '../live/useLiveTelemetry'
import { StateView } from '../ui/StateView'
import type { Snapshot } from '../board/snapshot'
import { lazyPage } from './lazyPage'

const AlertsPage = lazyPage(() => import('../alerts/AlertsPage'))
const TrendsPage = lazyPage(() => import('../trends/TrendsPage'))

export type EmbedView = 'board' | 'vitals' | 'alerts' | 'trends'
const VIEWS: EmbedView[] = ['board', 'vitals', 'alerts', 'trends']

/** `?embed=<view>&crew=<id>` from the URL, or null for the normal console. */
export function embedFromUrl(search: string): { view: EmbedView; crew: string | null } | null {
  const q = new URLSearchParams(search), view = q.get('embed') as EmbedView | null
  return view && VIEWS.includes(view) ? { view, crew: q.get('crew') } : null
}

function Vitals({ snap }: { snap: Snapshot }) {
  const telemetry = useLiveTelemetry(snap.crewId)
  const who = snap.crew.find((c) => c.id === snap.crewId)
  return (
    <div className="em-vitals">
      <h1 className="em-title">Live Vitals <span>· {who?.name ?? 'Crew member'}</span></h1>
      <LiveVitals crewId={snap.crewId} telemetry={telemetry} />
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
 * One console screen without the console frame, for the 3D cabin's wall screens (cabin/screens.ts loads them in
 * iframes). Same app, same local database, so the screens are the real console, live. The crew member comes from
 * the URL and is not saved as the console's selection.
 */
export function Embed({ view, crew }: { view: EmbedView; crew: string | null }) {
  useState(() => { if (crew) useBoard.setState({ crewId: crew }) })
  return (
    <main className={`embed embed-${view}`}>
      <Suspense fallback={<StateView kind="loading" label="Loading screen" />}>
        {view === 'board' && <BoardPage />}
        {view === 'vitals' && <VitalsPage />}
        {view === 'alerts' && <AlertsPage />}
        {view === 'trends' && <TrendsPage />}
      </Suspense>
    </main>
  )
}
