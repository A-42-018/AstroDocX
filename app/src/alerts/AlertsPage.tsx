import { liveQuery } from 'dexie'
import { useEffect, useState } from 'react'
import type { Alert } from '../data/types'
import { useSnapshot } from '../board/hooks'
import { useBoard } from '../board/store'
import { completeActionCard, setStepDone } from '../engine/pipeline'
import { loadResolved } from './resolved'
import { requestPersistentStorage } from '../shell/install'
import { AlertsView } from './AlertsView'

export default function AlertsPage() {
  const snap = useSnapshot()
  const boot = useBoard((s) => s.boot)
  const select = useBoard((s) => s.selectCrew)
  const [resolved, setResolved] = useState<Alert[]>([])
  const crewId = snap?.crewId
  useEffect(() => {
    if (!crewId) return
    const sub = liveQuery(() => loadResolved(crewId)).subscribe({ next: setResolved, error: () => setResolved([]) })
    return () => sub.unsubscribe()
  }, [crewId])

  if (boot.state === 'error') return <p role="alert" className="glass">Could not open the local database: {boot.error}</p>
  if (boot.state !== 'ready' || snap === undefined) return <p className="glass muted" role="status">Initializing demo mission data…</p>
  if (snap === null) return <p className="glass muted">No crew data yet.</p>

  // Log entries are stamped with mission time, so the on-board log stays in step with the readings.
  return (
    <AlertsView
      crew={snap.crew}
      crewId={snap.crewId}
      active={snap.alerts}
      resolved={resolved}
      onSelectCrew={select}
      onStep={(id, i, done) => void setStepDone(id, i, done, snap.now)}
      onDone={(id) => void completeActionCard(id, snap.now).then(() => requestPersistentStorage())}
    />
  )
}
