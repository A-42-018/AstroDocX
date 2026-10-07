/** Domain model for the Crew Console. Thresholds and baselines are illustrative until cited (see plan.md §9.3). */

export type Hazard = 'R' | 'I' | 'D' | 'G' | 'E'
export type Status = 'nominal' | 'watch' | 'act'
export type Source = 'wearable' | 'cabin' | 'checkin' | 'sim'
/** Epoch milliseconds. */
export type Timestamp = number

export type MetricId =
  | 'hr' | 'hrv' | 'spo2' | 'sleep' | 'exercise' | 'reaction' | 'mood'
  | 'co2' | 'temp' | 'noise' | 'dose'

export interface MetricDef {
  id: MetricId
  hazard: Hazard
  label: string
  unit: string
  /** +1: higher is worse, -1: lower is worse, 0: either direction. */
  bad: 1 | -1 | 0
}

export const METRICS: Record<MetricId, MetricDef> = {
  hr: { id: 'hr', hazard: 'G', label: 'Heart rate', unit: 'bpm', bad: 0 },
  hrv: { id: 'hrv', hazard: 'G', label: 'HRV', unit: 'ms', bad: -1 },
  spo2: { id: 'spo2', hazard: 'E', label: 'SpO₂', unit: '%', bad: -1 },
  sleep: { id: 'sleep', hazard: 'I', label: 'Sleep last night', unit: 'h', bad: -1 },
  exercise: { id: 'exercise', hazard: 'G', label: 'Exercise load', unit: 'min', bad: -1 },
  reaction: { id: 'reaction', hazard: 'I', label: 'Reaction time', unit: 'ms', bad: 1 },
  mood: { id: 'mood', hazard: 'I', label: 'Mood', unit: '1-5', bad: -1 },
  co2: { id: 'co2', hazard: 'E', label: 'Cabin CO₂', unit: 'mmHg', bad: 1 },
  temp: { id: 'temp', hazard: 'E', label: 'Cabin temperature', unit: '°C', bad: 0 },
  noise: { id: 'noise', hazard: 'E', label: 'Cabin noise', unit: 'dBA', bad: 1 },
  dose: { id: 'dose', hazard: 'R', label: 'Dose rate', unit: 'µSv/h', bad: 1 },
}

export interface CrewMember {
  id: string
  name: string
  role: string
}

export interface Reading {
  id?: number
  crewId: string
  metric: MetricId
  value: number
  ts: Timestamp
  source: Source
}

/** Running Welford statistics over a window; sd = sqrt(m2 / (n - 1)). */
export interface Baseline {
  crewId: string
  metric: MetricId
  n: number
  mean: number
  m2: number
  /** EWMA-smoothed z-score carried between readings. */
  ewma: number
  /** Last classified status (kept for hysteresis). */
  status: Status
  updatedAt: Timestamp
}

export type AlertState = 'open' | 'acknowledged' | 'resolved'

export interface Alert {
  id?: number
  crewId: string
  hazard: Hazard
  metric: MetricId
  status: Exclude<Status, 'nominal'>
  state: AlertState
  z: number
  value: number
  baselineMean: number
  explanation: string
  /** Action-card steps; `done` is ticked by the crew. */
  steps: { text: string; done: boolean }[]
  openedAt: Timestamp
  resolvedAt?: Timestamp
}

export type LogKind = 'alert-opened' | 'step-done' | 'alert-resolved' | 'checkin' | 'note'
export type SyncState = 'pending' | 'synced'

export interface ActionLogEntry {
  id?: number
  crewId: string
  kind: LogKind
  text: string
  alertId?: number
  ts: Timestamp
  sync: SyncState
  syncedAt?: Timestamp
}

export interface CheckIn {
  id?: number
  crewId: string
  ts: Timestamp
  /** 1 (low) to 5 (high). */
  mood: number
  sleepQuality: number
  symptoms: string[]
  reactionMs?: number
}
