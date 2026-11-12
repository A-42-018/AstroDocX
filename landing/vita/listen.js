// One speech-recognition controller for NOVA and VITA. No build step, no DOM beyond visibilitychange.
//
//   const mic = createListener({ onInterim: (t) => ..., onFinal: (t) => ..., onState: (s) => ..., onError: (code) => ... })
//   mic.once()              // one phrase, then it stops (push-to-talk)
//   mic.setHandsFree(true)  // keeps listening until setHandsFree(false), a denied mic, or stop()
//   mic.pause('speaking')   // the guide is talking: drop the mic so it never hears itself; mic.resume('speaking') carries on
//
// States: 'idle' | 'listening' | 'paused' (hands-free, waiting) | 'denied' (the browser or the visitor said no).

const KEY = 'adx-voice'

/** Voice mode is remembered for this visit only (sessionStorage): a hot mic must never outlive the session. */
export const voiceModePref = {
  get() { try { return sessionStorage.getItem(KEY) === 'on' } catch { return false } },
  set(on) { try { on ? sessionStorage.setItem(KEY, 'on') : sessionStorage.removeItem(KEY) } catch { /* storage off */ } },
}

export function recognitionCtor() {
  if (typeof window === 'undefined') return undefined
  return window.SpeechRecognition || window.webkitSpeechRecognition || undefined
}

export function createListener({ onInterim, onFinal, onState, onError, SR = recognitionCtor(), lang = 'en-US', wait = setTimeout } = {}) {
  let mode = 'off', rec = null, state = 'idle', delay = 250, timer = null
  const pauses = new Set()

  const set = (s) => { if (s !== state) { state = s; onState?.(s) } }
  const live = () => mode !== 'off' && pauses.size === 0
  const settle = () => set(rec ? 'listening' : mode === 'handsfree' ? 'paused' : state === 'denied' ? 'denied' : 'idle')

  function drop() {
    clearTimeout(timer); timer = null
    const r = rec; rec = null
    if (r) { try { (r.abort || r.stop).call(r) } catch { /* already stopped */ } }
  }

  function start() {
    if (!SR || rec || !live()) return settle()
    const r = new SR()
    rec = r
    r.lang = lang; r.interimResults = true; r.maxAlternatives = 1; r.continuous = mode === 'handsfree'
    r.onresult = (e) => {
      if (r !== rec || !live()) return
      delay = 250
      for (let i = e.resultIndex ?? Math.max(0, e.results.length - 1); i < e.results.length; i++) {
        const res = e.results[i], text = String(res[0]?.transcript ?? '').trim()
        if (!text) continue
        if (!res.isFinal) { onInterim?.(text); continue }
        if (mode === 'once') { mode = 'off'; drop(); settle() }
        onFinal?.(text)
        if (mode === 'off') return
      }
    }
    r.onerror = (e) => {
      if (r !== rec) return
      const code = e?.error ?? 'error'
      if (code === 'not-allowed' || code === 'service-not-allowed') { mode = 'off'; rec = null; set('denied'); onError?.(code); return }
      if (code !== 'no-speech' && code !== 'aborted') onError?.(code)
    }
    r.onend = () => {
      if (r !== rec) return
      rec = null
      if (mode === 'once') { mode = 'off'; return settle() }
      settle()
      if (live() && mode === 'handsfree') { timer = wait(start, delay); delay = Math.min(delay * 2, 3000) }
    }
    try { r.start(); set('listening') } catch { rec = null; mode = 'off'; set('idle'); onError?.('start-failed') }
  }

  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => { document.hidden ? api.pause('hidden') : api.resume('hidden') })
  }

  const api = {
    get supported() { return !!SR },
    get state() { return state },
    get handsFree() { return mode === 'handsfree' },
    once() { drop(); mode = 'once'; delay = 250; state === 'denied' && set('idle'); start() },
    setHandsFree(on) {
      drop()
      if (!on) { mode = 'off'; return set('idle') }
      mode = 'handsfree'; delay = 250
      if (state === 'denied') set('idle')
      start(); settle()
    },
    pause(reason) { pauses.add(reason); if (rec) { drop(); settle() } else if (mode === 'once') { mode = 'off'; settle() } },
    resume(reason) { pauses.delete(reason); if (mode === 'handsfree' && live() && !rec) { delay = 250; start() } },
    stop() { mode = 'off'; pauses.clear(); drop(); set('idle') },
  }
  return api
}
