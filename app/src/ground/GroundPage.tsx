import '../styles/pages/ground.css'
import { liveQuery } from 'dexie'
import { useCallback, useEffect, useState } from 'react'
import { useSnapshot } from '../board/hooks'
import { useBoard } from '../board/store'
import { db } from '../data/db'
import type { ActionLogEntry } from '../data/types'
import { getTransport } from '../sync/transport'
import { deriveGround } from './derive'
import { StateView } from '../ui/StateView'
import { GroundView } from './GroundView'

export default function GroundPage() {
  const snap = useSnapshot()
  const boot = useBoard((s) => s.boot)
  const [log, setLog] = useState<ActionLogEntry[] | null>(null)
  // With a real ground server, the flight surgeon's view comes from the server, not from this device.
  const transport = getTransport()
  const [remote, setRemote] = useState<{ rows: ActionLogEntry[] | null; error: string; loading: boolean }>({ rows: null, error: '', loading: false })
  const ready = boot.state === 'ready'
  useEffect(() => {
    if (!ready) return
    const sub = liveQuery(() => db.actionLog.toArray()).subscribe({ next: setLog, error: () => setLog(null) })
    return () => sub.unsubscribe()
  }, [ready])
  const load = useCallback(() => {
    if (!transport.fetchAll) return Promise.resolve()
    return transport.fetchAll().then(
      (rows) => setRemote({ rows, error: '', loading: false }),
      (e: unknown) => setRemote({ rows: null, error: e instanceof Error ? e.message : String(e), loading: false }),
    )
  }, [transport])
  useEffect(() => { if (ready) void load() }, [ready, load])
  const refresh = () => {
    setRemote((r) => ({ ...r, loading: true, error: '' }))
    void load()
  }

  if (boot.state === 'error') return <StateView kind="error" title="Could not open the local database"><p>{boot.error}</p></StateView>
  if (!ready || snap === undefined || log === null) {
    const pct = boot.state === 'seeding' && boot.total > 0 ? (boot.done / boot.total) * 100 : undefined
    return <StateView kind="loading" label="Initializing demo mission data" progress={pct} />
  }
  if (snap === null) return <StateView kind="empty" label="No crew data yet." />

  const fromServer = remote.rows !== null
  const source = fromServer ? remote.rows! : log
  const lastSyncedAt = source.reduce<number | null>((m, e) => (e.syncedAt !== undefined && (m === null || e.syncedAt > m) ? e.syncedAt : m), null)
  return (
    <GroundView
      now={snap.now}
      lastSyncedAt={lastSyncedAt}
      pending={fromServer ? null : log.filter((e) => e.sync === 'pending').length}
      crew={deriveGround(snap.crew, source)}
      source={fromServer ? `${transport.name}, ${remote.rows!.length} rows` : 'this device (simulated ground station)'}
      sourceError={remote.error}
      onRefresh={transport.fetchAll ? refresh : undefined}
      refreshing={remote.loading}
    />
  )
}
