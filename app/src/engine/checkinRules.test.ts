import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { ConsoleDB } from '../data/db'
import { CREW, DAY, MISSION_START } from '../data/synthetic'
import type { CheckIn } from '../data/types'
import { submitCheckIn } from '../checkin/submit'
import { alertTitle, stepsFor } from './actions'
import { sleepQualityRule, symptomRule } from './checkinRules'

const ci = (day: number, symptoms: string[], sleepQuality = 4): CheckIn => ({ crewId: 'pilot', ts: MISSION_START + day * DAY, mood: 4, sleepQuality, symptoms })
/** Newest first, as the rules expect. */
const hist = (...list: CheckIn[]) => [...list].reverse()

describe('symptomRule', () => {
  it('is quiet with no history or a one-off symptom', () => {
    expect(symptomRule([], 'Pilot').status).toBe('nominal')
    expect(symptomRule(hist(ci(1, []), ci(2, ['Headache'])), 'Pilot').status).toBe('nominal')
  })
  it('Watch when the same symptom is reported on three check-ins in a row, with its hazard', () => {
    const r = symptomRule(hist(ci(1, ['Headache']), ci(2, ['Headache', 'Nausea']), ci(3, ['Headache'])), 'Pilot')
    expect(r).toMatchObject({ status: 'watch', hazard: 'E' })
    expect(r.explanation).toContain('headache on 3 check-ins in a row (D1 00:00 MET to D3 00:00 MET)')
  })
  it('a gap breaks the streak', () => {
    expect(symptomRule(hist(ci(1, ['Headache']), ci(2, []), ci(3, ['Headache'])), 'Pilot').status).toBe('nominal')
  })
  it('Watch for three or more symptoms at once', () => {
    const r = symptomRule(hist(ci(1, ['Nausea', 'Dizziness', 'Fatigue'])), 'Pilot')
    expect(r).toMatchObject({ status: 'watch', hazard: 'G' })
    expect(r.explanation).toContain('3 symptoms')
  })
  it('Act for blurred vision on two check-ins in a row (SANS red flag)', () => {
    const r = symptomRule(hist(ci(1, ['Blurred vision']), ci(2, ['Blurred vision'])), 'Pilot')
    expect(r).toMatchObject({ status: 'act', hazard: 'G' })
    expect(r.explanation).toMatch(/SANS/)
  })
})

describe('sleepQualityRule', () => {
  it('Watch after three poor ratings in a row, quiet otherwise', () => {
    expect(sleepQualityRule(hist(ci(1, [], 2), ci(2, [], 1), ci(3, [], 2)), 'Pilot')).toMatchObject({ status: 'watch', hazard: 'I' })
    expect(sleepQualityRule(hist(ci(1, [], 2), ci(2, [], 3), ci(3, [], 2)), 'Pilot').status).toBe('nominal')
    expect(sleepQualityRule(hist(ci(1, [], 1), ci(2, [], 1)), 'Pilot').status).toBe('nominal')
  })
})

it('titles and steps come from the rule id', () => {
  expect(alertTitle({ ruleId: 'symptoms', metric: 'mood' })).toBe('Reported symptoms')
  expect(alertTitle({ ruleId: 'sleep-quality', metric: 'sleep' })).toBe('Self-reported sleep quality')
  expect(alertTitle({ ruleId: 'hr', metric: 'hr' })).toBe('Heart rate')
  expect(stepsFor('symptoms', 'act')[0].text).toMatch(/vision check/)
  expect(stepsFor('sleep-quality', 'watch')).toEqual(stepsFor('sleep', 'watch'))
})

it('check-ins drive the alert lifecycle: open, escalate to Act, resolve', async () => {
  const d = new ConsoleDB('checkin-rules')
  await d.crew.bulkAdd(CREW)
  const send = (day: number, symptoms: string[], sleepQuality = 4) =>
    submitCheckIn({ crewId: 'pilot', ts: MISSION_START + day * DAY, mood: 4, sleepQuality, symptoms }, d)

  await send(1, ['Blurred vision', 'Headache'])
  await send(2, ['Headache'])
  const third = await send(3, ['Headache', 'Blurred vision'], 2)
  expect(third.raised.map((a) => [a.ruleId, a.status, a.hazard])).toEqual([['symptoms', 'watch', 'E']])

  const fourth = await send(4, ['Blurred vision'], 2)
  expect(fourth.raised.map((a) => [a.ruleId, a.status])).toEqual([['symptoms', 'act']])
  const act = (await d.alerts.toArray()).find((a) => a.ruleId === 'symptoms')!
  expect(act.steps[0].text).toMatch(/vision check/)

  const fifth = await send(5, [], 1)
  expect(fifth.resolved.map((a) => a.ruleId)).toEqual(['symptoms'])
  expect(fifth.raised.map((a) => a.ruleId)).toEqual(['sleep-quality'])
  const log = (await d.actionLog.toArray()).map((e) => e.text)
  expect(log).toContain('Reported symptoms cleared on the latest check-in (D5 00:00 MET).')
  expect(log.some((t) => t.startsWith('Escalated to ACT: Pilot reported blurred vision'))).toBe(true)
})
