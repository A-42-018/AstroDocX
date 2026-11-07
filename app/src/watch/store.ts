import { create } from 'zustand'
import { db, type ConsoleDB } from '../data/db'
import type { WearableKind } from '../data/types'
import type { NewestHr, SampleKind } from './frames'
import { HaylouWatch, watchSupported, type WatchHandlers } from './haylouWatch'
import { getLastWearableTimestamp, getWatchSaveOptIn, setWatchSaveOptIn, upsertWearables } from './history'

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
  /** Whether opt-in saving of watch data to the local database is enabled. */
  saveOptIn: boolean
  setSaveOptIn: (optIn: boolean) => void
  connect: () => Promise<void>
  disconnect: () => void
}

interface Link { connect(onPicked?: () => void): Promise<string>; disconnect(): void }
interface Deps { makeLink: (h: WatchHandlers) => Link; now: () => number; supported: () => boolean; db?: ConsoleDB }

const EMPTY = { hr: null, spo2: null, stress: null, newest: null, storedStress: null } as const

/**
 * The watch as a source of live vitals. Display only by default, like the webcam face scan: readings never reach
 * the alert engine, so a consumer wearable cannot shift a crew member's baseline. When opt-in saving is enabled,
 * data is stored locally in the Dexie `wearables` store for shadow-mode ML features and insights.
 */
export function createWatchStore(deps: Deps = { makeLink: (h) => new HaylouWatch(h), now: Date.now, supported: () => watchSupported() }) {
  let link: Link | null = null
  let sweeper: ReturnType<typeof setInterval> | null = null
  const seen: Record<SampleKind, number> = { hr: 0, spo2: 0, stress: 0 }
  const lastLiveSaved: Record<SampleKind, number> = { hr: 0, spo2: 0, stress: 0 }

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
    const take = (kind: SampleKind, value: number) => {
      const now = deps.now()
      seen[kind] = now
      set({ [kind]: value } as Pick<WatchState, SampleKind>)
      if (get().saveOptIn) {
        if (now - lastLiveSaved[kind] >= 60_000) {
          lastLiveSaved[kind] = now
          void upsertWearables(
            [{ kind, value, ts: now, source: 'haylou-solar5', live: true }],
            deps.db ?? db
          )
        }
      }
    }

    return {
      status: deps.supported() ? 'idle' : 'unsupported',
      name: '', note: '', ...EMPTY,
      saveOptIn: getWatchSaveOptIn(),

      setSaveOptIn(optIn: boolean) {
        setWatchSaveOptIn(optIn)
        set({ saveOptIn: optIn })
      },

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
          onHistoryPoints: (kind: WearableKind, points: { t: number; value: number }[]) => {
            if (link !== mine) return
            if (get().saveOptIn && points.length > 0) {
              const rows = points.map((p) => ({
                kind,
                value: p.value,
                ts: p.t * 1000,
                source: 'haylou-solar5' as const,
                live: false,
              }))
              void upsertWearables(rows, deps.db ?? db)
            }
          },
          getHistoryStart: async (kind: WearableKind) => {
            // stored rows only: a live row is stamped with the host clock and would skip unread history
            const lastMs = await getLastWearableTimestamp(kind, deps.db ?? db, { storedOnly: true })
            return lastMs ? Math.floor(lastMs / 1000) : null
          },
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
