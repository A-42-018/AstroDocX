import { expect, it } from 'vitest'
import { MISSION_START, HOUR } from '../data/synthetic'
import type { ActionLogEntry } from '../data/types'
import { csvField, logToCsv } from './exportLog'

const crew = [{ id: 'pilot', name: 'Pilot', role: 'Pilot' }]

it('escapes CSV fields and neutralises spreadsheet formulas', () => {
  expect(csvField('plain')).toBe('plain')
  expect(csvField('a, b')).toBe('"a, b"')
  expect(csvField('say "hi"')).toBe('"say ""hi"""')
  expect(csvField('line\nbreak')).toBe('"line\nbreak"')
  expect(csvField('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`)
  expect(csvField(undefined)).toBe('')
  expect(csvField(7)).toBe('7')
})

it('writes the log oldest first with mission time, crew name and sync state', () => {
  const log: ActionLogEntry[] = [
    { id: 2, crewId: 'pilot', kind: 'step-done', text: 'Step done: nap', alertId: 1, ts: MISSION_START + 2 * HOUR, sync: 'pending' },
    { id: 1, crewId: 'pilot', kind: 'alert-opened', text: 'ACT: Sleep 4.7 h, low', alertId: 1, ts: MISSION_START + HOUR, sync: 'synced', syncedAt: MISSION_START + 3 * HOUR },
  ]
  const lines = logToCsv(log, crew).trimEnd().split('\r\n')
  expect(lines[0]).toBe('id,mission_time,timestamp_utc,crew,kind,alert_id,sync,synced_mission_time,text')
  expect(lines[1]).toBe('1,D0 01:00 MET,2030-01-01T01:00:00.000Z,Pilot,alert-opened,1,synced,D0 03:00 MET,"ACT: Sleep 4.7 h, low"')
  expect(lines[2]).toBe('2,D0 02:00 MET,2030-01-01T02:00:00.000Z,Pilot,step-done,1,pending,,Step done: nap')
})
