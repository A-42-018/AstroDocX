import { create } from 'zustand'
import { duckMusic } from './music'
import { audible, computerBeeps, radioClose, radioOpen, useSound } from './sfx'

/*
 * The cabin's voices, from the browser's own speech synthesis (no audio files). Crew talk over a radio: a squelch
 * click from where the speaker floats before and after each line. The two robots on the floor are VITA, the crew doctor,
 * who answers in her own voice, and MEDI, her helper, in a flat low one; consoles chirp around the room between calls. The score ducks while anyone speaks. Voices depend on what
 * the device has installed; with none, the beeps and clicks still play.
 */

type Who = 'Ground' | 'Ship Computer' | 'Commander' | 'Pilot' | 'Flight Engineer' | 'Medical Officer' | 'Mission Specialist' | 'Payload Specialist' | 'VITA' | 'MEDI'
interface Tone { pitch: number; rate: number; at: [number, number, number] }
// pitch stays near 1 for the crew and not too low for the robots: extreme pitch is what makes speech mushy
const TONE: Record<Who, Tone> = {
  Ground: { pitch: 0.95, rate: 0.95, at: [0, 0.6, -3.5] }, 'Ship Computer': { pitch: 1.0, rate: 0.92, at: [0, 0, -1] },
  Commander: { pitch: 0.85, rate: 0.92, at: [-1.5, 0.3, -3] }, Pilot: { pitch: 1.0, rate: 0.96, at: [1.5, 0.3, -3] },
  'Flight Engineer': { pitch: 0.95, rate: 0.95, at: [-3, 0, -1] }, 'Medical Officer': { pitch: 1.1, rate: 0.93, at: [3, 0, -1] },
  'Mission Specialist': { pitch: 1.05, rate: 0.95, at: [-2.5, 0.5, 2] }, 'Payload Specialist': { pitch: 0.9, rate: 0.95, at: [2.5, 0.5, 2] },
  VITA: { pitch: 1.0, rate: 0.94, at: [2, -0.5, -2] }, MEDI: { pitch: 0.6, rate: 0.86, at: [-2, -0.5, -2] },
}
const ORDER = Object.keys(TONE) as Who[]
const isBot = (w: Who) => w === 'VITA' || w === 'MEDI' || w === 'Ship Computer'

const synth = typeof window !== 'undefined' ? window.speechSynthesis : undefined
const voiceFor = new Map<Who, SpeechSynthesisVoice>()
/** Clearest first: the natural, premium and enhanced voices, then the common system ones. */
const score = (v: SpeechSynthesisVoice) =>
  (/premium|enhanced|natural|neural/i.test(v.name) ? 8 : 0) + (/google|samantha|daniel|karen|moira|tessa|alex|oliver|serena|fiona/i.test(v.name) ? 4 : 0) + (v.lang === 'en-US' || v.lang === 'en-GB' ? 2 : 0) + (v.localService ? 1 : 0)
function loadVoices() {
  const en = (synth?.getVoices() ?? []).filter((v) => v.lang.startsWith('en')).sort((a, b) => score(b) - score(a)).slice(0, 8)
  voiceFor.clear()
  if (en.length) ORDER.forEach((w, i) => voiceFor.set(w, en[i % en.length]))
}
if (synth) { loadVoices(); synth.addEventListener?.('voiceschanged', loadVoices) }

/** A chatter line's text, or a function for one that is read from the live data when it is said (VITA's crew status). */
type Line = [Who, string | (() => string)]
let queue: [Who, string][] = []
let talking = false
const framed = typeof window !== 'undefined' && window.self !== window.top

function finish() { talking = false; duckMusic(vitaActive) }

