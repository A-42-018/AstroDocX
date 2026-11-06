import { HAZARDS, loadSnapshot, type Snapshot } from '../board/snapshot'
import { ConsoleDB, db } from '../data/db'
import { METRICS, type Alert, type Baseline, type CheckIn, type CrewMember, type Hazard, type MetricId, type Status } from '../data/types'
import { alertTitle, met } from '../engine/actions'
import { warmupFor } from '../engine/baseline'
import { evidenceFor } from '../engine/evidence'
import { CAREER_DOSE_MSV } from '../engine/limits'
import { standardFor } from '../engine/nasa'
import { cumulativeDoseMsv } from '../engine/pipeline'

/*
 * VITA, the crew doctor: reads every crew member's board data together and says what matters and what to do next.
 * Everything here is rules over what the engine already computed (alerts, baselines, readiness, dose, the ground
 * link), so it works offline and every line can be traced back to a reading. On top of single alerts it looks across
 * the crew: the same environmental alert on two or more people is one cabin problem, poor sleep on two or more people
 * is a scheduling problem, and the crew is put in triage order. It advises; the flight surgeon decides.
 */

export type Scope = 'all' | string
export type Priority = 'now' | 'today' | 'next-link'

export interface Finding {
  /** Stable across updates (rule + who), so a new finding can be spotted. */
  id: string
  crewIds: string[]
  hazard: Hazard
  metric: MetricId
  /** 'nominal' only on the watchlist: drifting, no alert yet. */
  status: Status
  title: string
  /** The engine's own explanation (what changed, by how much, against whose baseline, since when). */
  why: string
  since: number
  /** The same environmental alert on two or more crew: one cabin problem, not several personal ones. */
  cabinWide: boolean
  /** The NASA basis behind the metric, if one is mapped. */
  ref?: { label: string; url: string }
}

export interface Advice {
  priority: Priority
  /** Crew ids the step is for; empty means the whole crew. */
  crewIds: string[]
  text: string
  /** The finding it answers, as a short title. */
  why: string
}

export interface CrewExam {
  id: string
  name: string
  role: string
  status: Status
  readiness: number
  /** Name of the worst hazard, or null when all are nominal. */
  worstHazard: string | null
  alerts: number
  evaFit: boolean
  evaWhy: string
}

export interface HazardCheck { hazard: Hazard; name: string; status: Status; line: string }

export interface DoctorReport {
  scope: Scope
  at: number
  /** "D29 23:00 MET". */
  met: string
  overall: Status
  headline: string
  /** Triage order: worst status first, then lowest readiness. */
  crew: CrewExam[]
  /** Every crew member's id and name, whatever the scope (advice can name people outside it). */
  roster: { id: string; name: string }[]
  findings: Finding[]
  advice: Advice[]
  watchlist: Finding[]
  checks: HazardCheck[]
  /** Mission-level numbers the brief and the ground handoff quote. */
  mission: { crewCount: number; pendingSync: number; sinceSyncH: number | null; oldestPendingH: number | null; maxDoseMsv: number }
}

/** What the exam reads for one crew member. */
export interface CrewInput { member: CrewMember; snap: Snapshot; baselines: Baseline[]; doseMsv: number; checkIn?: CheckIn }

const RANK: Record<Status, number> = { nominal: 0, watch: 1, act: 2 }
const worst = (a: Status, b: Status): Status => (RANK[a] >= RANK[b] ? a : b)
/** Metrics that belong to the cabin, not the person: an alert on two or more crew points at the cabin. */
const SHARED: ReadonlySet<MetricId> = new Set<MetricId>(['co2', 'temp', 'noise', 'dose'])
const FATIGUE = new Set(['sleep', 'reaction', 'sleep+reaction', 'sleep-quality'])
/** Rules that rule someone out of a spacewalk while open. */
const EVA_BLOCK = new Set(['sleep', 'reaction', 'sleep+reaction', 'sleep-quality', 'hr', 'spo2', 'symptoms', 'dose', 'co2'])
const EVA_READINESS = 70
/** Watchlist: smoothed z at least this far in the bad direction while still nominal. */
const DRIFT_Z = 1.2

/** A label inside a sentence: "Sleep last night" -> "sleep last night", but HRV, CO₂ and SpO₂ stay as they are. */
export const lc = (s: string) => (/^[A-Z][a-z]/.test(s) && !/^SpO/.test(s) ? s[0].toLowerCase() + s.slice(1) : s)

