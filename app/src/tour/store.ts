import { create } from 'zustand'

/** The 1-click tour's three chapters; the landing page plays the first (landing/tour.js), the console the other two. */
export const CHAPTERS = ['Landing', 'Console', '3D Cabin'] as const

interface TourState {
  /** 'off' when no tour runs, 'end' once the last stop has played (the end card shows). */
  phase: 'off' | 'running' | 'end'
  chapter: number
  caption: string
  /** 0–1 over the whole tour, landing included. */
  progress: number
  paused: boolean
  /** The cabin tells the tour when its camera can be steered (loaded, arrival over), and whether it can draw at all. */
  cabin: { goTo: (i: number) => void } | null
  cabinFailed: boolean
  set: (p: Partial<Omit<TourState, 'set'>>) => void
}

export const useTour = create<TourState>((set) => ({
  phase: 'off', chapter: 1, caption: '', progress: 1 / 3, paused: false, cabin: null, cabinFailed: false,
  set: (p) => set(p),
}))