function next() {
  const item = queue.shift()
  if (!item || !synth || !audible()) { finish(); const then = drained; drained = null; then?.(); return }
  const [who, text] = item
  const t = TONE[who]
  const u = new SpeechSynthesisUtterance(who === 'VITA' ? speakable(text) : text)
  u.pitch = t.pitch; u.rate = t.rate; u.volume = 1; u.lang = 'en-US'
  const v = who === 'VITA' ? vitaVoice ?? voiceFor.get(who) : voiceFor.get(who)
  if (v) { u.voice = v; u.lang = v.lang }
  // VITA's chatter lines move her robot and caption like her own speech
  if (who === 'VITA') u.onstart = () => useVitaVoice.setState({ speaking: true, line: text })
  const done = () => {
    if (who === 'VITA' && !vitaActive) useVitaVoice.setState({ speaking: false, line: '' })
    if (!isBot(who)) radioClose(t.at); window.setTimeout(next, 450 + Math.random() * 300)
  }
  u.onend = done; u.onerror = done
  talking = true
  duckMusic(true)
  if (!isBot(who)) radioOpen(t.at)
  // a beat after the click, so the first word is not clipped
  window.setTimeout(() => (audible() ? synth.speak(u) : done()), isBot(who) ? 120 : 380)
}

/** Say lines in turn; `interrupt` drops whatever is queued or being said (used when the crew click someone). */
function say(lines: [Who, string][], interrupt = false) {
  // VITA owns the speakers while she talks: crew calls wait for the next gap rather than cutting her off
  if (framed || !synth || !audible() || vitaActive) return
  if (interrupt) { queue = []; synth.cancel(); finish() }
  queue.push(...lines)
  if (!talking) next()
}

/** Called once when the radio queue next runs dry (after a crew member's introduction). */
let drained: (() => void) | null = null

/** A crew member introduces themselves when clicked; `then` runs once they have finished (VITA adds her note). */
export function introduce(role: string, then?: () => void) {
  const who = (role in TONE ? role : 'Commander') as Who
  if (framed || !synth || !audible() || vitaActive) { then?.(); return }
  drained = then ?? null
  say([[who, `Hey! Welcome, I am the ${role}!`], [who, role === 'Medical Officer' ? 'I look after the crew’s health.' : 'Glad to have you aboard.']], true)
}

/** What VITA answers when the commander asks for the crew status over the radio: the cabin keeps it current. */
let crewStatus = () => 'All crew are within their baselines, Commander.'
export function setCrewStatus(line: () => string) { crewStatus = line }

// Short, plain sentences with commas where a person would pause; numbers in words; no abbreviations.
const CABIN: Line[][] = [
  [['Commander', 'Pilot, this is Commander. Report your heading.'], ['Pilot', 'Commander, heading is steady. Orbit is normal.'], ['Commander', 'Copy. Thank you.']],
  [['Flight Engineer', 'Medical, I am checking the air scrubbers now.'], ['Medical Officer', 'Flight, the air quality looks good from here.'], ['Flight Engineer', 'Confirmed. All green.']],
  [['Medical Officer', 'Specialist, how did you sleep?'], ['Mission Specialist', 'Better this week. Seven hours last night.'], ['Medical Officer', 'Good. Please log it in your check in.']],
  [['MEDI', 'Cabin pressure is stable.'], ['VITA', 'Confirmed. Oxygen is normal.'], ['MEDI', 'All systems are nominal.'], ['VITA', 'Agreed. Thank you, MEDI.']],
  [['Payload Specialist', 'Commander, the payload bay is secure. Experiment four is running.'], ['Commander', 'Copy, Payload. Keep me posted.']],
  [['Pilot', 'Flight, the ground link opens in forty minutes.'], ['Flight Engineer', 'Understood. I will send the sync before then.'], ['Pilot', 'Thank you.']],
  [['Commander', 'VITA, how is the crew doing?'], ['VITA', () => crewStatus()], ['Commander', 'Copy. Thank you, VITA.']],
  [['VITA', 'Pilot, your heart rate is slightly high.'], ['Pilot', 'It is just the coffee, VITA.'], ['VITA', 'There is no coffee on board.'], ['Pilot', 'Exactly.']],
  [['Mission Specialist', 'Commander, Earth looks beautiful from the window today.'], ['Commander', 'It never gets old.']],
  [['Flight Engineer', 'Solar power is within range.'], ['MEDI', 'I agree. The power margin is twelve percent.']],
]

