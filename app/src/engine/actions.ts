import { METRICS, type Alert, type MetricId, type Status, type Timestamp } from '../data/types'
import { MISSION_START } from '../data/synthetic'
import { sdOf } from './baseline'
import type { Baseline } from '../data/types'

export type AlertLevel = Exclude<Status, 'nominal'>

/** Illustrative crew actions for a concept prototype; real procedures come from flight rules and the flight surgeon. */
const STEPS: Partial<Record<MetricId, Record<AlertLevel, string[]>>> = {
  co2: {
    watch: ['Check the scrubber status and cabin fans', 'Reduce strenuous activity and open vent paths', 'Re-check CO₂ in 30 minutes'],
    act: ['Switch to the backup scrubber and notify the commander', 'Stop strenuous activity; move to the lowest-CO₂ module', 'Put on the portable breathing mask if headache or dyspnea appears', 'Request ground support at the next link window'],
  },
  dose: {
    watch: ['Move to the better-shielded area while the rate stays elevated', 'Postpone EVA and non-essential tasks outside the shelter', 'Re-check the dose rate in 30 minutes'],
    act: ['Move the whole crew to the storm shelter', 'Cancel all EVA and log the time of exposure', 'Report the event to the ground at the next link window'],
  },
  sleep: {
    watch: ['Protect an 8-hour sleep window tonight', 'Dim lights and limit screens for 1 hour before bed', 'Log how you slept in the morning check-in'],
    act: ['Swap safety-critical tasks to a rested crewmate', 'Take a scheduled rest period and a 20-minute nap', 'Notify the commander and the flight surgeon'],
  },
  reaction: {
    watch: ['Repeat the reaction test after a short break', 'Avoid safety-critical operations until it is back to normal', 'Check sleep and hydration'],
    act: ['Hand off safety-critical tasks', 'Rest 30 minutes, then repeat the test', 'Notify the commander and the flight surgeon'],
  },
  exercise: {
    watch: ['Add a make-up resistive session today', 'Keep to the planned daily exercise schedule', 'Log the session'],
    act: ['Schedule a full exercise block with the commander today', 'Check the exercise hardware for faults', 'Review the plan with the flight surgeon at the next link window'],
  },
  hr: {
    watch: ['Rest for 10 minutes and re-measure', 'Hydrate', 'Note caffeine, exercise and stress in the log'],
    act: ['Stop activity and sit down; re-measure after 10 minutes', 'Perform the on-board ECG check if available', 'Notify the commander and the flight surgeon'],
  },
  hrv: {
    watch: ['Prioritise sleep and recovery today', 'Keep exercise light and regular', 'Re-check tomorrow morning'],
    act: ['Reduce workload and rest', 'Review sleep, exercise and stress with the flight surgeon', 'Re-check after a full rest period'],
  },
  spo2: {
    watch: ['Re-measure with a properly seated sensor', 'Check cabin CO₂ and oxygen levels', 'Re-check in 15 minutes'],
    act: ['Check cabin oxygen and CO₂ immediately', 'Stop activity and breathe slowly; re-measure', 'Notify the commander and request ground support'],
  },
}
const GENERIC: Record<AlertLevel, string[]> = {
  watch: ['Re-check the reading in 30 minutes', 'Note any symptoms in the log', 'Tell the commander if it persists'],
  act: ['Stop non-essential tasks', 'Notify the commander and the flight surgeon', 'Re-check the reading in 15 minutes'],
}
const BEHAVIORAL: Record<AlertLevel, string[]> = {
  watch: ['Protect tonight’s sleep window', 'Take a short break and repeat the reaction test', 'Keep safety-critical tasks paired with a rested crewmate'],
  act: GENERIC.act,
}

const SYMPTOMS: Record<AlertLevel, string[]> = {
  watch: ['Rate each symptom (mild / moderate / severe) in the log', 'If headache or congestion: check cabin CO₂', 'Rest and hydrate; repeat the check-in tomorrow', 'Tell the commander if it gets worse'],
  act: ['Do the on-board vision check (acuity and Amsler grid) and log the result', 'Stop tasks that need fine visual work until reviewed', 'Notify the commander and the flight surgeon at the next link window'],
}

/** Rules that are not a single metric have their own step lists. */
const RULE_STEPS: Record<string, Record<AlertLevel, string[]>> = {
  'sleep+reaction': BEHAVIORAL,
  symptoms: SYMPTOMS,
  'sleep-quality': STEPS.sleep!,
}

/** Steps for an alert: by rule id when the rule has its own list, otherwise by metric. */
export function stepsFor(rule: MetricId | string, level: AlertLevel) {
  const list = RULE_STEPS[rule]?.[level] ?? STEPS[rule as MetricId]?.[level] ?? GENERIC[level]
  return list.map((text) => ({ text, done: false }))
}

const RULE_TITLE: Record<string, string> = { 'sleep+reaction': 'Sleep and reaction time', symptoms: 'Reported symptoms', 'sleep-quality': 'Self-reported sleep quality' }

/** Display name of an alert, used by every screen. */
export const alertTitle = (a: Pick<Alert, 'ruleId' | 'metric'>) => RULE_TITLE[a.ruleId] ?? METRICS[a.metric].label

/** "D3 07:00 MET": mission elapsed time from the mission start. */
export function met(ts: Timestamp, start: Timestamp = MISSION_START): string {
  const mins = Math.max(0, Math.round((ts - start) / 60000))
  const d = Math.floor(mins / 1440)
  const h = Math.floor((mins % 1440) / 60)
  return `D${d} ${String(h).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')} MET`
}

const dec = (m: MetricId) => (METRICS[m].unit === 'ms' || METRICS[m].unit === 'min' || METRICS[m].unit === 'bpm' ? 0 : 2)
const fmt = (m: MetricId, v: number) => `${v.toFixed(dec(m))} ${METRICS[m].unit}`

/** What changed, by how much, against whose baseline, since when. */
export function explainBaseline(b: Baseline, value: number, z: number, since: Timestamp, who: string): string {
  const def = METRICS[b.metric]
  const dir = def.bad === 0 ? (value > b.mean ? 'above' : 'below') : def.bad > 0 ? 'above' : 'below'
  return `${def.label} ${fmt(b.metric, value)} is ${z.toFixed(1)}σ ${dir} ${who}’s baseline (${fmt(b.metric, b.mean)}, sd ${sdOf(b).toFixed(dec(b.metric))}). Started at ${met(since)}.`
}

export function explainCombined(who: string, sleep: { value: number; z: number }, reaction: { value: number; z: number }, since: Timestamp): string {
  return `${who} slept ${sleep.value.toFixed(1)} h (${sleep.z.toFixed(1)}σ below baseline) and reaction time is ${reaction.value.toFixed(0)} ms (${reaction.z.toFixed(1)}σ slower). Together they suggest fatigue affecting performance. Started at ${met(since)}.`
}
