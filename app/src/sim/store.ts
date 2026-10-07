import { create } from 'zustand'
import type { Injection } from './advance'

interface SimState {
  injections: Injection[]
  add: (i: Injection) => void
  /** Drop injections that finished by `now`. */
  prune: (now: number) => void
  clear: () => void
}

/** Running injections live in memory only: reloading the page ends them (the readings already written stay). */
export const useSim = create<SimState>((set) => ({
  injections: [],
  add: (i) => set((s) => ({ injections: [...s.injections, i] })),
  prune: (now) => set((s) => ({ injections: s.injections.filter((i) => i.endTs > now) })),
  clear: () => set({ injections: [] }),
}))