const CONSOLE: [Who, string][][] = [
  [['Ground', 'Crew, this is Ground. The link window opens in forty minutes.'], ['Commander', 'Ground, Commander. Copy. Standing by.']],
  [['Ground', 'Crew, we can see your vitals on the board. Everything looks good.'], ['Medical Officer', 'Thank you, Ground. The whole crew is healthy.']],
  [['Ship Computer', 'Reminder. Daily check ins are due.'], ['Medical Officer', 'Copy, computer. I will remind the crew.']],
  [['Ground', 'Flight Engineer, please confirm the scrubber status.'], ['Flight Engineer', 'Ground, the scrubbers are running normally.'], ['Ground', 'Copy, thank you.']],
  [['Ship Computer', 'All crew monitors are online.'], ['Commander', 'Acknowledged, computer.']],
  [['Pilot', 'Ground, Pilot. Orbit is stable, no corrections needed.'], ['Ground', 'Copy, Pilot. Nice and steady.']],
]
let kind: 'cabin' | 'console' = 'cabin'
let timer = 0
let last = -1
const tick = () => {
  timer = window.setTimeout(tick, 6000 + Math.random() * 6000)
  if (document.hidden || talking || vitaActive || hushed || !audible()) return
  if (Math.random() < 0.4) { computerBeeps(); return }
  const set = kind === 'cabin' ? CABIN : CONSOLE
  let i = Math.floor(Math.random() * set.length)
  if (i === last) i = (i + 1) % set.length
  last = i
  say(set[i].map(([w, x]): [Who, string] => [w, typeof x === 'function' ? x() : x]))
}

/** Start the background life of the ship: console beeps around the room and radio chatter every few seconds. */
export function startChatter(where: 'cabin' | 'console' = 'cabin') { kind = where; last = -1; if (!timer && !framed) timer = window.setTimeout(tick, 4000) }
/** The ship's computer speaks (alerts, confirmations), without a radio click. */
export const announce = (text: string) => say([['Ship Computer', text]])
export function stopChatter() { window.clearTimeout(timer); timer = 0; queue = []; if (!vitaActive) synth?.cancel(); finish() }

/** A guided tour (or VITA's own speech) keeps the radio quiet: no chatter or console chirps between her lines. */
let hushed = false
export function hushChatter(on: boolean) { hushed = on; if (on && talking) { queue = []; if (!vitaActive) synth?.cancel(); finish() } }

/* ---------- VITA ---------- */

/*
 * VITA, the mission guide, speaks here in her own voice: natural pitch, no radio squelch, the clearest voice the
 * device has (Samantha or Google US English first). One line at a time: a new line cuts the old one off. The text
 * is split into sentences, because Chrome stops a single long utterance after about fifteen seconds.
 */

/** Say it the way a person would read it out: the same table as the landing page's voice (landing/briefing/voice.js). */
const SAY: [RegExp, string][] = [
  [/AstroDocX/g, 'Astro Doc X'], [/\bVITA\b/g, 'Veeta'], [/CO₂|CO2/gi, 'C O 2'], [/SpO₂/g, 'S P O 2'],
  [/NASA-STD-3001/g, 'NASA standard thirty oh one'], [/STD-3001/g, 'standard thirty oh one'],
  [/\b1\s*mmHg/g, '1 millimetre of mercury'], [/(\d+(?:\.\d+)?)\s*mmHg/g, '$1 millimetres of mercury'], [/(\d+(?:\.\d+)?)\s*mSv/g, '$1 millisieverts'],
  [/\b3D\b/g, 'three D'], [/\bEVA\b/g, 'E V A'], [/\bISS\b/g, 'I S S'], [/\bHRP\b/g, 'H R P'], [/\bOSDR\b/g, 'O S D R'], [/\bECG\b/g, 'E C G'],
  // the crew doctor's numbers
  [/(\d)σ/g, '$1 sigma'], [/\bsd (\d)/g, 'standard deviation $1'], [/(\d)\s*ms\b/g, '$1 milliseconds'], [/(\d)\s*bpm\b/g, '$1 beats per minute'],
  [/(\d)\s*h\b/g, '$1 hours'], [/(\d)\s*min\b/g, '$1 minutes'], [/\bD(\d+) (\d\d):(\d\d) MET\b/g, 'mission day $1, $2 $3'], [/\bHRV\b/g, 'H R V'],
  [/\bACT\b/g, 'act'], [/\bWATCH\b/g, 'watch'], [/\bSBAR\b/g, 'S BAR'],
  [/\s*·\s*/g, ', '], [/…/g, '.'], [/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, ''],
]
export const speakable = (text: string) => SAY.reduce((s, [re, to]) => s.replace(re, to), String(text ?? '')).replace(/\s+/g, ' ').trim()

