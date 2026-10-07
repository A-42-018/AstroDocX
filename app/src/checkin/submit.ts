import { ConsoleDB, db } from '../data/db'
import type { Alert, CheckIn, MetricId, Reading, Timestamp } from '../data/types'
import { processCheckInRules } from '../engine/checkinRules'
import { processReading, type ProcessResult } from '../engine/pipeline'

export const SYMPTOMS = ['Headache', 'Nausea', 'Dizziness', 'Congestion', 'Back pain', 'Blurred vision', 'Skin rash', 'Fatigue'] as const

export interface CheckInInput {
  crewId: string
  ts: Timestamp
  /** 1 (low) to 5 (high). */
  mood: number
  sleepQuality: number
  /** Self-reported hours slept; blank keeps the wearable's value. */
  sleepHours?: number
  symptoms: string[]
  /** Median reaction time from the tap test, if it was taken. */
  reactionMs?: number
}

export interface CheckInResult {
  checkIn: CheckIn
  /** Alerts the engine opened or escalated because of this check-in. */
  raised: Alert[]
  resolved: Alert[]
}

export function validate(i: CheckInInput): string | null {
  const scale = (n: number) => Number.isInteger(n) && n >= 1 && n <= 5
  if (!scale(i.mood)) return 'Pick a mood from 1 to 5.'
  if (!scale(i.sleepQuality)) return 'Pick a sleep quality from 1 to 5.'
  if (i.sleepHours !== undefined && !(i.sleepHours >= 0 && i.sleepHours <= 16)) return 'Sleep hours must be between 0 and 16.'
  return null
}

/**
 * Save a check-in: the form itself, the readings it contains (mood, optional sleep hours, optional
 * reaction time) through the engine, and one pending entry in the on-board log.
 */
export async function submitCheckIn(input: CheckInInput, d: ConsoleDB = db): Promise<CheckInResult> {
  const err = validate(input)
  if (err) throw new Error(err)
  const readings: Reading[] = []
  const add = (metric: MetricId, value: number) => readings.push({ crewId: input.crewId, metric, value, ts: input.ts, source: 'checkin' })
  add('mood', input.mood)
  if (input.sleepHours !== undefined) add('sleep', input.sleepHours)
  if (input.reactionMs !== undefined) add('reaction', input.reactionMs)

  const checkIn: CheckIn = {
    crewId: input.crewId, ts: input.ts, mood: input.mood, sleepQuality: input.sleepQuality,
    symptoms: input.symptoms, ...(input.reactionMs !== undefined && { reactionMs: input.reactionMs }),
  }
  return d.transaction('rw', [d.crew, d.readings, d.baselines, d.alerts, d.actionLog, d.checkIns], async () => {
    checkIn.id = (await d.checkIns.add(checkIn)) as number
    const results: ProcessResult[] = []
    for (const r of readings) results.push(await processReading(r, d))
    results.push(...(await processCheckInRules(input.crewId, input.ts, d)))
    const parts = [
      `mood ${input.mood}/5`, `sleep quality ${input.sleepQuality}/5`,
      ...(input.sleepHours !== undefined ? [`${input.sleepHours} h slept`] : []),
      ...(input.reactionMs !== undefined ? [`reaction ${input.reactionMs} ms`] : []),
      input.symptoms.length ? `symptoms: ${input.symptoms.join(', ').toLowerCase()}` : 'no symptoms reported',
    ]
    await d.actionLog.add({ crewId: input.crewId, kind: 'checkin', ts: input.ts, text: `Daily check-in: ${parts.join('; ')}.`, sync: 'pending' })
    return {
      checkIn,
      raised: results.filter((r) => r.alert && (r.change === 'opened' || r.change === 'escalated')).map((r) => r.alert!),
      resolved: results.filter((r) => r.change === 'resolved').map((r) => r.alert!),
    }
  })
}
