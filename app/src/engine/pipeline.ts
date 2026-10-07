import { ConsoleDB, db } from '../data/db'
import { METRICS, type ActionLogEntry, type Alert, type AlertKind, type Baseline, type Hazard, type MetricId, type Reading, type Status, type Timestamp } from '../data/types'
import { alertTitle, explainBaseline, explainCombined, met, stepsFor, type AlertLevel } from './actions'
import { newBaseline, persistFor, step } from './baseline'
import { CAREER_DOSE_MSV, CO2_LIMIT_MMHG, co2Limit, eventDoseLimit, type LimitResult } from './limits'

const RANK: Record<Status, number> = { nominal: 0, watch: 1, act: 2 }
const worse = (a: Status, b: Status): Status => (RANK[a] >= RANK[b] ? a : b)
const COMBINED = 'sleep+reaction'

export interface ProcessResult {
  /** Final status for this metric after absolute limits and Act persistence. */
  status: Status
  alert?: Alert
  change?: 'opened' | 'escalated' | 'eased' | 'resolved'
}

async function latest(d: ConsoleDB, crewId: string, metric: MetricId): Promise<Reading | undefined> {
  return d.readings.where('[crewId+metric+ts]').between([crewId, metric, -Infinity], [crewId, metric, Infinity]).last()
}

/** Cumulative mission dose in mSv (hourly µSv/h readings x 1 h), kept as a running total on the dose baseline. Compare with the 600 mSv career budget. */
export async function cumulativeDoseMsv(crewId: string, d: ConsoleDB = db): Promise<number> {
  return ((await d.baselines.get([crewId, 'dose']))?.total ?? 0) / 1000
}

async function doseLast24hMsv(d: ConsoleDB, crewId: string, ts: Timestamp): Promise<number> {
  const rows = await d.readings.where('[crewId+metric+ts]').between([crewId, 'dose', ts - 24 * 3_600_000 + 1], [crewId, 'dose', ts], true, true).toArray()
  return rows.reduce((a, r) => a + r.value, 0) / 1000
}

/** When the open alert for (crew, ruleId) started, or `ts` if there is none yet: explanations say "Started at" this time. */
async function alertSince(d: ConsoleDB, crewId: string, ruleId: string, ts: Timestamp): Promise<Timestamp> {
  const open = await d.alerts.where('[crewId+state]').anyOf([crewId, 'open'], [crewId, 'acknowledged']).filter((a) => a.ruleId === ruleId).first()
  return open?.openedAt ?? ts
}

async function log(d: ConsoleDB, e: Omit<ActionLogEntry, 'sync'>) {
  await d.actionLog.add({ ...e, sync: 'pending' })
}

export interface Desired {
  status: Status
  kind: AlertKind
  metric: MetricId
  /** Defaults to the metric's hazard. */
  hazard?: Hazard
  z: number
  value: number
  baselineMean: number
  explanation: string
}

/** Create, update, escalate, ease or resolve the single alert for (crew, ruleId). */
export async function applyRule(d: ConsoleDB, crewId: string, ruleId: string, want: Desired, ts: Timestamp): Promise<ProcessResult> {
  const existing = await d.alerts.where('[crewId+state]').anyOf([crewId, 'open'], [crewId, 'acknowledged']).filter((a) => a.ruleId === ruleId).first()
  if (want.status === 'nominal') {
    if (!existing) return { status: 'nominal' }
    const resolved: Alert = { ...existing, state: 'resolved', resolvedAt: ts }
    await d.alerts.put(resolved)
    await log(d, { crewId, kind: 'alert-resolved', alertId: existing.id, ts, text: `${alertTitle(existing)} ${existing.kind === 'checkin' ? 'cleared on the latest check-in' : 'back within range'} (${met(ts)}).` })
    return { status: 'nominal', alert: resolved, change: 'resolved' }
  }
  const level = want.status as AlertLevel
  const base = { hazard: want.hazard ?? METRICS[want.metric].hazard, status: level, z: want.z, value: want.value, baselineMean: want.baselineMean, explanation: want.explanation }
  if (!existing) {
    const alert: Alert = { crewId, ruleId, kind: want.kind, metric: want.metric, ...base, peakStatus: level, state: 'open', steps: stepsFor(ruleId, level), openedAt: ts }
    alert.id = (await d.alerts.add(alert)) as number
    await log(d, { crewId, kind: 'alert-opened', alertId: alert.id, ts, text: `${level.toUpperCase()}: ${want.explanation}` })
    return { status: want.status, alert, change: 'opened' }
  }
  if (existing.status === level) {
    const alert: Alert = { ...existing, ...base, kind: want.kind }
    await d.alerts.put(alert)
    return { status: want.status, alert }
  }
  const up = RANK[level] > RANK[existing.status]
  const alert: Alert = up
    ? { ...existing, ...base, kind: want.kind, peakStatus: level, state: 'open', steps: stepsFor(ruleId, level) }
    : { ...existing, ...base, kind: want.kind }
  await d.alerts.put(alert)
  await log(d, { crewId, kind: up ? 'alert-opened' : 'note', alertId: existing.id, ts, text: `${up ? 'Escalated' : 'Eased'} to ${level.toUpperCase()}: ${want.explanation}` })
  return { status: want.status, alert, change: up ? 'escalated' : 'eased' }
}

/**
 * Score one reading, persist it, and update alerts: statistical status (Act needs 2 consecutive),
 * absolute limits (CO2, event dose), and the sleep + reaction two-signal rule.
 */
