import type { DoctorReport } from './analyze'
import { answer, DECLINE } from './answer'
import { narrate, narrativeText, whoOf, type Style } from './brief'

/*
 * The live layer: /api/doctor (api/doctor.py) re-words the report or answers a question about it with Claude. It only
 * gets the report the console computed, never the raw readings, and the server rejects any reply with a number or a
 * crew member the report does not have. Whatever goes wrong (no key, offline, a timeout, the dev server, a rejected
 * reply) VITA answers from the same report offline, so `consult` never throws and the page never waits on it.
 */

export interface Consult { text: string; citations: { label: string; url: string }[]; source: 'live' | 'offline' }
export interface ChatLine { role: 'user' | 'assistant'; text: string }

const URL_ = '/api/doctor'
const TIMEOUT_MS = 18_000
/** After a 503/404 (no key, or no such endpoint: the Vite dev server) stop asking for the rest of the visit. */
let unavailable = false

/** What is sent: the report's words, not its ids or timestamps. */
export function wire(r: DoctorReport) {
  const m = r.mission
  return {
    scope: r.scope, met: r.met, overall: r.overall, headline: r.headline,
    crew: r.crew.map((c) => ({ name: c.name, status: c.status, readiness: c.readiness, worstHazard: c.worstHazard, evaWhy: c.evaWhy })),
    findings: r.findings.slice(0, 10).map((f) => ({ status: f.status, title: f.title, why: f.why, cabinWide: f.cabinWide })),
    advice: r.advice.slice(0, 12).map((a) => ({ priority: a.priority, text: a.text, who: whoOf(a, r) })),
    watchlist: r.watchlist.slice(0, 6).map((w) => ({ why: w.why })),
    mission: { line: `Highest cumulative dose ${m.maxDoseMsv.toFixed(1)} of 600 mSv; ${m.sinceSyncH === null ? 'never synced with the ground' : `last ground sync ${m.sinceSyncH.toFixed(1)} h ago`}, ${m.pendingSync} log entries pending.` },
  }
}

export function offline(r: DoctorReport, style: Style, question?: string): Consult {
  const text = question?.trim() ? answer(question, r).text : narrativeText(narrate(r, style))
  return { text, citations: [], source: 'offline' }
}

/** VITA's words for a report: the live layer when it answers well, else the offline brief or answer. */
export async function consult(r: DoctorReport, style: Style, question?: string, history: ChatLine[] = []): Promise<Consult> {
  const local = offline(r, style, question)
  // personal medical questions are declined here, never sent
  if (unavailable || local.text === DECLINE || typeof fetch === 'undefined') return local
  const ctl = new AbortController()
  const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(URL_, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: ctl.signal,
      body: JSON.stringify({ report: wire(r), style, question: question?.trim() || undefined, history: history.slice(-6) }),
    })
    if (res.status === 503 || res.status === 404 || res.status === 405) unavailable = true
    if (!res.ok || !(res.headers.get('content-type') ?? '').includes('json')) { if (res.ok) unavailable = true; return local }
    const body = await res.json() as Partial<Consult>
    if (typeof body.text !== 'string' || !body.text.trim()) return local
    const citations = Array.isArray(body.citations) ? body.citations.filter((c) => typeof c?.url === 'string' && c.url.startsWith('https://') && typeof c.label === 'string') : []
    return { text: body.text, citations, source: 'live' }
  } catch {
    return local
  } finally {
    clearTimeout(timer)
  }
}

/** Tests only. */
export const resetLive = () => { unavailable = false }