/** Is VITA saying something right now (the dock animates her while this is true). */
export const useVitaVoice = create<{ speaking: boolean; /** The sentence she is saying (the cabin's subtitle). */ line: string }>(() => ({ speaking: false, line: '' }))

const vitaScore = (v: SpeechSynthesisVoice) =>
  (/premium|enhanced|natural|neural/i.test(v.name) ? 8 : 0) + (/samantha|google us english/i.test(v.name) ? 6 : /ava|allison|serena|karen|moira|tessa|daniel|google/i.test(v.name) ? 3 : 0) +
  (v.lang === 'en-US' ? 3 : v.lang === 'en-GB' ? 2 : 0) + (v.localService ? 1 : 0)
let vitaVoice: SpeechSynthesisVoice | null = null
function pickVita() { vitaVoice = (synth?.getVoices() ?? []).filter((v) => /^en/i.test(v.lang)).sort((a, b) => vitaScore(b) - vitaScore(a))[0] ?? null }
if (synth) { pickVita(); synth.addEventListener?.('voiceschanged', pickVita) }

let vitaActive = false
let vitaPaused = false
let vitaEnd: (() => void) | null = null

/**
 * Can VITA be heard? Sound is on, this is the top window, there is a speech engine, and the visitor has touched the page
 * (browsers refuse speech before that: after the landing page opens the console, the first click unlocks it).
 */
export function vitaCanSpeak() {
  if (framed || !synth || typeof SpeechSynthesisUtterance === 'undefined' || !useSound.getState().on) return false
  const ua = typeof navigator !== 'undefined' ? navigator.userActivation : undefined
  return ua ? ua.hasBeenActive : true
}

/** Call from a click: Safari only starts speech from a gesture, so prime it with a silent utterance. */
export function vitaPrime() {
  if (framed || !synth || typeof SpeechSynthesisUtterance === 'undefined') return
  const u = new SpeechSynthesisUtterance(' ')
  u.volume = 0
  synth.speak(u)
}

/**
 * VITA says `text`. Interrupts the radio chatter and any line of hers still running. Resolves when the line has been
 * said, was cut off (vitaStop, a newer line, Sound off) or cannot be spoken at all (sound off, no voice, no gesture yet),
 * so a caller can always wait on it.
 */