export async function processReading(r: Reading, d: ConsoleDB = db): Promise<ProcessResult> {
  return d.transaction('rw', d.crew, d.readings, d.baselines, d.alerts, d.actionLog, async () => {
    const who = (await d.crew.get(r.crewId))?.name ?? 'this crew member'
    const prior: Baseline = (await d.baselines.get([r.crewId, r.metric])) ?? newBaseline(r.crewId, r.metric, r.ts)
    const res = step(prior, r.value, r.ts)

    // Persistence: a statistical Watch needs N consecutive readings, and Act needs N consecutive Act readings (N = 3 hourly, 2 daily).
    const warnRun = res.status === 'nominal' ? 0 : prior.warnRun + 1
    const actRun = res.status === 'act' ? prior.actRun + 1 : 0
    const need = persistFor(r.metric)
    const stat: Status = warnRun < need ? 'nominal' : res.status === 'act' && actRun < need ? 'watch' : res.status

    let limit: LimitResult = { status: 'nominal', reason: '' }
    let limitRun = 0
    if (r.metric === 'co2') {
      limitRun = r.value >= CO2_LIMIT_MMHG ? prior.limitRun + 1 : 0
      limit = co2Limit(r.value, limitRun)
    } else if (r.metric === 'dose') {
      limit = eventDoseLimit((await doseLast24hMsv(d, r.crewId, r.ts)) + r.value / 1000)
    }

    await d.readings.add(r)
    await d.baselines.put({ ...res.baseline, warnRun, actRun, limitRun, total: prior.total + r.value })

    const status = worse(stat, limit.status)
    let explanation = res.scored ? explainBaseline(res.baseline, r.value, res.z, await alertSince(d, r.crewId, r.metric, r.ts), who) : ''
    if (limit.status !== 'nominal' && RANK[limit.status] >= RANK[stat]) explanation = limit.reason
    if (r.metric === 'dose' && status !== 'nominal') {
      explanation += ` Cumulative mission dose: ${(((prior.total + r.value) / 1000)).toFixed(2)} mSv of the ${CAREER_DOSE_MSV} mSv career limit (NASA-STD-3001 Vol. 1).`
    }
    const out = await applyRule(d, r.crewId, r.metric, { status, kind: limit.status !== 'nominal' && RANK[limit.status] >= RANK[stat] ? 'limit' : 'baseline', metric: r.metric, z: res.z, value: r.value, baselineMean: res.baseline.mean, explanation }, r.ts)

    if (r.metric === 'sleep' || r.metric === 'reaction') await combined(d, r, who)
    return out
  })
}

/** Poor sleep and slow reaction at the same time raise a behavioral Watch. */
async function combined(d: ConsoleDB, r: Reading, who: string) {
  const [sb, rb] = await Promise.all([d.baselines.get([r.crewId, 'sleep']), d.baselines.get([r.crewId, 'reaction'])])
  const both = !!sb && !!rb && sb.status !== 'nominal' && rb.status !== 'nominal'
  if (!both) return applyRule(d, r.crewId, COMBINED, { status: 'nominal', kind: 'combined', metric: 'reaction', z: 0, value: 0, baselineMean: 0, explanation: '' }, r.ts)
  const [sl, re] = await Promise.all([latest(d, r.crewId, 'sleep'), latest(d, r.crewId, 'reaction')])
  const text = explainCombined(who, { value: sl?.value ?? sb.mean, z: sb.ewma }, { value: re?.value ?? rb.mean, z: rb.ewma }, await alertSince(d, r.crewId, COMBINED, r.ts))
  return applyRule(d, r.crewId, COMBINED, { status: 'watch', kind: 'combined', metric: 'reaction', z: Math.max(sb.ewma, rb.ewma), value: re?.value ?? 0, baselineMean: rb.mean, explanation: text }, r.ts)
}

/** Crew presses Done on an action card: records completion; the engine still resolves the alert when values recover. */
export async function completeActionCard(alertId: number, ts: Timestamp, d: ConsoleDB = db) {
  await d.transaction('rw', d.alerts, d.actionLog, async () => {
    const a = await d.alerts.get(alertId)
    if (!a || a.state === 'resolved') return
    await d.alerts.put({ ...a, state: 'acknowledged', steps: a.steps.map((s) => ({ ...s, done: true })) })
    await log(d, { crewId: a.crewId, kind: 'step-done', alertId, ts, text: `Action card completed: ${a.steps.map((s) => s.text).join('; ')}.` })
  })
}

/** Tick a single step. */
export async function setStepDone(alertId: number, index: number, done: boolean, ts: Timestamp, d: ConsoleDB = db) {
  await d.transaction('rw', d.alerts, d.actionLog, async () => {
    const a = await d.alerts.get(alertId)
    if (!a || a.state === 'resolved' || !a.steps[index]) return
    const steps = a.steps.map((s, i) => (i === index ? { ...s, done } : s))
    await d.alerts.put({ ...a, steps })
    if (done) await log(d, { crewId: a.crewId, kind: 'step-done', alertId, ts, text: `Step done: ${a.steps[index].text}` })
  })
}

/**
 * Load a batch of readings through the pipeline in time order. The whole batch runs in one
 * IndexedDB transaction (nested `processReading` transactions join it), which is far faster than
 * one transaction per reading.
 */
export async function processAll(readings: Reading[], d: ConsoleDB = db, onProgress?: (done: number, total: number) => void) {
  const sorted = [...readings].sort((a, b) => a.ts - b.ts)
  await d.transaction('rw', d.crew, d.readings, d.baselines, d.alerts, d.actionLog, async () => {
    for (let i = 0; i < sorted.length; i++) {
      await processReading(sorted[i], d)
      if (onProgress && i % 500 === 499) onProgress(i + 1, sorted.length)
    }
  })
  onProgress?.(sorted.length, sorted.length)
}
