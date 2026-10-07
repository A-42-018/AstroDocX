import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { ConsoleDB, addReading, openAlerts, pendingSync, readingsFor, resetDb } from './db'
import type { Alert } from './types'

const d = new ConsoleDB('test-db')
const alert = (over: Partial<Alert> = {}): Alert => ({
  crewId: 'c1', hazard: 'E', metric: 'co2', status: 'watch', state: 'open', z: 2, value: 3,
  baselineMean: 2.4, explanation: 'x', steps: [{ text: 's', done: false }], openedAt: 1, ...over,
})

beforeEach(() => resetDb(d))

describe('ConsoleDB', () => {
  it('opens with all six stores', async () => {
    await d.open()
    expect(d.tables.map((t) => t.name).sort()).toEqual(['actionLog', 'alerts', 'baselines', 'checkIns', 'crew', 'readings'])
  })

  it('round-trips typed readings and queries by crew, metric and time range', async () => {
    for (const ts of [1, 5, 10]) await addReading({ crewId: 'c1', metric: 'hr', value: 60 + ts, ts, source: 'wearable' }, d)
    await addReading({ crewId: 'c2', metric: 'hr', value: 99, ts: 5, source: 'wearable' }, d)
    await addReading({ crewId: 'c1', metric: 'co2', value: 2.4, ts: 5, source: 'cabin' }, d)
    const rows = await readingsFor('c1', 'hr', 2, 10, d)
    expect(rows.map((r) => r.value)).toEqual([65, 70])
  })

  it('stores baselines keyed by crew + metric (upsert)', async () => {
    const b = { crewId: 'c1', metric: 'hr' as const, n: 1, mean: 60, m2: 0, ewma: 0, status: 'nominal' as const, updatedAt: 1 }
    await d.baselines.put(b)
    await d.baselines.put({ ...b, n: 2, mean: 61 })
    expect(await d.baselines.count()).toBe(1)
    expect((await d.baselines.get(['c1', 'hr']))?.n).toBe(2)
  })

  it('lists only open/acknowledged alerts for a crew member', async () => {
    await d.alerts.bulkAdd([alert(), alert({ state: 'acknowledged' }), alert({ state: 'resolved' }), alert({ crewId: 'c2' })])
    expect(await openAlerts('c1', d)).toHaveLength(2)
  })

  it('finds pending log entries and checkIns persist', async () => {
    await d.actionLog.bulkAdd([
      { crewId: 'c1', kind: 'alert-opened', text: 'a', ts: 1, sync: 'pending' },
      { crewId: 'c1', kind: 'note', text: 'b', ts: 2, sync: 'synced', syncedAt: 3 },
    ])
    await d.checkIns.add({ crewId: 'c1', ts: 1, mood: 4, sleepQuality: 3, symptoms: ['headache'], reactionMs: 312 })
    expect(await pendingSync(d)).toHaveLength(1)
    expect((await d.checkIns.toArray())[0].symptoms).toEqual(['headache'])
  })
})
