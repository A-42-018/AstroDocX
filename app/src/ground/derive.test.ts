import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { ConsoleDB } from '../data/db'
import { seedDemo } from '../data/demo'
import type { ActionLogEntry } from '../data/types'
import { deriveGround, levelOf, receivedAt } from './derive'

const crew = [{ id: 'pilot', name: 'Pilot', role: 'Pilot' }, { id: 'cmdr', name: 'Commander', role: 'Commander' }]
let id = 0
const e = (o: Partial<ActionLogEntry>): ActionLogEntry => ({ id: ++id, crewId: 'pilot', kind: 'note', text: '', ts: 1000, sync: 'synced', syncedAt: 2000, ...o })

describe('levelOf', () => {
  it('reads the level from the log text', () => {
    expect(levelOf('ACT: Sleep low.')).toBe('act')
    expect(levelOf('WATCH: Sleep low.')).toBe('watch')
    expect(levelOf('Escalated to ACT: x')).toBe('act')
    expect(levelOf('Eased to WATCH: x')).toBe('watch')
    expect(levelOf('Step done: rest')).toBeNull()
  })
})

describe('deriveGround', () => {
  it('rebuilds an open alert, its step count, and then its resolution from synced entries', () => {
    const open = [
      e({ kind: 'alert-opened', alertId: 1, text: 'WATCH: Sleep 5 h.', ts: 10 }),
      e({ kind: 'alert-opened', alertId: 1, text: 'Escalated to ACT: Sleep 4 h.', ts: 20 }),
      e({ kind: 'step-done', alertId: 1, text: 'Step done: nap', ts: 30 }),
    ]
    let [p] = deriveGround(crew, open)
    expect(p.open).toHaveLength(1)
    expect(p.open[0]).toMatchObject({ level: 'act', openedAt: 10, stepsDone: 1, lastUpdate: 30 })
    ;[p] = deriveGround(crew, [...open, e({ kind: 'alert-resolved', alertId: 1, text: 'back', ts: 40 })])
    expect(p.open).toHaveLength(0)
    expect(p.resolved[0].resolvedAt).toBe(40)
  })

  it('ignores pending entries except to count them, so an unsynced alert is invisible to Earth', () => {
    const log = [
      e({ kind: 'alert-opened', alertId: 2, text: 'ACT: CO2 high.', sync: 'pending', syncedAt: undefined }),
      e({ kind: 'checkin', text: 'Daily check-in', crewId: 'cmdr', sync: 'pending', syncedAt: undefined }),
    ]
    const [p, c] = deriveGround(crew, log)
    expect(p.open).toHaveLength(0)
    expect(p.awaiting).toBe(1)
    expect(c.lastCheckIn).toBeUndefined()
    expect(c.awaiting).toBe(1)
  })

  it('orders Act before Watch and tracks the last check-in', () => {
    const [p] = deriveGround(crew, [
      e({ kind: 'alert-opened', alertId: 3, text: 'WATCH: a', ts: 5 }),
      e({ kind: 'alert-opened', alertId: 4, text: 'ACT: b', ts: 4 }),
      e({ kind: 'checkin', text: 'c1', ts: 6 }), e({ kind: 'checkin', text: 'c2', ts: 9 }),
    ])
    expect(p.open.map((a) => a.level)).toEqual(['act', 'watch'])
    expect(p.lastCheckIn!.text).toBe('c2')
  })

  it('adds the one-way delay to the sync time', () => {
    expect(receivedAt(e({ syncedAt: 0 }))).toBe(12 * 60_000)
  })
})

it('demo mission: Earth knows the pilot\'s insomnia alert but is behind the board', async () => {
  const d = new ConsoleDB('ground-demo')
  await seedDemo(undefined, d)
  const g = deriveGround(await d.crew.toArray(), await d.actionLog.toArray())
  const by = (id: string) => g.find((x) => x.crew.id === id)!
  const [cmdr, pilot, eng] = [by('cmdr'), by('pilot'), by('eng')]
  expect(pilot.open.some((a) => /Sleep/i.test(a.text))).toBe(true)
  expect(eng.open.length).toBeGreaterThan(0)
  expect(cmdr.open).toHaveLength(0)
  expect([cmdr, pilot, eng].some((g) => g.awaiting > 0)).toBe(true)
}, 120_000)
