import 'fake-indexeddb/auto'
import { beforeAll, describe, expect, it } from 'vitest'
import { ConsoleDB } from '../data/db'
import { CREW, DAY, MISSION_START, generateReadings } from '../data/synthetic'
import { processAll } from '../engine/pipeline'
import { submitCheckIn, validate } from './submit'

const d = new ConsoleDB('checkin-test')
const NOW = MISSION_START + 20 * DAY + 7 * 3_600_000
const base = { crewId: 'cmdr', mood: 4, sleepQuality: 4, symptoms: [] as string[] }

beforeAll(async () => {
  await d.crew.bulkAdd(CREW)
  await processAll(generateReadings({ seed: 7, days: 20, crew: CREW.slice(0, 1) }), d)
}, 60_000)

describe('submitCheckIn', () => {
  it('stores the form, feeds mood/sleep/reaction readings to the engine and writes a pending log entry', async () => {
    const readings0 = await d.readings.count()
    const res = await submitCheckIn({ ...base, ts: NOW, sleepHours: 7, reactionMs: 310, symptoms: ['Headache'] }, d)
    expect(res.checkIn.id).toBeGreaterThan(0)
    expect(await d.readings.count()).toBe(readings0 + 3)
    const mine = (await d.readings.where('ts').equals(NOW).toArray()).filter((r) => r.source === 'checkin')
    expect(mine.map((r) => r.metric).sort()).toEqual(['mood', 'reaction', 'sleep'])
    const entry = (await d.actionLog.toArray()).find((e) => e.kind === 'checkin')!
    expect(entry.sync).toBe('pending')
    expect(entry.text).toContain('headache')
    expect(entry.text).toContain('reaction 310 ms')
    expect(res.raised).toHaveLength(0)
  })

  it('leaves sleep and reaction out when they were not taken', async () => {
    const before = await d.readings.count()
    await submitCheckIn({ ...base, ts: NOW + 1000 }, d)
    expect(await d.readings.count()).toBe(before + 1)
  })

  it('raises an alert when repeated check-ins show a much slower reaction time', async () => {
    let raised = 0
    for (let i = 1; i <= 3; i++) raised += (await submitCheckIn({ ...base, ts: NOW + i * DAY, reactionMs: 900 }, d)).raised.length
    expect(raised).toBeGreaterThan(0)
    expect((await d.alerts.toArray()).some((a) => a.metric === 'reaction' && a.state !== 'resolved')).toBe(true)
  })

  it('rejects invalid input and writes nothing', async () => {
    const before = await d.checkIns.count()
    await expect(submitCheckIn({ ...base, ts: NOW, mood: 9 }, d)).rejects.toThrow(/mood/i)
    await expect(submitCheckIn({ ...base, ts: NOW, sleepHours: 30 }, d)).rejects.toThrow(/sleep hours/i)
    expect(await d.checkIns.count()).toBe(before)
    expect(validate({ ...base, ts: NOW })).toBeNull()
  })
})
