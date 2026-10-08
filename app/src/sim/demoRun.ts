import { create } from 'zustand'
import { db } from '../data/db'
import { seedDemo } from '../data/demo'
import { advance, makeInjection, missionNow } from './advance'
import { useSim } from './store'

export const DEMO_MAX_STEPS = 8
const STEP_MS = 2200

interface DemoState {
  phase: 'idle' | 'running' | 'done'
  step: number
  set: (p: Partial<Pick<DemoState, 'phase' | 'step'>>) => void
}
export const useDemo = create<DemoState>((set) => ({ phase: 'idle', step: 0, set: (p) => set(p) }))

let token = 0
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** Put the demo mission back as it was and stop any run in progress. */
export async function resetDemo() {
  const mine = ++token
  useSim.getState().clear()
  useDemo.getState().set({ phase: 'idle', step: 0 })
  await seedDemo()
  return mine === token
}

/**
 * Show the whole loop in about 20 s: reset, pick the first crew member, start a CO₂ scrubber fault and move
 * the mission clock an hour at a time until Environment reaches Act. The alert opens and Next Action follows
 * on its own, because the board listens to the database.
 */
export async function runDemo(select: (id: string) => void) {
  await resetDemo()
  const mine = token
  const id = (await db.crew.toArray())[0]?.id
  if (!id) return
  select(id)
  const { add, prune } = useSim.getState()
  const inj = makeInjection('co2', [id], await missionNow())
  add(inj)
  useDemo.getState().set({ phase: 'running', step: 0 })
  for (let i = 1; i <= DEMO_MAX_STEPS; i++) {
    await sleep(STEP_MS)
    if (mine !== token) return
    const res = await advance(1, [inj])
    prune(res.to)
    useDemo.getState().set({ step: i })
    const open = await db.alerts.where('[crewId+state]').anyOf([id, 'open'], [id, 'acknowledged']).toArray()
    if (open.some((a) => a.hazard === 'E' && a.status === 'act')) break
  }
  if (mine === token) useDemo.getState().set({ phase: 'done' })
}
