import { create } from 'zustand'
import { createListener, voiceModePref, type Listener, type ListenState } from '../../../landing/vita/listen.js'
import { useVitaVoice } from '../audio/voice'
import { handleSpeech, type Ctx } from './execute'

interface VoiceState {
  state: ListenState
  handsFree: boolean
  /** Interim transcript while speaking, then what was heard / done. */
  line: string
  set: (p: Partial<Omit<VoiceState, 'set'>>) => void
}
export const useVoice = create<VoiceState>((set) => ({ state: 'idle', handsFree: false, line: '', set: (p) => set(p) }))

let listener: Listener | null = null
let ctx: Ctx | null = null

/** The page the voice layer runs in keeps this current (navigation, history). */
export function bindVoice(c: Ctx) { ctx = c }

function get(): Listener {
  if (listener) return listener
  const v = useVoice.getState().set
  listener = createListener({
    onInterim: (t) => v({ line: t }),
    onFinal: (t) => {
      if (!ctx) return
      const r = handleSpeech(t, ctx)
      v({ line: r.kind === 'command' && r.line ? r.line : `“${t}”` })
    },
    onState: (s) => {
      v({ state: s, handsFree: listener?.handsFree ?? false })
      if (s === 'denied') { voiceModePref.set(false); v({ line: 'Microphone blocked. Allow it in the browser, then try again.' }) }
    },
    onError: (code) => { if (code !== 'not-allowed' && code !== 'service-not-allowed') v({ line: 'I could not hear that. Try again.' }) },
  })
  // the guide's own voice must not be heard as a command
  useVitaVoice.subscribe((s) => { if (s.speaking) listener?.pause('speaking'); else listener?.resume('speaking') })
  return listener
}

export const voiceSupported = () => get().supported

export function micTap() {
  const l = get()
  if (l.state === 'listening') { if (l.handsFree) voiceModeOff(); else l.stop(); return }
  useVoice.getState().set({ line: '' })
  l.once()
}

export function setVoiceMode(on: boolean) {
  const l = get()
  voiceModePref.set(on)
  l.setHandsFree(on)
  useVoice.getState().set({ handsFree: on, line: on ? 'Voice mode on. Say a command, like “open alerts”.' : 'Voice mode off.' })
}
export const voiceModeOff = () => setVoiceMode(false)

/** Arriving with voice mode left on (from the homepage or an earlier screen): carry on listening. */
export function resumeVoiceMode() { if (voiceModePref.get() && get().supported && !get().handsFree) setVoiceMode(true) }
