import { create } from 'zustand'

interface BoardState {
  crewId: string | undefined
  selectCrew: (id: string) => void
  boot: { state: 'idle' | 'seeding' | 'ready' | 'error'; done: number; total: number; error?: string }
  setBoot: (b: BoardState['boot']) => void
}

const KEY = 'astrodocx.crew'
/** The selected crew member survives a reload; storage can be unavailable (private mode), so failures are ignored. */
const saved = (): string | undefined => {
  try { return localStorage.getItem(KEY) ?? undefined } catch { return undefined }
}

export const useBoard = create<BoardState>((set) => ({
  crewId: saved(),
  selectCrew: (crewId) => {
    try { localStorage.setItem(KEY, crewId) } catch { /* not persisted */ }
    set({ crewId })
  },
  boot: { state: 'idle', done: 0, total: 0 },
  setBoot: (boot) => set({ boot }),
}))
