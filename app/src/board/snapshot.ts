import { ConsoleDB, db } from '../data/db'
import { METRICS, type Alert, type Baseline, type CrewMember, type Hazard, type MetricId, type Status } from '../data/types'
import { HOUR, MISSION_START } from '../data/synthetic'

export interface HazardMeta {
  id: Hazard
  name: string
  /** Metric shown as the tile's headline (hazard D has none: it shows time since ground sync). */
  headline?: MetricId
  tracks: string
}

export const HAZARDS: HazardMeta[] = [
  { id: 'R', name: 'Radiation', headline: 'dose', tracks: 'Dose rate, cumulative dose' },
  { id: 'I', name: 'Isolation', headline: 'sleep', tracks: 'Sleep, mood, reaction time' },
  { id: 'D', name: 'Distance', tracks: 'Ground link, pending sync' },
  { id: 'G', name: 'Gravity', headline: 'exercise', tracks: 'Exercise, heart rate, HRV' },
  { id: 'E', name: 'Environment', headline: 'co2', tracks: 'CO₂, SpO₂, temperature, noise' },
]

export interface Snapshot {
  crew: CrewMember[]
  crewId: string
  /** Mission "now": the latest reading time. */
  now: number
  tiles: HazardTile[]
  alerts: Alert[]
  readiness: number
  overall: Status
  pendingSync: number
  /** Hours since the last ground sync, or null if there has never been one. */
  sinceSyncH: number | null
}

export interface HazardTile {
  hazard: Hazard
  name: string
  tracks: string
  status: Status
  label: string
  /** Formatted headline value, e.g. "6.9". */
  value: string
  unit: string
  /** 0-100 health score for this hazard (feeds readiness). */
  score: number
  alerts: Alert[]
}

const RANK: Record<Status, number> = { nominal: 0, watch: 1, act: 2 }
export const worst = (a: Status, b: Status): Status => (RANK[a] >= RANK[b] ? a : b)
const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x))

/** Score caps by status: an active alert always lowers readiness even if the smoothed z has eased. */
const SCORE_CAP: Record<Status, number> = { nominal: 100, watch: 80, act: 55 }

/** 100 minus up to 40 points for the worst smoothed z (3σ = full penalty), capped by the hazard's status. */
export function hazardScore(status: Status, worstZ: number): number {
  return Math.round(Math.min(SCORE_CAP[status], 100 - 40 * clamp(worstZ / 3, 0, 1)))
}

/** D (distance) has no sensor: its status comes from the age of the oldest unsynced log entry. */
export function linkStatus(oldestPendingAgeH: number | null): Status {
  if (oldestPendingAgeH === null) return 'nominal'
  return oldestPendingAgeH >= 72 ? 'act' : oldestPendingAgeH >= 24 ? 'watch' : 'nominal'
}

const decimals = (m: MetricId) => (['ms', 'min', 'bpm'].includes(METRICS[m].unit) ? 0 : METRICS[m].id === 'sleep' ? 1 : 2)

export function buildTiles(input: {
  baselines: Baseline[]
  alerts: Alert[]
  latest: Partial<Record<MetricId, number>>
  sinceSyncH: number | null
  oldestPendingAgeH: number | null
  pendingSync: number
}): HazardTile[] {
  return HAZARDS.map((h) => {
    const alerts = input.alerts.filter((a) => a.hazard === h.id)
    let status: Status = alerts.reduce<Status>((s, a) => worst(s, a.status), 'nominal')
    let worstZ = Math.max(0, ...input.baselines.filter((b) => METRICS[b.metric].hazard === h.id).map((b) => b.ewma))
    let value = '--'
    let unit = ''
    let label = h.headline ? METRICS[h.headline].label : 'Since ground sync'
    if (h.headline) {
      const v = input.latest[h.headline]
      if (v !== undefined) value = v.toFixed(decimals(h.headline))
      unit = METRICS[h.headline].unit
    } else {
      const link = linkStatus(input.oldestPendingAgeH)
      status = worst(status, link)
      worstZ = link === 'act' ? 3 : link === 'watch' ? 1.8 : 0
      value = input.sinceSyncH === null ? 'never' : input.sinceSyncH.toFixed(1)
      unit = input.sinceSyncH === null ? '' : 'h'
      label = `Since ground sync · ${input.pendingSync} pending`
    }
    return { hazard: h.id, name: h.name, tracks: h.tracks, status, label, value, unit, score: hazardScore(status, worstZ), alerts }
  })
}

export const readinessOf = (tiles: HazardTile[]) => Math.round(tiles.reduce((a, t) => a + t.score, 0) / tiles.length)
export const overallOf = (tiles: HazardTile[]) => tiles.reduce<Status>((s, t) => worst(s, t.status), 'nominal')

/** Read everything the board needs for one crew member. */
export async function loadSnapshot(crewId: string | undefined, d: ConsoleDB = db): Promise<Snapshot | null> {
  const crew = await d.crew.toArray()
  const id = crewId && crew.some((c) => c.id === crewId) ? crewId : crew[0]?.id
  if (!id) return null
  const last = await d.readings.orderBy('ts').last()
  const now = last?.ts ?? MISSION_START
  const [baselines, alerts, log] = await Promise.all([
    d.baselines.where('crewId').equals(id).toArray(),
    d.alerts.where('[crewId+state]').anyOf([id, 'open'], [id, 'acknowledged']).toArray(),
    d.actionLog.where('crewId').equals(id).toArray(),
  ])
  const latest: Partial<Record<MetricId, number>> = {}
  for (const h of HAZARDS) {
    if (!h.headline) continue
    const r = await d.readings.where('[crewId+metric+ts]').between([id, h.headline, -Infinity], [id, h.headline, Infinity]).last()
    if (r) latest[h.headline] = r.value
  }
  const pending = log.filter((e) => e.sync === 'pending')
  const synced = log.filter((e) => e.syncedAt !== undefined)
  const lastSync = synced.length ? Math.max(...synced.map((e) => e.syncedAt!)) : null
  const sinceSyncH = lastSync === null ? null : Math.max(0, (now - lastSync) / HOUR)
  const oldest = pending.length ? Math.min(...pending.map((e) => e.ts)) : null
  const tiles = buildTiles({
    baselines, alerts, latest, sinceSyncH, pendingSync: pending.length,
    oldestPendingAgeH: oldest === null ? null : Math.max(0, (now - oldest) / HOUR),
  })
  alerts.sort((a, b) => (RANK[b.status] - RANK[a.status]) || b.openedAt - a.openedAt)
  return { crew, crewId: id, now, tiles, alerts, readiness: readinessOf(tiles), overall: overallOf(tiles), pendingSync: pending.length, sinceSyncH }
}
