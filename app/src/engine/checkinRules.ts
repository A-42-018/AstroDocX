import { ConsoleDB, db } from '../data/db'
import type { CheckIn, Hazard, Status, Timestamp } from '../data/types'
import { DAY, MISSION_START } from '../data/synthetic'
import { met } from './actions'
import { applyRule, type ProcessResult } from './pipeline'

/**
 * Rules over the daily check-in answers that have no sensor: reported symptoms and self-rated sleep
 * quality. Thresholds are **illustrative**. Vision change is treated as a red flag because of
 * Spaceflight Associated Neuro-ocular Syndrome (SANS), a NASA Human Research Program risk:
 * https://www.nasa.gov/reference/risk-of-spaceflight-associated-neuro-ocular-syndrome-sans/
 */

/** Hazard each symptom points to (illustrative mapping). */
export const SYMPTOM_HAZARD: Record<string, Hazard> = {
  Headache: 'E', // classic early CO₂ symptom
  'Skin rash': 'E',
  Nausea: 'G', // space adaptation
  Dizziness: 'G',
  Congestion: 'G', // headward fluid shift
  'Back pain': 'G', // spinal elongation in microgravity
  'Blurred vision': 'G', // SANS
  Fatigue: 'I',
}
export const RED_FLAG = 'Blurred vision'
/** Same symptom on this many consecutive check-ins raises a Watch. */
export const PERSIST_CHECKINS = 3
/** This many different symptoms in one check-in raises a Watch. */
export const MANY_SYMPTOMS = 3
/** The red-flag symptom on this many consecutive check-ins raises an Act. */
export const RED_FLAG_CHECKINS = 2
/** Sleep quality at or below this (1-5) on PERSIST_CHECKINS consecutive check-ins raises a Watch. */
export const POOR_SLEEP_QUALITY = 2

export interface RuleOutcome {
  status: Status
  hazard: Hazard
  explanation: string
}

const inAll = (list: CheckIn[], s: string) => list.length > 0 && list.every((c) => c.symptoms.includes(s))

/** `recent`: one person's check-ins, one per mission day, newest first. */
export function symptomRule(recent: CheckIn[], who: string): RuleOutcome {
  const nominal: RuleOutcome = { status: 'nominal', hazard: 'G', explanation: '' }
  const latest = recent[0]
  if (!latest) return nominal
  const span = (n: number) => `${met(recent[n - 1].ts)} to ${met(latest.ts)}`

  if (recent.length >= RED_FLAG_CHECKINS && inAll(recent.slice(0, RED_FLAG_CHECKINS), RED_FLAG)) {
    return { status: 'act', hazard: 'G', explanation: `${who} reported blurred vision on ${RED_FLAG_CHECKINS} daily check-ins in a row (${span(RED_FLAG_CHECKINS)}). Vision change can be a sign of SANS (NASA HRP); illustrative rule.` }
  }
  if (recent.length >= PERSIST_CHECKINS) {
    const lasting = latest.symptoms.filter((s) => inAll(recent.slice(0, PERSIST_CHECKINS), s))
    if (lasting.length) {
      return { status: 'watch', hazard: SYMPTOM_HAZARD[lasting[0]] ?? 'G', explanation: `${who} reported ${lasting.join(', ').toLowerCase()} on ${PERSIST_CHECKINS} daily check-ins in a row (${span(PERSIST_CHECKINS)}).` }
    }
  }
  if (latest.symptoms.length >= MANY_SYMPTOMS) {
    const hz = latest.symptoms.map((s) => SYMPTOM_HAZARD[s] ?? 'G')
    const most = hz.sort((a, b) => hz.filter((x) => x === b).length - hz.filter((x) => x === a).length)[0]
    return { status: 'watch', hazard: most, explanation: `${who} reported ${latest.symptoms.length} symptoms at ${met(latest.ts)}: ${latest.symptoms.join(', ').toLowerCase()}.` }
  }
  return nominal
}

export function sleepQualityRule(recent: CheckIn[], who: string): RuleOutcome {
  const last = recent.slice(0, PERSIST_CHECKINS)
  if (last.length === PERSIST_CHECKINS && last.every((c) => c.sleepQuality <= POOR_SLEEP_QUALITY)) {
    return { status: 'watch', hazard: 'I', explanation: `${who} rated sleep ${last.map((c) => c.sleepQuality).reverse().join(', ')} out of 5 on the last ${PERSIST_CHECKINS} daily check-ins (${met(last[PERSIST_CHECKINS - 1].ts)} to ${met(last[0].ts)}).` }
  }
  return { status: 'nominal', hazard: 'I', explanation: '' }
}

/**
 * One check-in per mission day counts, the latest that day (a second check-in the same day replaces the
 * first), so saving twice cannot fake a streak. Returns newest first.
 */
export function perDay(list: CheckIn[], start = MISSION_START): CheckIn[] {
  const byDay = new Map<number, CheckIn>()
  for (const c of list) {
    const day = Math.floor((c.ts - start) / DAY)
    const prev = byDay.get(day)
    if (!prev || c.ts > prev.ts || (c.ts === prev.ts && (c.id ?? 0) > (prev.id ?? 0))) byDay.set(day, c)
  }
  return [...byDay.values()].sort((a, b) => b.ts - a.ts)
}

/** Evaluate both rules for one person after a check-in is saved; opens, updates or resolves their alerts. */
export async function processCheckInRules(crewId: string, ts: Timestamp, d: ConsoleDB = db): Promise<ProcessResult[]> {
  const who = (await d.crew.get(crewId))?.name ?? 'this crew member'
  const recent = perDay(await d.checkIns.where('crewId').equals(crewId).toArray()).slice(0, Math.max(PERSIST_CHECKINS, RED_FLAG_CHECKINS))
  const sym = symptomRule(recent, who)
  const slq = sleepQualityRule(recent, who)
  const count = recent[0]?.symptoms.length ?? 0
  return [
    await applyRule(d, crewId, 'symptoms', { status: sym.status, kind: 'checkin', metric: 'mood', hazard: sym.hazard, z: count, value: count, baselineMean: 0, explanation: sym.explanation }, ts),
    await applyRule(d, crewId, 'sleep-quality', { status: slq.status, kind: 'checkin', metric: 'sleep', hazard: slq.hazard, z: 0, value: recent[0]?.sleepQuality ?? 0, baselineMean: 0, explanation: slq.explanation }, ts),
  ]
}
