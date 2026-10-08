import { liveQuery } from 'dexie'
import { createContext, useContext, useEffect, useState } from 'react'
import { useBoard } from '../board/store'
import { loadSnapshot, type HazardTile, type Snapshot } from '../board/snapshot'
import type { Status } from '../data/types'

export interface ShellCrew {
  id: string; name: string; role: string; status: Status; alerts: number
  readiness: number
  /** Name of the worst hazard, or null when every hazard is nominal. */
  worstHazard: string | null
}
export interface ShellData { crew: ShellCrew[]; crewId: string; now: number; pendingSync: number; sinceSyncH: number | null }

const RANK = { nominal: 0, watch: 1, act: 2 }
function worstHazard(s: Snapshot | null | undefined): string | null {
  const t = s?.tiles.reduce<HazardTile | null>((w, x) => (!w || RANK[x.status] > RANK[w.status] || (RANK[x.status] === RANK[w.status] && x.score < w.score) ? x : w), null)
  return t && t.status !== 'nominal' ? t.name : null
}

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
        crew: first.crew.map((c, i) => ({ ...c, status: snaps[i]?.overall ?? 'nominal', alerts: snaps[i]?.alerts.length ?? 0, readiness: snaps[i]?.readiness ?? 0, worstHazard: worstHazard(snaps[i]) })),
        crewId: first.crewId, now: first.now, pendingSync: first.pendingSync, sinceSyncH: first.sinceSyncH,
      } satisfies ShellData
    }).subscribe({ next: setData, error: () => setData(null) })
    return () => sub.unsubscribe()
  }, [ready, selected])
  return data
}

/** The shell's data, shared with screens that show the whole crew (the board's crew overview). */
export const ShellDataContext = createContext<ShellData | null>(null)
export const useShellContext = () => useContext(ShellDataContext)
