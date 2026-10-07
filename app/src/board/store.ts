import { create } from 'zustand'

interface BoardState {
  crewId: string | undefined
  selectCrew: (id: string) => void
  boot: { state: 'idle' | 'seeding' | 'ready' | 'error'; done: number; total: number; error?: string }
  setBoot: (b: BoardState['boot']) => void
}

export const useBoard = create<BoardState>((set) => ({
  crewId: undefined,
  selectCrew: (crewId) => set({ crewId }),
  boot: { state: 'idle', done: 0, total: 0 },
  setBoot: (boot) => set({ boot }),
}))
