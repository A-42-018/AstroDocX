import type { ActionLogEntry } from '../data/types'

/**
 * Where synced log entries go. The default is the simulated ground station (nothing leaves the device).
 * Setting VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY at build time switches uploads to a Supabase
 * table (schema in docs/supabase.sql). A failed upload leaves entries queued, exactly like a blackout.
 */
export interface GroundTransport {
  /** Shown on the Ground Sync page. */
  name: string
  /** Upload a batch; throw to keep it queued. */
  send(entries: ActionLogEntry[]): Promise<void>
  /** Everything the ground has received (only for a real server). */
  fetchAll?(): Promise<ActionLogEntry[]>
}

export const simulatedTransport: GroundTransport = {
  name: 'Simulated ground station (on this device)',
  send: async () => {},
}

/** Row shape in the `action_log` table. `uid` makes re-sending the same entry idempotent. */
export interface GroundRow {
  uid: string
  device: string
  crew_id: string
  kind: ActionLogEntry['kind']
  text: string
  alert_id: number | null
  ts: number
  synced_at: number
}

export const toRow = (e: ActionLogEntry, device: string, syncedAt: number): GroundRow => ({
  uid: `${device}:${e.id}`, device, crew_id: e.crewId, kind: e.kind, text: e.text, alert_id: e.alertId ?? null, ts: e.ts, synced_at: syncedAt,
})

export const fromRow = (r: GroundRow): ActionLogEntry => ({
  id: Number(r.uid.split(':')[1]), crewId: r.crew_id, kind: r.kind, text: r.text, ts: r.ts, sync: 'synced', syncedAt: r.synced_at,
  ...(r.alert_id !== null && { alertId: r.alert_id }),
})

export function supabaseTransport(url: string, anonKey: string, device: string, opts: { table?: string; fetch?: typeof fetch } = {}): GroundTransport {
  const table = opts.table ?? 'action_log'
  const f = opts.fetch ?? fetch.bind(globalThis)
  const base = `${url.replace(/\/$/, '')}/rest/v1/${table}`
  const headers = { apikey: anonKey, Authorization: `Bearer ${anonKey}`, 'Content-Type': 'application/json' }
  const fail = async (res: Response): Promise<never> => {
    throw new Error(`Ground server answered ${res.status}: ${(await res.text()).slice(0, 160)}`)
  }
  return {
    name: `Supabase (${new URL(url).host})`,
    async send(entries) {
      if (entries.length === 0) return
      const res = await f(`${base}?on_conflict=uid`, {
        method: 'POST',
        headers: { ...headers, Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify(entries.map((e) => toRow(e, device, e.syncedAt ?? e.ts))),
      })
      if (!res.ok) await fail(res)
    },
    async fetchAll() {
      const res = await f(`${base}?select=*&order=ts.asc`, { headers })
      if (!res.ok) await fail(res)
      return ((await res.json()) as GroundRow[]).map(fromRow)
    },
  }
}

/** A stable id for this device, so rows from different consoles never collide. */
export function deviceId(): string {
  const KEY = 'astrodocx.device'
  try {
    let id = localStorage.getItem(KEY)
    if (!id) localStorage.setItem(KEY, (id = Math.random().toString(36).slice(2, 10)))
    return id
  } catch {
    return 'device'
  }
}

let current: GroundTransport | undefined
/** The transport chosen by build-time config (simulated unless both Supabase variables are set). */
export function getTransport(): GroundTransport {
  if (current) return current
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined
  current = url && key ? supabaseTransport(url, key, deviceId()) : simulatedTransport
  return current
}
/** Test seam. */
export const setTransport = (t: GroundTransport | undefined) => { current = t }