/** "Pilot", "Pilot and Commander", "Pilot, Commander and Flight Engineer". */
export function names(ids: string[], crew: { id: string; name: string }[]): string {
  if (!ids.length) return 'the whole crew'
  const n = ids.map((id) => crew.find((c) => c.id === id)?.name ?? id)
  return n.length === 1 ? n[0] : `${n.slice(0, -1).join(', ')} and ${n[n.length - 1]}`
}

function refFor(metric: MetricId): Finding['ref'] {
  const std = standardFor(metric)
  if (std) return { label: std.tag, url: std.url }
  const ev = evidenceFor(metric)[0]
  return ev ? { label: ev.id.split(' · ')[0], url: ev.url } : undefined
}

/** One finding per open alert, merged across crew for cabin metrics. */
function findingsOf(input: CrewInput[], rank: Map<string, number>): { findings: Finding[]; byFinding: Map<string, Alert[]> } {
  const groups = new Map<string, Alert[]>()
  for (const c of input) for (const a of c.snap.alerts) {
    const key = SHARED.has(a.metric) ? `cabin:${a.ruleId}` : `${a.ruleId}:${c.member.id}`
    groups.set(key, [...(groups.get(key) ?? []), a])
  }
  const findings: Finding[] = []
  const byFinding = new Map<string, Alert[]>()
  for (const [key, alerts] of groups) {
    const cabinWide = key.startsWith('cabin:') && alerts.length >= 2
    // a cabin metric on a single person stays a personal finding
    const ids = [...new Set(alerts.map((a) => a.crewId))]
    const id = cabinWide ? key : `${alerts[0].ruleId}:${ids.join('+')}`
    const top = [...alerts].sort((a, b) => RANK[b.status] - RANK[a.status])[0]
    const status = alerts.reduce<Status>((s, a) => worst(s, a.status), 'nominal')
    const crewNames = input.map((c) => c.member)
    findings.push({
      id, crewIds: ids, hazard: top.hazard, metric: top.metric, status,
      title: cabinWide ? `Cabin ${lc(alertTitle(top).replace(/^Cabin /, ''))} (${ids.length} crew)` : `${names(ids, crewNames)}: ${lc(alertTitle(top))}`,
      why: top.explanation,
      since: Math.min(...alerts.map((a) => a.openedAt)),
      cabinWide,
      ref: refFor(top.metric),
    })
    byFinding.set(id, alerts)
  }
  // worst first; within a level, cabin-wide first, then in the crew's triage order
  const order = (f: Finding) => Math.min(...f.crewIds.map((id) => rank.get(id) ?? 99))
  findings.sort((a, b) => RANK[b.status] - RANK[a.status] || Number(b.cabinWide) - Number(a.cabinWide) || order(a) - order(b) || a.since - b.since)
  return { findings, byFinding }
}

/** Metrics drifting the wrong way that have not alerted (yet): worth a look, nothing to do. */
function watchlistOf(input: CrewInput[], alerted: Set<string>): Finding[] {
  const drifting = input.flatMap((c) => c.baselines
    .filter((b) => b.status === 'nominal' && b.n >= warmupFor(b.metric) && b.ewma >= DRIFT_Z && !alerted.has(`${c.member.id}:${b.metric}`))
    .map((b) => ({ c, b })))
  return drifting.sort((x, y) => y.b.ewma - x.b.ewma).slice(0, 6).map(({ c, b }) => {
    const def = METRICS[b.metric]
    return {
      id: `drift:${b.metric}:${c.member.id}`, crewIds: [c.member.id], hazard: def.hazard, metric: b.metric, status: 'nominal' as Status,
      title: `${c.member.name}: ${lc(def.label)} drifting`,
      why: `${def.label} is ${b.ewma.toFixed(1)}σ ${def.bad === -1 ? 'on the low side of' : def.bad === 1 ? 'on the high side of' : 'away from'} ${c.member.name}’s baseline, short of the 1.8σ watch level.`,
      since: b.updatedAt, cabinWide: false, ref: refFor(b.metric),
    }
  })
}

