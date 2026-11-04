import { useSound } from '../audio/sfx'
import type { TourMode } from '../tour/script'

/*
 * What the landing page hands to the console in sessionStorage ('adx-vita'), so VITA carries on where it left off:
 * whether Sound is on, whether a tour was asked for (and which), and the last few chat messages. The landing page
 * writes it as the page is left (landing/briefing/briefing.js, landing/tour.js); the console keeps the sound part
 * up to date and the chat part (store.ts) as the visitor goes on.
 */

export const KEY = 'adx-vita'
export interface ChatLine { role: 'user' | 'assistant'; text: string }
export interface Handoff { sound?: boolean; tour?: TourMode | null; chat?: ChatLine[] }

export function readHandoff(): Handoff {
  try {
    const raw = JSON.parse(sessionStorage.getItem(KEY) ?? 'null')
    if (!raw || typeof raw !== 'object') return {}
    const chat: ChatLine[] = Array.isArray(raw.chat)
      ? raw.chat.filter((m: ChatLine) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.text === 'string').slice(-6).map((m: ChatLine) => ({ role: m.role, text: m.text.slice(0, 1200) }))
      : []
    return { sound: typeof raw.sound === 'boolean' ? raw.sound : undefined, tour: raw.tour === 'full' || raw.tour === 'quick' ? raw.tour : null, chat }
  } catch { return {} }
}

export function writeHandoff(patch: Partial<Handoff>) {
  try { sessionStorage.setItem(KEY, JSON.stringify({ ...readHandoff(), ...patch })) } catch { /* private mode: it just starts fresh */ }
}

/** The landing page's Sound choice wins over the console's default (the landing page starts silent, the console starts on). */
let applied = false
export function applyHandoff() {
  if (applied) return
  applied = true
  const h = readHandoff()
  if (typeof h.sound === 'boolean' && h.sound !== useSound.getState().on) useSound.setState({ on: h.sound })
  useSound.subscribe((s) => writeHandoff({ sound: s.on }))
}
applyHandoff()

/** Which tour was asked for: the address says so (?mode=full) or the landing page left it behind. */
export function askedMode(search: string): TourMode {
  const m = new URLSearchParams(search).get('mode')
  if (m === 'full' || m === 'quick') return m
  return readHandoff().tour === 'full' ? 'full' : 'quick'
}
