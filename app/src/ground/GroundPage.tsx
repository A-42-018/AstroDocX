import { liveQuery } from 'dexie'
import { useEffect, useState } from 'react'
import { useSnapshot } from '../board/hooks'
import { useBoard } from '../board/store'
import { db } from '../data/db'
import type { ActionLogEntry } from '../data/types'
import { deriveGround } from './derive'
import { GroundView } from './GroundView'

export default function GroundPage() {
  const snap = useSnapshot()
  const boot = useBoard((s) => s.boot)
  const [log, setLog] = useState<ActionLogEntry[] | null>(null)
  const ready = boot.state === 'ready'
  useEffect(() => {
    if (!ready) return
    const sub = liveQuery(() => db.actionLog.toArray()).subscribe({ next: setLog, error: () => setLog(null) })
    return () => sub.unsubscribe()
  }, [ready])

  if (boot.state === 'error') return <p role="alert" className="glass">Could not open the local database: {boot.error}</p>
  if (!ready || snap === undefined || log === null) return <p className="glass muted" role="status">Initializing demo mission data…</p>
  if (snap === null) return <p className="glass muted">No crew data yet.</p>
  const lastSyncedAt = log.reduce<number | null>((m, e) => (e.syncedAt !== undefined && (m === null || e.syncedAt > m) ? e.syncedAt : m), null)
  return <GroundView now={snap.now} lastSyncedAt={lastSyncedAt} pending={log.filter((e) => e.sync === 'pending').length} crew={deriveGround(snap.crew, log)} />
}
