import { ConsoleDB, db } from '../data/db'
import type { ActionLogEntry } from '../data/types'
import { HOUR } from '../data/synthetic'
import { linkAt, windowStarts } from './link'
import { getTransport, type GroundTransport } from './transport'

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

/**
 * Upload pending entries written up to `upToTs`, then mark them synced. With `transport` null nothing is
 * uploaded (the demo's pre-history runs inside a DB transaction, where network calls are not allowed).
 * If the upload fails nothing is marked and the error propagates, so the entries stay queued.
 */
async function sendAndMark(d: ConsoleDB, upToTs: number, syncedAt: number, transport: GroundTransport | null): Promise<number> {
  const batch = await d.actionLog.where('sync').equals('pending').filter((e) => e.ts <= upToTs).toArray()
  if (batch.length === 0) return 0
  if (transport) await transport.send(batch.map((e) => ({ ...e, sync: 'synced', syncedAt })))
  await d.actionLog.bulkUpdate(batch.map((e) => ({ key: e.id!, changes: { sync: 'synced' as const, syncedAt } })))
  return batch.length
}

/** Send everything pending right now. Only possible while a window is open. */
export async function syncNow(now: number, blackout = false, d: ConsoleDB = db, transport: GroundTransport | null = getTransport()): Promise<number> {
  const link = linkAt(now, blackout)
  if (link.state === 'blackout') throw new Error('Communications blackout: entries stay queued until it ends.')
  if (link.state === 'closed') throw new Error('No link window is open. Entries stay queued for the next window.')
  try {
    return await sendAndMark(d, now, now, transport)
  } catch (e) {
    throw new Error(`Upload failed, entries stay queued. ${e instanceof Error ? e.message : String(e)}`)
  }
}

/** Delay between a window opening and the first upload, so a window does not sync entries written after it started. */
const UPLOAD_LAG = HOUR / 2

/**
 * Sync automatically through every window that opened while mission time moved from `from` to `to`:
 * each window uploads what was queued up to 30 min after it opened. A blackout skips all of them.
 * `transport: null` marks entries without uploading.
 */
export async function autoSync(from: number, to: number, blackout = false, d: ConsoleDB = db, transport: GroundTransport | null = getTransport()): Promise<number> {
  if (blackout) return 0
  let sent = 0
  // Windows are sent in order; a failed upload stops here and leaves the rest queued for the next window.
  for (const w of windowStarts(from, to)) {
    const at = Math.min(w + UPLOAD_LAG, to)
    sent += await sendAndMark(d, at, at, transport)
  }
  return sent
}
