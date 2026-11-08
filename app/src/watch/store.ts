import { create } from 'zustand'
import type { NewestHr, SampleKind } from './frames'
import { HaylouWatch, watchSupported, type WatchHandlers } from './haylouWatch'

export type WatchStatus = 'unsupported' | 'idle' | 'picking' | 'connecting' | 'connected'

/** How long a reading counts as "now" after the watch last sent it. SpO₂ and stress arrive far less often than heart rate. */
export const TTL_MS: Record<SampleKind, number> = { hr: 20_000, spo2: 60_000, stress: 60_000 }
/** A polled reading stamped within this of the local clock is live; an older one is just the last stored value. */
const LIVE_WINDOW_MS = 30_000

export interface WatchState {
  status: WatchStatus
  name: string
  /** Why the last attempt failed or the link dropped; empty when all is well. */
  note: string
  /** The current readings, or null once they go stale (the watch stops measuring when its heart rate screen closes). */
  hr: number | null
  spo2: number | null
  stress: number | null
  /** The newest stress the watch has stored (read once after connecting). A past value with the watch's timestamp, never live. */
  storedStress: { value: number; at: number } | null
  /** The last value the poll returned, live or not, with the watch's own timestamp. */
  newest: NewestHr | null
  connect: () => Promise<void>
  disconnect: () => void
}

interface Link { connect(onPicked?: () => void): Promise<string>; disconnect(): void }
interface Deps { makeLink: (h: WatchHandlers) => Link; now: () => number; supported: () => boolean }

const EMPTY = { hr: null, spo2: null, stress: null, newest: null, storedStress: null } as const

/**
 * The watch as a source of live vitals. Display only, like the webcam face scan: readings are not saved to the
 * database and never reach the alert engine, so a consumer wearable cannot shift a crew member's baseline.
 */
export function createWatchStore(deps: Deps = { makeLink: (h) => new HaylouWatch(h), now: Date.now, supported: () => watchSupported() }) {
  let link: Link | null = null
  let sweeper: ReturnType<typeof setInterval> | null = null
  const seen: Record<SampleKind, number> = { hr: 0, spo2: 0, stress: 0 }

  return create<WatchState>((set, get) => {
    const stopSweep = () => { if (sweeper) { clearInterval(sweeper); sweeper = null } }
    const startSweep = () => {
      stopSweep()
      sweeper = setInterval(() => {
        const now = deps.now(), s = get()
        const drop: Partial<WatchState> = {}
        for (const k of Object.keys(TTL_MS) as SampleKind[]) if (s[k] !== null && now - seen[k] > TTL_MS[k]) drop[k] = null
        if (Object.keys(drop).length) set(drop)
      }, 1000)
    }
    const take = (kind: SampleKind, value: number) => { seen[kind] = deps.now(); set({ [kind]: value } as Pick<WatchState, SampleKind>) }

    return {
      status: deps.supported() ? 'idle' : 'unsupported',
      name: '', note: '', ...EMPTY,

      async connect() {
        const s = get()
        if (s.status !== 'idle') return
        set({ status: 'picking', note: '', ...EMPTY })
        const mine: Link = deps.makeLink({
          onSample: (x) => { if (link === mine) take(x.kind, x.value) },
          onNewest: (r) => {
            if (link !== mine) return
            set({ newest: r })
            if (Math.abs(deps.now() - r.at * 1000) <= LIVE_WINDOW_MS) take('hr', r.bpm)
          },
          onStoredStress: (r) => { if (link === mine) set({ storedStress: r }) },
          onDisconnect: () => {
            if (link !== mine) return
            link = null; stopSweep()
            set({ status: 'idle', name: '', note: 'The watch disconnected.', ...EMPTY })
          },
        })
        link = mine
        try {
          const name = await mine.connect(() => { if (link === mine) set({ status: 'connecting' }) })
          if (link !== mine) return
          set({ status: 'connected', name })
          startSweep()
        } catch (e) {
          if (link !== mine) return
          link = null; stopSweep()
          set({ status: 'idle', name: '', note: e instanceof Error ? e.message : 'The watch could not be connected.', ...EMPTY })
        }
      },

      disconnect() {
        const l = link
        link = null; stopSweep()
        set({ status: deps.supported() ? 'idle' : 'unsupported', name: '', note: '', ...EMPTY })
        l?.disconnect()
      },
    }
  })
}

export const useWatch = createWatchStore()
