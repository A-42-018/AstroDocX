/* ============================================================
   ASTRODOCX — VITA's voice (the browser's own speech synthesis,
   no audio files, no API). Follows the briefing's Sound toggle:
   silent until the visitor turns sound on. Lines are split into
   sentences, because Chrome cuts off a single long utterance after
   about 15 seconds. With no voices installed it stays quiet and
   everything else works as before.
============================================================ */
const synth = typeof window !== 'undefined' ? window.speechSynthesis : undefined
const Utter = typeof window !== 'undefined' ? window.SpeechSynthesisUtterance : undefined

/* clearest first: natural / premium voices, then the common good system ones */
const score = (v) =>
  (/premium|enhanced|natural|neural/i.test(v.name) ? 8 : 0) +
  (/google us english|samantha|ava|allison|serena|karen|moira|tessa|daniel|google/i.test(v.name) ? 4 : 0) +
  (v.lang === 'en-US' ? 3 : v.lang === 'en-GB' ? 2 : 0) + (v.localService ? 1 : 0)
let chosen = null
function pick() {
  const en = (synth?.getVoices() ?? []).filter((v) => /^en/i.test(v.lang))
  chosen = en.sort((a, b) => score(b) - score(a))[0] ?? null
}
if (synth) { pick(); synth.addEventListener?.('voiceschanged', pick) }

/* say it the way a person would read it out */
const SAY = [
  [/AstroDocX/g, 'Astro Doc X'], [/\bVITA\b/g, 'Veeta'], [/CO₂|CO2/gi, 'C O 2'], [/SpO₂/g, 'S P O 2'],
  [/NASA-STD-3001/g, 'NASA standard thirty oh one'], [/STD-3001/g, 'standard thirty oh one'],
  [/(\d+(?:\.\d+)?)\s*mmHg/g, '$1 millimetres of mercury'], [/(\d+(?:\.\d+)?)\s*mSv/g, '$1 millisieverts'],
  [/\bEVA\b/g, 'E V A'], [/\bISS\b/g, 'I S S'], [/\bHRP\b/g, 'H R P'], [/\s*·\s*/g, ', '], [/…/g, '.'],
  [/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, ''],
]
export const speakable = (text) => SAY.reduce((s, [re, to]) => s.replace(re, to), String(text ?? '')).replace(/\s+/g, ' ').trim()

let on = false
let current = null   // resolves the line being said

export const voice = {
  available: !!(synth && Utter),
  get on() { return on },
  get speaking() { return !!current },
  set(v) { on = !!v && this.available; if (!on) this.cancel() },
  /** Call from a click: Safari only lets speech start from a gesture, so prime it with a silent utterance. */
  unlock() { if (!this.available) return; const u = new Utter(' '); u.volume = 0; synth.speak(u) },
  /** Say a line. Resolves when it is finished or cancelled; null when the voice is off (nothing to wait for). */
  speak(text) {
    if (!on || !this.available) return null
    const line = speakable(text)
    if (!line) return null
    this.cancel()
    const parts = line.match(/[^.!?;:]+[.!?;:]*\s*/g) ?? [line]
    return new Promise((resolve) => {
      let left = parts.length, settled = false
      const end = () => { if (!settled) { settled = true; current = null; resolve() } }
      current = end
      for (const p of parts) {
        const u = new Utter(p.trim())
        if (chosen) { u.voice = chosen; u.lang = chosen.lang } else u.lang = 'en-US'
        u.rate = 1.02; u.pitch = 1.08; u.volume = 1
        u.onend = () => { if (--left <= 0) end() }
        u.onerror = end   // interrupted, cancelled, or not allowed yet (no gesture)
        synth.speak(u)
      }
      // guard against engines that never fire onend
      setTimeout(end, 4000 + line.length * 120)
    })
  },
  cancel() { const c = current; current = null; synth?.cancel(); c?.() },
  pause() { synth?.pause() },
  resume() { synth?.resume() },
}
