import { ConsoleDB, db } from '../data/db'
import type { ActionLogEntry } from '../data/types'
import { HOUR } from '../data/synthetic'
import { linkAt, windowStarts } from './link'

export interface Outbox {
  pending: ActionLogEntry[]
  /** Newest first. */
  synced: ActionLogEntry[]
}

export async function loadOutbox(d: ConsoleDB = db, syncedLimit = 10): Promise<Outbox> {
  const pending = await d.actionLog.where('sync').equals('pending').sortBy('ts')
  const synced = (await d.actionLog.where('sync').equals('synced').toArray()).sort((a, b) => (b.syncedAt ?? 0) - (a.syncedAt ?? 0) || b.ts - a.ts)
  return { pending, synced: synced.slice(0, syncedLimit) }
}

async function markSynced(d: ConsoleDB, upToTs: number, syncedAt: number): Promise<number> {
  return d.actionLog.where('sync').equals('pending').filter((e) => e.ts <= upToTs).modify((e) => {
    e.sync = 'synced'
    e.syncedAt = syncedAt
  })
}

/** Send everything pending right now. Only possible while a window is open. */
export async function syncNow(now: number, blackout = false, d: ConsoleDB = db): Promise<number> {
  const link = linkAt(now, blackout)
  if (link.state === 'blackout') throw new Error('Communications blackout: entries stay queued until it ends.')
  if (link.state === 'closed') throw new Error('No link window is open. Entries stay queued for the next window.')
  return markSynced(d, now, now)
}

/** Delay between a window opening and the first upload, so a window does not sync entries written after it started. */
const UPLOAD_LAG = HOUR / 2

/**
 * Sync automatically through every window that opened while mission time moved from `from` to `to`:
 * each window uploads what was queued up to 30 min after it opened. A blackout skips all of them.
 */
export async function autoSync(from: number, to: number, blackout = false, d: ConsoleDB = db): Promise<number> {
  if (blackout) return 0
  let sent = 0
  for (const w of windowStarts(from, to)) sent += await markSynced(d, Math.min(w + UPLOAD_LAG, to), Math.min(w + UPLOAD_LAG, to))
  return sent
}
