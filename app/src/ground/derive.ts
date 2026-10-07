import type { ActionLogEntry, CrewMember } from '../data/types'
import { ONE_WAY_DELAY_MIN } from '../sync/link'

/** What Earth knows about one alert, rebuilt only from log entries that have been synced. */
export interface GroundAlert {
  alertId: number
  level: 'watch' | 'act'
  /** Text of the latest synced update. */
  text: string
  openedAt: number
  lastUpdate: number
  stepsDone: number
  resolvedAt?: number
}

export interface GroundCrew {
  crew: CrewMember
  open: GroundAlert[]
  resolved: GroundAlert[]
  lastCheckIn?: ActionLogEntry
  /** Entries still on board for this person (count only: Earth cannot see them). */
  awaiting: number
}

const LEVEL = /^(WATCH|ACT):|(?:Escalated|Eased) to (WATCH|ACT):/
export const levelOf = (text: string): 'watch' | 'act' | null => {
  const m = LEVEL.exec(text)
  const l = m?.[1] ?? m?.[2]
  return l === 'ACT' ? 'act' : l === 'WATCH' ? 'watch' : null
}

/** Time the ground receives an entry: sync time plus one-way light time (illustrative). */
export const receivedAt = (e: ActionLogEntry) => (e.syncedAt ?? e.ts) + ONE_WAY_DELAY_MIN * 60_000

/**
 * Rebuild the ground's picture of each crew member. Only `synced` entries are used; pending entries
 * contribute to `awaiting` and nothing else, which is the point of delay-tolerant sync.
 */
export function deriveGround(crew: CrewMember[], log: ActionLogEntry[]): GroundCrew[] {
  const synced = log.filter((e) => e.sync === 'synced').sort((a, b) => a.ts - b.ts)
  return crew.map((c) => {
    const alerts = new Map<number, GroundAlert>()
    let lastCheckIn: ActionLogEntry | undefined
    for (const e of synced.filter((x) => x.crewId === c.id)) {
      if (e.kind === 'checkin') lastCheckIn = e
      if (e.alertId === undefined) continue
      const a = alerts.get(e.alertId)
      if (e.kind === 'alert-opened' || e.kind === 'note') {
        const level = levelOf(e.text)
        if (!level) continue
        alerts.set(e.alertId, { alertId: e.alertId, level, text: e.text, openedAt: a?.openedAt ?? e.ts, lastUpdate: e.ts, stepsDone: a?.stepsDone ?? 0, resolvedAt: a?.resolvedAt })
      } else if (a && e.kind === 'step-done') {
        alerts.set(e.alertId, { ...a, stepsDone: a.stepsDone + 1, lastUpdate: e.ts })
      } else if (a && e.kind === 'alert-resolved') {
        alerts.set(e.alertId, { ...a, resolvedAt: e.ts, lastUpdate: e.ts })
      }
    }
    const all = [...alerts.values()]
    return {
      crew: c,
      open: all.filter((a) => a.resolvedAt === undefined).sort((a, b) => (a.level === b.level ? b.lastUpdate - a.lastUpdate : a.level === 'act' ? -1 : 1)),
      resolved: all.filter((a) => a.resolvedAt !== undefined).sort((a, b) => b.resolvedAt! - a.resolvedAt!).slice(0, 5),
      lastCheckIn,
      awaiting: log.filter((e) => e.sync === 'pending' && e.crewId === c.id).length,
    }
  })
}
