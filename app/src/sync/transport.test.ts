import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ConsoleDB } from '../data/db'
import { DAY, HOUR, MISSION_START } from '../data/synthetic'
import type { ActionLogEntry } from '../data/types'
import { autoSync, loadOutbox, syncNow } from './outbox'
import { fromRow, getTransport, simulatedTransport, supabaseTransport, toRow, type GroundTransport } from './transport'

const at = (day: number, h: number) => MISSION_START + day * DAY + h * HOUR
const entry: ActionLogEntry = { id: 7, crewId: 'pilot', kind: 'alert-opened', text: 'ACT: x', alertId: 3, ts: 1000, sync: 'pending' }

describe('row mapping', () => {
  it('round-trips an entry with a device-scoped uid', () => {
    const row = toRow(entry, 'dev1', 2000)
    expect(row).toEqual({ uid: 'dev1:7', device: 'dev1', crew_id: 'pilot', kind: 'alert-opened', text: 'ACT: x', alert_id: 3, ts: 1000, synced_at: 2000 })
    expect(fromRow(row)).toEqual({ ...entry, sync: 'synced', syncedAt: 2000 })
    expect(fromRow({ ...row, alert_id: null }).alertId).toBeUndefined()
  })
})

describe('supabaseTransport', () => {
  it('upserts rows to the REST endpoint with the anon key', async () => {
    const f = vi.fn().mockResolvedValue(new Response(null, { status: 201 }))
    const t = supabaseTransport('https://abc.supabase.co/', 'anon-key', 'dev1', { fetch: f })
    expect(t.name).toBe('Supabase (abc.supabase.co)')
    await t.send([{ ...entry, syncedAt: 5000 }])
    const [url, init] = f.mock.calls[0]
    expect(url).toBe('https://abc.supabase.co/rest/v1/action_log?on_conflict=uid')
    expect(init.method).toBe('POST')
    expect(init.headers).toMatchObject({ apikey: 'anon-key', Authorization: 'Bearer anon-key', Prefer: 'resolution=merge-duplicates,return=minimal' })
    expect(JSON.parse(init.body)).toEqual([toRow(entry, 'dev1', 5000)])
  })
  it('sends nothing for an empty batch and throws with the server message on failure', async () => {
    const f = vi.fn().mockResolvedValue(new Response('permission denied', { status: 401 }))
    const t = supabaseTransport('https://abc.supabase.co', 'k', 'd', { fetch: f })
    await t.send([])
    expect(f).not.toHaveBeenCalled()
    await expect(t.send([entry])).rejects.toThrow('Ground server answered 401: permission denied')
  })
  it('reads everything back as synced entries', async () => {
    const f = vi.fn().mockResolvedValue(new Response(JSON.stringify([toRow(entry, 'd', 9)]), { status: 200 }))
    const rows = await supabaseTransport('https://abc.supabase.co', 'k', 'd', { fetch: f }).fetchAll!()
    expect(f.mock.calls[0][0]).toBe('https://abc.supabase.co/rest/v1/action_log?select=*&order=ts.asc')
    expect(rows).toEqual([{ ...entry, sync: 'synced', syncedAt: 9 }])
  })
})

it('defaults to the simulated ground station when no server is configured', () => {
  expect(getTransport()).toBe(simulatedTransport)
})

describe('sync with a transport', () => {
  let d: ConsoleDB
  let n = 0
  const add = (ts: number) => d.actionLog.add({ crewId: 'cmdr', kind: 'note', text: `n${ts}`, ts, sync: 'pending' })
  beforeEach(() => { d = new ConsoleDB(`transport-${n++}`) })

  it('uploads what it marks synced, with the sync time', async () => {
    const sent: ActionLogEntry[][] = []
    const t: GroundTransport = { name: 't', send: async (b) => { sent.push(b) } }
    await add(at(1, 0)); await add(at(1, 1))
    expect(await syncNow(at(1, 1), false, d, t)).toBe(2)
    expect(sent).toHaveLength(1)
    expect(sent[0].every((e) => e.sync === 'synced' && e.syncedAt === at(1, 1))).toBe(true)
  })

  it('a failed upload keeps everything queued and says so', async () => {
    const t: GroundTransport = { name: 't', send: async () => { throw new Error('offline') } }
    await add(at(1, 0))
    await expect(syncNow(at(1, 1), false, d, t)).rejects.toThrow('Upload failed, entries stay queued. offline')
    expect((await loadOutbox(d)).pending).toHaveLength(1)
  })

  it('auto-sync sends window by window and stops at the first failure', async () => {
    let calls = 0
    const t: GroundTransport = { name: 't', send: async () => { if (++calls === 2) throw new Error('lost') } }
    await add(at(1, 3)); await add(at(1, 13)); await add(at(2, 3))
    await expect(autoSync(at(1, 1), at(2, 6), false, d, t)).rejects.toThrow('lost')
    const box = await loadOutbox(d)
    expect(box.synced.map((e) => e.ts)).toEqual([at(1, 3)]) // first window only
    expect(box.pending.map((e) => e.ts)).toEqual([at(1, 13), at(2, 3)])
  })
})