export function vitaSay(text: string): Promise<void> {
  vitaStop()
  const line = speakable(text)
  if (!line || !vitaCanSpeak()) return Promise.resolve()
  // split at sentence ends only: a full stop inside 4.70 is not one
  const split = (x: string) => x.match(/.+?(?:[.!?;:]+(?=\s|$)|$)\s*/g)?.filter((p) => p.trim()) ?? [x]
  const parts = split(line)
  // the subtitle shows her words as written ("VITA", "CO₂"), not as spelled out for the voice
  const written = split(String(text ?? '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim())
  const shown = (i: number) => (written.length === parts.length ? written[i] : parts[i]).trim()
  queue = []; synth!.cancel(); finish()
  vitaPaused = false
  return new Promise<void>((resolve) => {
    let left = parts.length, settled = false, guard = 0
    const end = () => {
      if (settled) return
      settled = true; window.clearTimeout(guard)
      if (vitaEnd === end) { vitaEnd = null; vitaActive = false; useVitaVoice.setState({ speaking: false, line: '' }); duckMusic(false) }
      resolve()
    }
    vitaEnd = end
    vitaActive = true
    useVitaVoice.setState({ speaking: true, line: shown(0) })
    duckMusic(true)
    // engines that never fire onend must not hold a caller forever; a pause holds the clock too
    const budget = 4000 + line.length * 120
    let spent = 0, at = performance.now()
    const watch = () => {
      const now = performance.now()
      if (!vitaPaused) spent += now - at
      at = now
      if (spent >= budget) end(); else guard = window.setTimeout(watch, 500)
    }
    guard = window.setTimeout(watch, 500)
    synth!.resume() // clears a pause left by an earlier line
    parts.forEach((p, i) => {
      const u = new SpeechSynthesisUtterance(p.trim())
      u.pitch = 1.0; u.rate = 0.94; u.volume = 1; u.lang = 'en-US'
      if (vitaVoice) { u.voice = vitaVoice; u.lang = vitaVoice.lang }
      u.onstart = () => { if (vitaEnd === end) { useVitaVoice.setState({ line: shown(i) }); const ws = scriptOf(u.text, u.rate); lineListeners.forEach((f) => f(ws)) } }
      u.onboundary = (e) => { if (e.name === 'word' && vitaEnd === end) { const w = wordAt(u.text, e.charIndex, u.rate); wordListeners.forEach((f) => f(w)) } }
      u.onend = () => { if (--left <= 0) end() }
      u.onerror = end // cut off, or not allowed yet
      synth!.speak(u)
    })
  })
}

/** A word VITA is starting to say: the word as spoken, how much it deserves a nod (0 to 1: a plain word, a comma, a long
    word, the end of a sentence), about how long it lasts at her speaking rate, where it starts in its sentence and the
    pause she takes after it (a comma, a full stop). */
export interface VitaWord { word: string; power: number; ms: number; at: number; gap: number }
/**
 * Word timing for the 3D doctor's lips and body language. `onVitaLine` runs as each sentence of VITA's line begins, with
 * its words and their estimated timing: the doctor keeps time from that on her own, so every voice gets lip sync.
 * `onVitaWord` runs as each word begins, for engines that report word boundaries: it puts her back on the real word.
 * Both return the unsubscribe.
 */
const wordListeners = new Set<(w: VitaWord) => void>()
const lineListeners = new Set<(words: VitaWord[]) => void>()
export function onVitaWord(f: (w: VitaWord) => void) { wordListeners.add(f); return () => { wordListeners.delete(f) } }
export function onVitaLine(f: (words: VitaWord[]) => void) { lineListeners.add(f); return () => { lineListeners.delete(f) } }
/** The word that starts at `at` in `text`, with its weight and length. */
export function wordAt(text: string, at: number, rate = 0.94): VitaWord {
  const word = /^\S+/.exec(text.slice(at))?.[0] ?? ''
  const letters = word.replace(/[^\p{L}\p{N}]/gu, '').length
  const item = /^\d+[.)]$/.test(word)   // "1." in a list is not the end of a sentence
  const power = item ? 0.25 : /[.!?;:]$/.test(word) ? 1 : letters >= 8 ? 0.85 : /,$/.test(word) || letters >= 6 ? 0.55 : 0.25
  const gap = item ? 120 : /[.!?]$/.test(word) ? 380 : /[;:]$/.test(word) ? 260 : /,$/.test(word) ? 150 : 0
  return { word, power, ms: Math.round(Math.min(800, Math.max(140, (letters * 68) / rate))), at, gap: Math.round(gap / rate) }
}
/** Every word of a sentence with its timing, in order. */
export function scriptOf(text: string, rate = 0.94): VitaWord[] {
  return [...text.matchAll(/\S+/g)].map((m) => wordAt(text, m.index ?? 0, rate))
}

/** Cut VITA off mid-line (a no-op when she is quiet). The promise of the line she was saying resolves. */
export function vitaStop() {
  const end = vitaEnd
  if (!end) return
  vitaPaused = false
  synth?.cancel()
  end()
}
export function vitaPause() { if (vitaEnd) { vitaPaused = true; synth?.pause() } }
export function vitaResume() { if (vitaPaused) { vitaPaused = false; synth?.resume() } }

useSound.subscribe((s) => { if (!s.on) { queue = []; vitaStop(); synth?.cancel(); finish() } })
