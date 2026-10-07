import { create } from 'zustand'

interface SyncState {
  /** Simulated communications blackout (e.g. solar storm, antenna fault). */
  blackout: boolean
  setBlackout: (b: boolean) => void
  /** Upload automatically in each window while the simulator moves time forward. */
  auto: boolean
  setAuto: (b: boolean) => void
}

export const useSync = create<SyncState>((set) => ({
  blackout: false,
  setBlackout: (blackout) => set({ blackout }),
  auto: true,
  setAuto: (auto) => set({ auto }),
}))
