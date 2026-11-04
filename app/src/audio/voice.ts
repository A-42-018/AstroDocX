import { duckMusic } from './music'
import { audible, computerBeeps, radioClose, radioOpen, useSound } from './sfx'

/*
 * The cabin's voices, from the browser's own speech synthesis (no audio files). Crew talk over a radio: a squelch
 * click from where the speaker floats before and after each line. The two TARS robots answer in flat low voices,
 * and consoles chirp around the room between calls. The score ducks while anyone speaks. Voices depend on what
 * the device has installed; with none, the beeps and clicks still play.
 */

type Who = 'Ground' | 'Ship Computer' | 'Commander' | 'Pilot' | 'Flight Engineer' | 'Medical Officer' | 'Mission Specialist' | 'Payload Specialist' | 'TARS One' | 'TARS Two'
interface Tone { pitch: number; rate: number; at: [number, number, number] }
// pitch stays near 1 for the crew and not too low for the robots: extreme pitch is what makes speech mushy
const TONE: Record<Who, Tone> = {
  Ground: { pitch: 0.95, rate: 0.95, at: [0, 0.6, -3.5] }, 'Ship Computer': { pitch: 1.0, rate: 0.92, at: [0, 0, -1] },
  Commander: { pitch: 0.85, rate: 0.92, at: [-1.5, 0.3, -3] }, Pilot: { pitch: 1.0, rate: 0.96, at: [1.5, 0.3, -3] },
  'Flight Engineer': { pitch: 0.95, rate: 0.95, at: [-3, 0, -1] }, 'Medical Officer': { pitch: 1.1, rate: 0.93, at: [3, 0, -1] },
  'Mission Specialist': { pitch: 1.05, rate: 0.95, at: [-2.5, 0.5, 2] }, 'Payload Specialist': { pitch: 0.9, rate: 0.95, at: [2.5, 0.5, 2] },
  'TARS One': { pitch: 0.55, rate: 0.85, at: [-2, -0.5, -2] }, 'TARS Two': { pitch: 0.7, rate: 0.88, at: [2, -0.5, -2] },
}
const ORDER = Object.keys(TONE) as Who[]
const isBot = (w: Who) => w.startsWith('TARS') || w === 'Ship Computer'

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

let queue: [Who, string][] = []
let talking = false
const framed = typeof window !== 'undefined' && window.self !== window.top

function finish() { talking = false; duckMusic(false) }

function next() {
  const item = queue.shift()
  if (!item || !synth || !audible()) return finish()
  const [who, text] = item
  const t = TONE[who]
  const u = new SpeechSynthesisUtterance(text)
  u.pitch = t.pitch; u.rate = t.rate; u.volume = 1; u.lang = 'en-US'
  const v = voiceFor.get(who)
  if (v) { u.voice = v; u.lang = v.lang }
  const done = () => { if (!isBot(who)) radioClose(t.at); window.setTimeout(next, 450 + Math.random() * 300) }
  u.onend = done; u.onerror = done
  talking = true
  duckMusic(true)
  if (!isBot(who)) radioOpen(t.at)
  // a beat after the click, so the first word is not clipped
  window.setTimeout(() => (audible() ? synth.speak(u) : done()), isBot(who) ? 120 : 380)
}

/** Say lines in turn; `interrupt` drops whatever is queued or being said (used when the crew click someone). */
function say(lines: [Who, string][], interrupt = false) {
  if (framed || !synth || !audible()) return
  if (interrupt) { queue = []; synth.cancel(); finish() }
  queue.push(...lines)
  if (!talking) next()
}

/** A crew member introduces themselves when clicked. */
export function introduce(role: string) {
  const who = (role in TONE ? role : 'Commander') as Who
  say([[who, `Hey! Welcome, I am the ${role}!`], [who, role === 'Medical Officer' ? 'I look after the crew’s health.' : 'Glad to have you aboard.']], true)
}

// Short, plain sentences with commas where a person would pause; numbers in words; no abbreviations.
const CABIN: [Who, string][][] = [
  [['Commander', 'Pilot, this is Commander. Report your heading.'], ['Pilot', 'Commander, heading is steady. Orbit is normal.'], ['Commander', 'Copy. Thank you.']],
  [['Flight Engineer', 'Medical, I am checking the air scrubbers now.'], ['Medical Officer', 'Flight, the air quality looks good from here.'], ['Flight Engineer', 'Confirmed. All green.']],
  [['Medical Officer', 'Specialist, how did you sleep?'], ['Mission Specialist', 'Better this week. Seven hours last night.'], ['Medical Officer', 'Good. Please log it in your check in.']],
  [['TARS One', 'Cabin pressure is stable.'], ['TARS Two', 'Confirmed. Oxygen is normal.'], ['TARS One', 'All systems are nominal.'], ['TARS Two', 'Agreed.']],
  [['Payload Specialist', 'Commander, the payload bay is secure. Experiment four is running.'], ['Commander', 'Copy, Payload. Keep me posted.']],
  [['Pilot', 'Flight, the ground link opens in forty minutes.'], ['Flight Engineer', 'Understood. I will send the sync before then.'], ['Pilot', 'Thank you.']],
  [['Commander', 'TARS, what is the module status?'], ['TARS One', 'All systems are nominal, Commander.'], ['Commander', 'Good work.']],
  [['TARS Two', 'Pilot, your heart rate is slightly high.'], ['Pilot', 'It is just the coffee, TARS.'], ['TARS Two', 'There is no coffee on board.'], ['Pilot', 'Exactly.']],
  [['Mission Specialist', 'Commander, Earth looks beautiful from the window today.'], ['Commander', 'It never gets old.']],
  [['Flight Engineer', 'Solar power is within range.'], ['TARS One', 'I agree. The power margin is twelve percent.']],
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
  if (document.hidden || talking || !audible()) return
  if (Math.random() < 0.4) { computerBeeps(); return }
  const set = kind === 'cabin' ? CABIN : CONSOLE
  let i = Math.floor(Math.random() * set.length)
  if (i === last) i = (i + 1) % set.length
  last = i
  say(set[i])
}

/** Start the background life of the ship: console beeps around the room and radio chatter every few seconds. */
export function startChatter(where: 'cabin' | 'console' = 'cabin') { kind = where; last = -1; if (!timer && !framed) timer = window.setTimeout(tick, 4000) }
/** The ship's computer speaks (alerts, confirmations), without a radio click. */
export const announce = (text: string) => say([['Ship Computer', text]])
export function stopChatter() { window.clearTimeout(timer); timer = 0; queue = []; synth?.cancel(); finish() }

useSound.subscribe((s) => { if (!s.on) { queue = []; synth?.cancel(); finish() } })
