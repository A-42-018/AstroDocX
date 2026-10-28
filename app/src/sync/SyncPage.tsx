import '../styles/pages/sync.css'
import { liveQuery } from 'dexie'
import { useEffect, useState } from 'react'
import { useSnapshot } from '../board/hooks'
import { useBoard } from '../board/store'
import { linkAt } from './link'
import { db } from '../data/db'
import type { ActionLogEntry } from '../data/types'
import { met } from '../engine/actions'
import { downloadCsv, logToCsv } from './exportLog'
import { loadOutbox, syncNow, type Outbox } from './outbox'
import { useSync } from './store'
import { getTransport } from './transport'
import { StateView } from '../ui/StateView'
import { SyncView } from './SyncView'

export default function SyncPage() {
  const snap = useSnapshot()
  const boot = useBoard((s) => s.boot)
  const { blackout, setBlackout, auto, setAuto } = useSync()
  const [box, setBox] = useState<Outbox | null>(null)
  const [log, setLog] = useState<ActionLogEntry[] | undefined>(undefined)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const ready = boot.state === 'ready'
  useEffect(() => {
    if (!ready) return
    const sub = liveQuery(() => loadOutbox()).subscribe({ next: setBox, error: () => setBox(null) })
    const sub2 = liveQuery(() => db.actionLog.toArray()).subscribe({ next: setLog, error: () => setLog(undefined) })
    return () => { sub.unsubscribe(); sub2.unsubscribe() }
  }, [ready])

  if (boot.state === 'error') return <StateView kind="error" title="Could not open the local database"><p>{boot.error}</p></StateView>
  if (!ready || snap === undefined || box === null) {
    const pct = boot.state === 'seeding' && boot.total > 0 ? (boot.done / boot.total) * 100 : undefined
    return <StateView kind="loading" label="Initializing demo mission data" progress={pct} />
  }
  if (snap === null) return <StateView kind="empty" label="No crew data yet." />

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
      log={log} crew={snap.crew}
      blackout={blackout} auto={auto} busy={busy} message={message} error={error}
      onSync={() => void sync()} onBlackout={setBlackout} onAuto={setAuto}
      onExport={() => void db.actionLog.toArray().then((all) => downloadCsv(logToCsv(all, snap.crew), `astrodocx-log-${met(snap.now).replace(/[ :]/g, '-')}.csv`))}
    />
  )
}