function evaFor(c: CrewInput): { evaFit: boolean; evaWhy: string } {
  const act = c.snap.alerts.find((a) => a.status === 'act')
  if (act) return { evaFit: false, evaWhy: `Not cleared: ${lc(alertTitle(act))} is at ACT.` }
  const block = c.snap.alerts.find((a) => EVA_BLOCK.has(a.ruleId))
  if (block) return { evaFit: false, evaWhy: `Not cleared: open ${lc(alertTitle(block))} alert.` }
  if (c.snap.readiness < EVA_READINESS) return { evaFit: false, evaWhy: `Not cleared: readiness ${c.snap.readiness} is under ${EVA_READINESS}.` }
  if (c.doseMsv >= CAREER_DOSE_MSV * 0.9) return { evaFit: false, evaWhy: `Not cleared: ${c.doseMsv.toFixed(0)} mSv is near the ${CAREER_DOSE_MSV} mSv career limit.` }
  return { evaFit: true, evaWhy: `Cleared: no open alerts on sleep, heart or air; readiness ${c.snap.readiness}.` }
}

function adviceOf(input: CrewInput[], findings: Finding[], byFinding: Map<string, Alert[]>, mission: DoctorReport['mission']): Advice[] {
  const crew = input.map((c) => c.member)
  const out: Advice[] = []
  const add = (a: Advice) => {
    const same = out.find((x) => x.text === a.text)
    if (!same) { out.push(a); return }
    same.crewIds = [...new Set([...same.crewIds, ...a.crewIds])]
    if (PRI[a.priority] < PRI[same.priority]) same.priority = a.priority
  }
  for (const f of findings) {
    const alerts = byFinding.get(f.id) ?? []
    const top = [...alerts].sort((a, b) => RANK[b.status] - RANK[a.status])[0]
    const open = top?.steps.filter((s) => !s.done) ?? []
    open.forEach((s, i) => add({ priority: f.status === 'act' && i < 2 ? 'now' : 'today', crewIds: f.cabinWide ? [] : f.crewIds, text: s.text, why: f.title }))
  }
  const tired = [...new Set(findings.filter((f) => FATIGUE.has(f.id.split(':')[0])).flatMap((f) => f.crewIds))]
  if (tired.length >= 2) add({ priority: 'today', crewIds: tired, text: `Re-plan today’s schedule: protect sleep for ${names(tired, crew)} and pair their safety-critical tasks with a rested crewmate`, why: 'Fatigue in more than one crew member' })
  const acts = findings.filter((f) => f.status === 'act')
  if (acts.length) add({ priority: 'next-link', crewIds: [...new Set(acts.flatMap((f) => f.crewIds))], text: `Brief the flight surgeon on ${acts.map((f) => f.title.replace(/^[^:]+: /, '')).join(', ')}`, why: 'ACT-level findings' })
  if (mission.oldestPendingH !== null && mission.oldestPendingH >= 24) add({ priority: 'next-link', crewIds: [], text: `Send the ${mission.pendingSync} pending log entries at the next link window (the oldest is ${Math.round(mission.oldestPendingH)} h old)`, why: 'Ground link' })
  return out.sort((a, b) => PRI[a.priority] - PRI[b.priority])
}
const PRI: Record<Priority, number> = { now: 0, today: 1, 'next-link': 2 }

function checksOf(input: CrewInput[], findings: Finding[]): HazardCheck[] {
  const crew = input.map((c) => c.member)
  return HAZARDS.map((h) => {
    const tiles = input.map((c) => ({ c, t: c.snap.tiles.find((t) => t.hazard === h.id)! }))
    const status = tiles.reduce<Status>((s, x) => worst(s, x.t.status), 'nominal')
    const hit = findings.filter((f) => f.hazard === h.id)
    let line: string
    if (h.id === 'D') {
      const t = tiles[0].t
      line = t.value === 'never' ? 'Never synced with the ground yet' : `${t.value} h since the last ground sync, ${t.label.replace(/^.*· /, '')}`
    } else if (hit.length) {
      const people = new Map<string, { status: Status; n: number }>()
      for (const f of hit.filter((x) => !x.cabinWide)) for (const id of f.crewIds) {
        const p = people.get(id)
        people.set(id, { status: p ? worst(p.status, f.status) : f.status, n: (p?.n ?? 0) + 1 })
      }
      line = [...hit.filter((f) => f.cabinWide).map((f) => `${f.title} ${f.status.toUpperCase()}`),
        ...[...people].map(([id, p]) => `${names([id], crew)} ${p.status.toUpperCase()}${p.n > 1 ? ` (${p.n} findings)` : ''}`)].join('; ')
    } else if (h.id === 'R') {
      const max = Math.max(0, ...input.map((c) => c.doseMsv))
      line = `Within limits: ${max.toFixed(1)} of ${CAREER_DOSE_MSV} mSv career dose at most`
    } else {
      line = `${h.tracks}: within baseline${input.length > 1 ? ' for everyone' : ''}`
    }
    return { hazard: h.id, name: h.name, status, line }
  })
}

