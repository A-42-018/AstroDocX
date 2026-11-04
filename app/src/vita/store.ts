import { create } from 'zustand'
import { ask, type AskAction, type AskCitation } from '../../../landing/vita/ask.js'
import { vitaSay, vitaStop } from '../audio/voice'
import { exitTour, runTour } from '../tour/director'
import { useTour } from '../tour/store'
import { readHandoff, writeHandoff } from './handoff'
import { TOUR_REPLY, wantsTour } from './intent'

export interface Msg {
  id: number
  role: 'user' | 'assistant'
  text: string
  citations?: AskCitation[]
  actions?: AskAction[]
  source?: 'live' | 'offline'
}

interface VitaState {
  open: boolean
  /** VITA is looking something up. */
  busy: boolean
  messages: Msg[]
  set: (p: Partial<Omit<VitaState, 'set'>>) => void
}

let nextId = 1
const restored: Msg[] = readHandoff().chat?.map((m) => ({ id: nextId++, role: m.role, text: m.text })) ?? []

export const useVita = create<VitaState>((set) => ({ open: false, busy: false, messages: restored, set: (p) => set(p) }))

/** What the ask module and the next page get: plain text, the last few messages. */
export const plain = (s: string) => s.replace(/<[^>]*>/g, '')
const history = () => useVita.getState().messages.slice(-6).map((m) => ({ role: m.role, text: plain(m.text) }))

function push(m: Omit<Msg, 'id'>) {
  const msgs = [...useVita.getState().messages, { ...m, id: nextId++ }].slice(-40)
  useVita.setState({ messages: msgs })
  writeHandoff({ chat: msgs.slice(-6).map((x) => ({ role: x.role, text: plain(x.text) })) })
}

export type Go = (path: string) => void

/** Start a guided tour from inside the console (the dock's button or a "tour" answer). */
export function startGuide(go: Go, mode: 'quick' | 'full' = 'full') {
  useVita.setState({ open: false })
  void runTour((p) => go(p), mode)
}

/**
 * The visitor asks VITA something. Asking for the tour starts the full guide; anything else goes to the ask module
 * (live answer, or the offline matcher) and is read out when Sound is on. A running tour pauses while VITA answers.
 */
export async function sendQuestion(question: string, page: string, go: Go) {
  const q = question.trim()
  if (!q || useVita.getState().busy) return
  push({ role: 'user', text: q })
  if (useTour.getState().phase === 'running') useTour.getState().set({ paused: true })
  if (wantsTour(q)) {
    push({ role: 'assistant', text: TOUR_REPLY, source: 'offline' })
    await vitaSay(TOUR_REPLY)
    startGuide(go, 'full')
    return
  }
  useVita.setState({ busy: true })
  vitaStop()
  const r = await ask(q, { history: history().slice(0, -1), page })
  useVita.setState({ busy: false })
  push({ role: 'assistant', text: r.text, citations: r.citations, actions: r.actions, source: r.source })
  void vitaSay(plain(r.text))
}

/** An answer's action button, run inside the console. Libraries live on the landing page. */
export function runAction(a: AskAction, go: Go) {
  if (a.kind === 'tour') { startGuide(go, 'quick'); return }
  vitaStop()
  exitTour()
  useVita.setState({ open: false })
  if (a.kind === 'library') { window.location.assign(`/#library${a.target ? `/${a.target}` : ''}`); return }
  if (a.kind === 'cabin') { go(`/cabin${a.target ? `?shot=${encodeURIComponent(a.target)}` : ''}`); return }
  go(a.target || '/board')
}
