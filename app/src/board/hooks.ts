import { liveQuery } from 'dexie'
import { useEffect, useState } from 'react'
import { demoLoaded, seedDemo } from '../data/demo'
import { loadSnapshot, type Snapshot } from './snapshot'
import { useBoard } from './store'

/** Seed the demo mission on first run. */
export function useBootDemo() {
  const setBoot = useBoard((s) => s.setBoot)
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        if (await demoLoaded()) return setBoot({ state: 'ready', done: 0, total: 0 })
        setBoot({ state: 'seeding', done: 0, total: 1 })
        await seedDemo((done, total) => !cancelled && setBoot({ state: 'seeding', done, total }))
        if (!cancelled) setBoot({ state: 'ready', done: 0, total: 0 })
      } catch (e) {
        if (!cancelled) setBoot({ state: 'error', done: 0, total: 0, error: String(e) })
      }
    })()
    return () => { cancelled = true }
  }, [setBoot])
}

/** Live snapshot of the selected crew member; re-runs whenever the DB changes. */
export function useSnapshot(): Snapshot | null | undefined {
  const crewId = useBoard((s) => s.crewId)
  const ready = useBoard((s) => s.boot.state === 'ready')
  const [snap, setSnap] = useState<Snapshot | null | undefined>(undefined)
  useEffect(() => {
    if (!ready) return
    const sub = liveQuery(() => loadSnapshot(crewId)).subscribe({ next: setSnap, error: () => setSnap(null) })
    return () => sub.unsubscribe()
  }, [crewId, ready])
  return snap
}
