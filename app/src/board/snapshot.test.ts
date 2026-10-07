import 'fake-indexeddb/auto'
import { beforeAll, describe, expect, it } from 'vitest'
import { ConsoleDB } from '../data/db'
import { seedDemo } from '../data/demo'
import { DAY, MISSION_START } from '../data/synthetic'
import { hazardScore, linkStatus, loadSnapshot, readinessOf, type Snapshot } from './snapshot'

describe('scoring', () => {
  it('caps the hazard score by status and scales the z penalty', () => {
    expect(hazardScore('nominal', 0)).toBe(100)
    expect(hazardScore('nominal', 1.5)).toBe(80)
    expect(hazardScore('nominal', 3)).toBe(60)
    expect(hazardScore('watch', 0)).toBe(80)
    expect(hazardScore('act', 0)).toBe(55)
    expect(hazardScore('act', 6)).toBe(55) // z beyond 3σ adds no more penalty than the cap
  })
  it('derives the link status from the age of the oldest unsynced entry', () => {
    expect(linkStatus(null)).toBe('nominal')
    expect(linkStatus(23.9)).toBe('nominal')
    expect(linkStatus(24)).toBe('watch')
    expect(linkStatus(72)).toBe('act')
  })
  it('averages tile scores into readiness', () => {
    expect(readinessOf([{ score: 100 }, { score: 80 }, { score: 60 }] as never)).toBe(80)
  })
})

describe('snapshot of the demo mission', () => {
  const d = new ConsoleDB('board-test')
  const snaps: Record<string, Snapshot> = {}
  beforeAll(async () => {
    await seedDemo(undefined, d)
    for (const id of ['cmdr', 'pilot', 'eng', 'med']) snaps[id] = (await loadSnapshot(id, d))!
  }, 120_000)

  const tile = (id: string, h: string) => snaps[id].tiles.find((t) => t.hazard === h)!

  it('has five RIDGE tiles per crew member and a mission clock at the end of the history', () => {
    for (const s of Object.values(snaps)) expect(s.tiles.map((t) => t.hazard)).toEqual(['R', 'I', 'D', 'G', 'E'])
    expect(snaps.cmdr.now).toBe(MISSION_START + 29 * DAY + 23 * 3_600_000)
  })

  it('shows the pilot’s insomnia on Isolation with the explained alert', () => {
    const i = tile('pilot', 'I')
    expect(i.status).not.toBe('nominal')
    expect(i.alerts[0].explanation).toMatch(/baseline/)
    expect(Number(i.value)).toBeLessThan(5)
    expect(snaps.pilot.overall).not.toBe('nominal')
  })

  it('shows the flight engineer’s deconditioning on Gravity', () => {
    expect(tile('eng', 'G').status).toBe('act')
    expect(snaps.eng.alerts[0].peakStatus).toBe('act')
  })

  it('keeps unaffected crew nominal and ranks readiness below theirs for affected crew', () => {
    expect(snaps.cmdr.tiles.every((t) => t.status === 'nominal')).toBe(true)
    expect(snaps.cmdr.alerts).toHaveLength(0)
    expect(snaps.cmdr.readiness).toBeGreaterThan(snaps.pilot.readiness)
    expect(snaps.cmdr.readiness).toBeGreaterThan(snaps.eng.readiness)
    for (const s of Object.values(snaps)) expect(s.readiness).toBeGreaterThan(40)
  })

  it('reports the ground link: old history synced, recent entries pending', () => {
    const dist = tile('pilot', 'D')
    expect(snaps.pilot.sinceSyncH).not.toBeNull()
    expect(snaps.pilot.pendingSync + snaps.eng.pendingSync).toBeGreaterThan(0)
    for (const s of Object.values(snaps)) expect(s.tiles.find((t) => t.hazard === 'D')!.status).toBe('nominal')
    expect(dist.label).toContain('pending')
  })

  it('falls back to the first crew member for an unknown id', async () => {
    expect((await loadSnapshot('nobody', d))!.crewId).toBe('cmdr')
  })

  it('returns null for an empty database', async () => {
    expect(await loadSnapshot(undefined, new ConsoleDB('empty-board'))).toBeNull()
  })
})
