import '../styles/pages/alerts.css'
import { liveQuery } from 'dexie'
import { useEffect, useState } from 'react'
import type { Alert } from '../data/types'
import { useSnapshot } from '../board/hooks'
import { useBoard } from '../board/store'
import { completeActionCard, setStepDone } from '../engine/pipeline'
import { loadAlertDetail, type AlertDetailData } from './detail'
import { loadResolved } from './resolved'
import { requestPersistentStorage } from '../shell/install'
import { StateView } from '../ui/StateView'
import { AlertsView } from './AlertsView'

export default function AlertsPage() {
  const snap = useSnapshot()
  const boot = useBoard((s) => s.boot)
  const [resolved, setResolved] = useState<Alert[]>([])
  const [selected, setSelected] = useState<Alert | null>(null)
  const [detail, setDetail] = useState<AlertDetailData | null>(null)
  const crewId = snap?.crewId
  const now = snap?.now
  useEffect(() => {
    if (!crewId) return
    const sub = liveQuery(() => loadResolved(crewId, 30)).subscribe({ next: setResolved, error: () => setResolved([]) })
    return () => sub.unsubscribe()
  }, [crewId])
  // The chart and timeline follow the database, so ticking a step updates the timeline at once.
  const selectedId = selected?.id
  useEffect(() => {
    if (!selected || selectedId === undefined || now === undefined) return
    const sub = liveQuery(() => loadAlertDetail(selected, now)).subscribe({ next: setDetail, error: () => setDetail(null) })
    return () => sub.unsubscribe()
  }, [selectedId, selected, now])

  if (boot.state === 'error') return <StateView kind="error" title="Could not open the local database"><p>{boot.error}</p></StateView>
  if (boot.state !== 'ready' || snap === undefined) {
    const pct = boot.state === 'seeding' && boot.total > 0 ? (boot.done / boot.total) * 100 : undefined
    return <StateView kind="loading" label="Initializing demo mission data" progress={pct} />
  }
  if (snap === null) return <StateView kind="empty" label="No crew data yet." />

  // Log entries are stamped with mission time, so the on-board log stays in step with the readings.
  return (
    <AlertsView
      crew={snap.crew}
      crewId={snap.crewId}
      active={snap.alerts}
      resolved={resolved}
      detail={detail}
      onSelect={setSelected}
      onStep={(id, i, done) => void setStepDone(id, i, done, snap.now)}
      onDone={(id) => void completeActionCard(id, snap.now).then(() => requestPersistentStorage())}
    />
  )
}
