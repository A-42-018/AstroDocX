import { create } from 'zustand'

export type BackdropId = 'sunrise' | 'night' | 'earthrise' | 'deepfield' | 'still'

export const BACKDROPS: { id: BackdropId; name: string; hint: string }[] = [
  { id: 'sunrise', name: 'Orbital sunrise', hint: 'Sun rising over the limb' },
  { id: 'night', name: 'Night pass', hint: 'City lights and aurora' },
  { id: 'earthrise', name: 'Earthrise', hint: 'Earth over the lunar horizon' },
  { id: 'deepfield', name: 'Deep field', hint: 'Drifting nebula and stars' },
  { id: 'still', name: 'Still', hint: 'No motion, lowest power' },
]

const KEY = 'astrodocx.backdrop'
/** One choice per crew member, kept across reloads; storage can be unavailable (private mode), so failures are ignored. */
const saved = (): Record<string, BackdropId> => {
  try { return JSON.parse(localStorage.getItem(KEY) ?? '{}') as Record<string, BackdropId> } catch { return {} }
}

interface BackdropState {
  byCrew: Record<string, BackdropId>
  choose: (crewId: string, id: BackdropId) => void
}

export const useBackdropStore = create<BackdropState>((set, get) => ({
  byCrew: saved(),
  choose: (crewId, id) => {
    const byCrew = { ...get().byCrew, [crewId]: id }
    try { localStorage.setItem(KEY, JSON.stringify(byCrew)) } catch { /* not persisted */ }
    set({ byCrew })
  },
}))

/** The backdrop this crew member picked; the sunrise until they pick one. */
export const backdropFor = (byCrew: Record<string, BackdropId>, crewId: string | undefined): BackdropId => {
  const id = crewId ? byCrew[crewId] : undefined
  return id && BACKDROPS.some((b) => b.id === id) ? id : 'sunrise'
}
