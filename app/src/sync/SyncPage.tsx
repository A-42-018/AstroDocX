import { liveQuery } from 'dexie'
import { useEffect, useState } from 'react'
import { useSnapshot } from '../board/hooks'
import { useBoard } from '../board/store'
import { linkAt } from './link'
import { db } from '../data/db'
import { met } from '../engine/actions'
import { downloadCsv, logToCsv } from './exportLog'
import { loadOutbox, syncNow, type Outbox } from './outbox'
import { useSync } from './store'
import { getTransport } from './transport'
import { SyncView } from './SyncView'

export default function SyncPage() {
  const snap = useSnapshot()
  const boot = useBoard((s) => s.boot)
  const { blackout, setBlackout, auto, setAuto } = useSync()
  const [box, setBox] = useState<Outbox | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const ready = boot.state === 'ready'
  useEffect(() => {
    if (!ready) return
    const sub = liveQuery(() => loadOutbox()).subscribe({ next: setBox, error: () => setBox(null) })
    return () => sub.unsubscribe()
  }, [ready])

  if (boot.state === 'error') return <p role="alert" className="glass">Could not open the local database: {boot.error}</p>
  if (!ready || snap === undefined || box === null) return <p className="glass muted" role="status">Initializing demo mission data…</p>
  if (snap === null) return <p className="glass muted">No crew data yet.</p>

  const lastSyncedAt = box.synced.reduce<number | null>((m, e) => (e.syncedAt !== undefined && (m === null || e.syncedAt > m) ? e.syncedAt : m), null)
  const sync = async () => {
    setBusy(true)
    setError('')
    setMessage('')
    try {
      const n = await syncNow(snap.now, blackout)
      setMessage(`${n} entr${n === 1 ? 'y' : 'ies'} sent to the ground.`)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }
  return (
    <SyncView
      now={snap.now} link={linkAt(snap.now, blackout)} pending={box.pending} synced={box.synced} lastSyncedAt={lastSyncedAt} station={getTransport().name}
      blackout={blackout} auto={auto} busy={busy} message={message} error={error}
      onSync={() => void sync()} onBlackout={setBlackout} onAuto={setAuto}
      onExport={() => void db.actionLog.toArray().then((all) => downloadCsv(logToCsv(all, snap.crew), `astrodocx-log-${met(snap.now).replace(/[ :]/g, '-')}.csv`))}
    />
  )
}
