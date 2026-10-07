import 'fake-indexeddb/auto'
import { expect, it } from 'vitest'
import { ConsoleDB } from '../data/db'
import { seedDemo } from '../data/demo'
import { loadSnapshot } from '../board/snapshot'
import { met } from './actions'

it('an ongoing alert keeps saying when it started, and the demo ground link is shared and recent', async () => {
  const d = new ConsoleDB('since-test')
  await seedDemo(undefined, d)
  const open = (await d.alerts.toArray()).filter((a) => a.state !== 'resolved' && a.kind !== 'limit')
  expect(open.length).toBeGreaterThan(0)
  for (const a of open) expect(a.explanation).toContain(`Started at ${met(a.openedAt)}`)

  // Ground link is mission-wide: every crew member sees the same last-sync and queue.
  const snaps = await Promise.all(['cmdr', 'pilot', 'eng', 'med'].map((id) => loadSnapshot(id, d)))
  expect(new Set(snaps.map((s) => s!.sinceSyncH)).size).toBe(1)
  expect(new Set(snaps.map((s) => s!.pendingSync)).size).toBe(1)
  expect(snaps[0]!.pendingSync).toBeGreaterThan(0)
  expect(snaps[0]!.sinceSyncH!).toBeLessThan(12)
  expect(snaps[0]!.tiles.find((t) => t.hazard === 'D')!.status).toBe('nominal')
}, 120_000)