const triage = (a: CrewExam, b: CrewExam) => RANK[b.status] - RANK[a.status] || a.readiness - b.readiness

/** The exam itself: pure, over what was loaded. `scope` narrows the report to one member but keeps cabin-wide context. */
export function examine(input: CrewInput[], scope: Scope = 'all'): DoctorReport {
  const all = input.map((c) => c.member)
  const first = input[0]?.snap
  const at = first?.now ?? 0
  const mission = {
    crewCount: input.length,
    pendingSync: first?.pendingSync ?? 0,
    sinceSyncH: first?.sinceSyncH ?? null,
    oldestPendingH: first?.oldestPendingH ?? null,
    maxDoseMsv: Math.max(0, ...input.map((c) => c.doseMsv)),
  }
  const exams = input.map((c) => {
    const w = c.snap.tiles.filter((t) => t.status !== 'nominal').sort((a, b) => RANK[b.status] - RANK[a.status] || a.score - b.score)[0]
    return { id: c.member.id, name: c.member.name, role: c.member.role, status: c.snap.overall, readiness: c.snap.readiness, worstHazard: w?.name ?? null, alerts: c.snap.alerts.length, ...evaFor(c) }
  }).sort(triage)
  const { findings: allFindings, byFinding } = findingsOf(input, new Map(exams.map((c, i) => [c.id, i])))
  const alerted = new Set(input.flatMap((c) => c.snap.alerts.map((a) => `${c.member.id}:${a.metric}`)))
  const one = scope !== 'all' ? input.find((c) => c.member.id === scope) : undefined
  const inScope = (ids: string[]) => !one || !ids.length || ids.includes(one.member.id)
  const findings = allFindings.filter((f) => inScope(f.crewIds))
  const advice = adviceOf(input, allFindings, byFinding, mission).filter((a) => inScope(a.crewIds))
  const watchlist = watchlistOf(one ? [one] : input, alerted)
  const crew: CrewExam[] = one ? exams.filter((c) => c.id === one.member.id) : exams
  const overall = crew.reduce<Status>((s, c) => worst(s, c.status), 'nominal')
  const checks = checksOf(one ? [one] : input, findings)
  return { scope: one ? one.member.id : 'all', at, met: met(at), overall, headline: headlineOf(crew, findings, all, !!one), crew, roster: all.map(({ id, name }) => ({ id, name })), findings, advice, watchlist, checks, mission }
}

function headlineOf(crew: CrewExam[], findings: Finding[], all: CrewMember[], single: boolean): string {
  if (single) {
    const c = crew[0]
    if (!c) return 'No data for this crew member yet.'
    const f = findings.find((x) => x.crewIds.includes(c.id))
    return f ? `${c.name}: ${f.cabinWide ? lc(f.title) : f.title.replace(/^[^:]+: /, '')} at ${f.status.toUpperCase()}; readiness ${c.readiness}.` : `${c.name} is within baseline on every hazard; readiness ${c.readiness}.`
  }
  const flagged = crew.filter((c) => c.status !== 'nominal')
  if (!flagged.length) return `All ${crew.length} crew are within their baselines. Nothing needs action right now.`
  const lead = flagged[0]
  const f = findings.find((x) => x.crewIds.includes(lead.id)) ?? findings[0]
  const what = f ? (f.cabinWide ? lc(f.title) : f.title.replace(/^[^:]+: /, '')) : 'an open alert'
  return `${flagged.length} of ${all.length} crew need attention. ${lead.name} first: ${what} at ${lead.status.toUpperCase()}.`
}

/** Load everything the exam reads, for every crew member. */
export async function loadCrewInputs(d: ConsoleDB = db): Promise<CrewInput[]> {
  const crew = await d.crew.toArray()
  return Promise.all(crew.map(async (member) => {
    const [snap, baselines, doseMsv, checkIn] = await Promise.all([
      loadSnapshot(member.id, d),
      d.baselines.where('crewId').equals(member.id).toArray(),
      cumulativeDoseMsv(member.id, d),
      d.checkIns.where('crewId').equals(member.id).last(),
    ])
    return { member, snap: snap!, baselines, doseMsv, checkIn }
  })).then((xs) => xs.filter((x) => x.snap))
}

/** The crew exam, straight from the database (wrap in liveQuery to follow changes). */
export async function loadCrewExam(scope: Scope = 'all', d: ConsoleDB = db): Promise<DoctorReport | null> {
  const input = await loadCrewInputs(d)
  return input.length ? examine(input, scope) : null
}
