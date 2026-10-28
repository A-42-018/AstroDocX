import { db, readingsFor, type ConsoleDB } from '../data/db'
import { DAY } from '../data/synthetic'
import { METRICS, type Alert, type Hazard, type Status } from '../data/types'
import type { LiveValues } from '../live/telemetry'

/** One astronaut in the cabin: who they are, the engine's verdict and the live (1 Hz) signals. */
export interface CabinCrew { id: string; name: string; role: string; status: Status; alerts: number; readiness: number; live: LiveValues }
/** One of the five hazard modules for the helmet wearer, as the visor's side ladder shows it. */
export interface CabinHazard { id: Hazard; name: string; status: Status; score: number }
/** An alert as the in-cabin panel shows it: what, why and the next step, in the engine's own words. */
export interface CabinAlert { id: number; crewId: string; title: string; detail: string; why: string; next: string; status: Status | 'resolved' }
/** 30 days of daily mean heart rate for the focus crew member, the crew median and their personal band. */
export interface CabinTrend { crewId: string; days: number[]; median: number[]; band: [number, number] | null }
export interface CabinData {
  crew: CabinCrew[]
  /** The crew member the Live Vitals and Trends panels follow. */
  focusId: string
  /** The crew member wearing the helmet (the console's selected crew). */
  selfId: string
  alerts: CabinAlert[]
  trend: CabinTrend | null
  /** The helmet wearer's five hazard modules (empty until loaded). */
  hazards: CabinHazard[]
  /** Mission "now" (latest reading) and the ground link: entries waiting to sync, hours since the last sync. */
  now: number
  link: { pending: number; sinceSyncH: number | null }
}

const RANK: Record<Status, number> = { nominal: 0, watch: 1, act: 2 }

/** Worst status first, then the most open alerts; with everyone nominal, the selected crew member. */
export function pickFocus(crew: readonly { id: string; status: Status; alerts: number }[], selected: string): string {
  let best = crew.find((c) => c.id === selected) ?? crew[0]
  for (const c of crew) if (RANK[c.status] > RANK[best.status] || (RANK[c.status] === RANK[best.status] && c.alerts > best.alerts)) best = c
  return best?.id ?? selected
}

const fmt = (v: number) => (Math.abs(v) >= 100 ? v.toFixed(0) : v.toFixed(1))

export function toCabinAlert(a: Alert, crewName: string): CabinAlert {
  const m = METRICS[a.metric]
  return {
    id: a.id ?? 0,
    crewId: a.crewId,
    title: `${crewName} · ${m.label}`,
    detail: `${fmt(a.value)} ${m.unit} vs baseline ${fmt(a.baselineMean)} ${m.unit}`,
    why: a.explanation,
    next: a.steps.find((s) => !s.done)?.text ?? 'All steps done',
    status: a.state === 'resolved' ? 'resolved' : a.status,
  }
}

/** Open and acknowledged alerts, worst first; topped up with the latest resolved ones so the panel is never empty. */
export async function loadCabinAlerts(names: ReadonlyMap<string, string>, limit = 3, d: ConsoleDB = db): Promise<CabinAlert[]> {
  const all = await d.alerts.toArray()
  const live = all.filter((a) => a.state !== 'resolved').sort((a, b) => RANK[b.status] - RANK[a.status] || b.openedAt - a.openedAt)
  const done = all.filter((a) => a.state === 'resolved').sort((a, b) => (b.resolvedAt ?? 0) - (a.resolvedAt ?? 0))
  return [...live, ...done].slice(0, limit).map((a) => toCabinAlert(a, names.get(a.crewId) ?? a.crewId))
}

/** Mean per day over `n` days from `from`; a day without readings repeats the day before (or the first reading). */
export function dailyMeans(rows: readonly { ts: number; value: number }[], from: number, n: number): number[] {
  const sum = new Array<number>(n).fill(0), cnt = new Array<number>(n).fill(0)
  for (const r of rows) {
    const i = Math.floor((r.ts - from) / DAY)
    if (i >= 0 && i < n) { sum[i] += r.value; cnt[i]++ }
  }
  const first = rows.length ? rows[0].value : 0
  const out: number[] = []
  for (let i = 0; i < n; i++) out.push(cnt[i] ? sum[i] / cnt[i] : (out[i - 1] ?? first))
  return out
}

export const median = (xs: readonly number[]) => {
  const s = [...xs].sort((a, b) => a - b), m = s.length >> 1
  return s.length ? (s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2) : 0
}

/** Heart rate for the Trends panel: the focus crew member, the crew median per day and their mean +-1 sd. */
export async function loadCabinTrend(crewId: string, now: number, days = 30, d: ConsoleDB = db): Promise<CabinTrend> {
  const from = Math.floor(now / DAY) * DAY - (days - 1) * DAY
  const crew = await d.crew.toArray()
  const rows = await Promise.all(crew.map((c) => readingsFor(c.id, 'hr', from, now, d)))
  const per = rows.map((r) => dailyMeans(r.sort((a, b) => a.ts - b.ts), from, days))
  const mine = per[crew.findIndex((c) => c.id === crewId)] ?? []
  const base = await d.baselines.get([crewId, 'hr'])
  const sd = base && base.n > 1 ? Math.sqrt(base.m2 / (base.n - 1)) : 0
  return {
    crewId,
    days: mine,
    median: Array.from({ length: days }, (_, i) => median(per.map((p) => p[i]))),
    band: base ? [base.mean - sd, base.mean + sd] : null,
  }
}
