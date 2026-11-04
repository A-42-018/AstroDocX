import { create } from 'zustand'
import type { TourMode } from './script'

/** The 1-click tour's three chapters; the landing page plays the first (landing/tour.js), the console the other two. */
export const CHAPTERS = ['Landing', 'Console', '3D Cabin'] as const

interface TourState {
  /** 'gate' waits for the visitor's first click (browsers refuse speech before one), 'off' when no tour runs, 'end' once the last stop has played (the end card shows). */
  phase: 'off' | 'gate' | 'running' | 'end'
  /** quick: about two minutes. full: the whole project, five or six minutes. */
  mode: TourMode
  chapter: number
  caption: string
  /** 0–1 over the whole tour, landing included. */
  progress: number
  paused: boolean
  /** The cabin tells the tour when its camera can be steered (loaded, arrival over), and whether it can draw at all.
   *  `spoken(i)` is what VITA says at stop i (the live crew names are known there). */
  cabin: { goTo: (i: number) => void; spoken: (i: number) => string } | null
  cabinFailed: boolean
  /** What to point at: the `data-tour` name of the panel VITA is talking about (optional spotlight ring). */
  focus: string | null
  set: (p: Partial<Omit<TourState, 'set'>>) => void
}

export const useTour = create<TourState>((set) => ({
  phase: 'off', mode: 'quick', chapter: 1, caption: '', progress: 1 / 3, paused: false, cabin: null, cabinFailed: false, focus: null,
  set: (p) => set(p),
}))
