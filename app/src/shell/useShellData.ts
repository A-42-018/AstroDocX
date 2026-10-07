import { liveQuery } from 'dexie'
import { useEffect, useState } from 'react'
import { useBoard } from '../board/store'
import { loadSnapshot } from '../board/snapshot'
import type { Status } from '../data/types'

export interface ShellCrew { id: string; name: string; role: string; status: Status; alerts: number }
export interface ShellData { crew: ShellCrew[]; crewId: string; now: number; pendingSync: number }

/** What the app shell needs on every screen: each crew member's worst status (avatar rings), mission time and the sync queue. */
export function useShellData(): ShellData | null {
  const ready = useBoard((s) => s.boot.state === 'ready')
  const selected = useBoard((s) => s.crewId)
  const [data, setData] = useState<ShellData | null>(null)
  useEffect(() => {
    if (!ready) return
    const sub = liveQuery(async () => {
      const first = await loadSnapshot(selected)
      if (!first) return null
      const snaps = await Promise.all(first.crew.map((c) => (c.id === first.crewId ? first : loadSnapshot(c.id))))
      return {
        crew: first.crew.map((c, i) => ({ ...c, status: snaps[i]?.overall ?? 'nominal', alerts: snaps[i]?.alerts.length ?? 0 })),
        crewId: first.crewId, now: first.now, pendingSync: first.pendingSync,
      } satisfies ShellData
    }).subscribe({ next: setData, error: () => setData(null) })
    return () => sub.unsubscribe()
  }, [ready, selected])
  return data
}
