import { create } from 'zustand'

/*
 * Sound for the console and the 3D cabin, synthesised with Web Audio: no audio files to download or precache.
 * The context starts on the first tap or key press (browsers block sound before one); anything asked for before
 * that is dropped, except the cabin hum, which starts with the gesture. Muting is remembered per browser.
 */

const KEY = 'adx-sound'
const stored = () => { try { return localStorage.getItem(KEY) !== 'off' } catch { return true } }

interface SoundState { on: boolean; toggle: () => void }
export const useSound = create<SoundState>((set, get) => ({
  on: stored(),
  toggle: () => {
    const on = !get().on
    try { localStorage.setItem(KEY, on ? 'on' : 'off') } catch { /* private mode: it lasts for this visit */ }
    set({ on })
    if (on) blip(880, 0.06, 0.08)
  },
}))

const MASTER = 1
/** Effects are written at modest levels; this brings them up so they sit clearly over the music and speech. */
const LOUD = 2.6
let ctx: AudioContext | null = null
let master: GainNode | null = null
let noiseBuf: AudioBuffer | null = null

function boot(): AudioContext | null {
  if (ctx) return ctx
  const AC = typeof window !== 'undefined' ? (window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext) : undefined
  if (!AC) return null
  try { ctx = new AC() } catch { return null }
  master = ctx.createGain()
  master.gain.value = useSound.getState().on ? MASTER : 0
  master.connect(ctx.destination)
  // two seconds of white noise, looped and filtered for air, whooshes and hiss
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate)
  const d = noiseBuf.getChannelData(0)
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
  return ctx
}

/** The context, running, or null before the first gesture, when muted or without Web Audio. */
// the cabin's wall screens are the console in frames: they stay silent, the cabin speaks for them
const framed = typeof window !== 'undefined' && window.self !== window.top
function live(): AudioContext | null {
  if (framed || !ctx || !useSound.getState().on || ctx.state !== 'running') return null
  return ctx
}

if (typeof window !== 'undefined') {
  const unlock = () => {
    const c = boot()
    if (!c) return
    void c.resume().then(() => { if (c.state === 'running') { window.removeEventListener('pointerdown', unlock); window.removeEventListener('keydown', unlock); if (wantHum) startHum() } })
  }
  window.addEventListener('pointerdown', unlock)
  window.addEventListener('keydown', unlock)
  // a hidden tab goes quiet, and frees the audio thread
  document.addEventListener('visibilitychange', () => { if (!ctx) return; if (document.hidden) void ctx.suspend(); else void ctx.resume() })
  useSound.subscribe((s) => { if (ctx && master) master.gain.setTargetAtTime(s.on ? MASTER : 0, ctx.currentTime, 0.05) })
}

/* ---------- building blocks ---------- */

/*
 * Spatial sound: effects can be placed in the cabin (x right, y up, z back, in metres from the listener) and are
 * rendered with the browser's HRTF 3D panner, so consoles chirp from beside you and radio calls come from where
 * the speaker floats. This is positional 3D audio over any headphones or speakers; it is not Dolby Atmos, a
 * licensed format the browser cannot produce. Speech itself cannot be routed through it, so voices stay centred.
 */
let dest: AudioNode | null = null
export function placed(x: number, y: number, z: number, play: () => void) {
  const c = live()
  if (!c || !master) return
  const pan = c.createPanner()
  pan.panningModel = 'HRTF'; pan.distanceModel = 'inverse'; pan.refDistance = 1.5; pan.rolloffFactor = 0.7
  pan.positionX.value = x; pan.positionY.value = y; pan.positionZ.value = z
  pan.connect(master)
  dest = pan
  try { play() } finally { dest = null }
  window.setTimeout(() => pan.disconnect(), 4000)
}
/** A random spot around the listener, at console height or above. */
export const around = (min = 1.5, max = 4.5): [number, number, number] => {
  const a = Math.random() * Math.PI * 2, d = min + Math.random() * (max - min)
  return [Math.sin(a) * d, -0.4 + Math.random() * 1.6, -Math.cos(a) * d]
}

function env(c: AudioContext, peak: number, attack: number, decay: number, at = c.currentTime) {
  const g = c.createGain()
  g.gain.setValueAtTime(0.0001, at)
  g.gain.exponentialRampToValueAtTime(peak, at + attack)
  g.gain.exponentialRampToValueAtTime(0.0001, at + attack + decay)
  g.connect(dest ?? master!)
  return g
}

/** A short sine (or other) tone. */
function blip(freq: number, dur: number, vol = 0.12, type: OscillatorType = 'sine', delay = 0, glide?: number) {
  const c = live()
  if (!c) return
  const at = c.currentTime + delay
  const o = c.createOscillator()
  o.type = type
  o.frequency.setValueAtTime(freq, at)
  if (glide) o.frequency.exponentialRampToValueAtTime(glide, at + dur)
  o.connect(env(c, Math.min(1, vol * LOUD), 0.005, dur, at))
  o.start(at)
  o.stop(at + dur + 0.05)
}

/** Filtered noise: a whoosh when the band sweeps, a hiss when it stays high. */
function noise(dur: number, vol: number, from: number, to: number, q = 1, delay = 0, attack = dur * 0.35) {
  const c = live()
  if (!c || !noiseBuf) return
  const at = c.currentTime + delay
  const src = c.createBufferSource()
  src.buffer = noiseBuf
  src.loop = true
  const f = c.createBiquadFilter()
  f.type = 'bandpass'
  f.Q.value = q
  f.frequency.setValueAtTime(from, at)
  f.frequency.exponentialRampToValueAtTime(to, at + dur)
  src.connect(f).connect(env(c, Math.min(1, vol * LOUD), attack, dur - attack, at))
  src.start(at, Math.random() * 1.5)
  src.stop(at + dur + 0.05)
}

/* ---------- the console ---------- */

/** True when sound is on and the browser has allowed it (after the first gesture). */
export const audible = () => !!live()

/** The radio: a click and a burst of static as a transmission opens and closes. */
export const radioOpen = (at?: [number, number, number]) => { const f = () => { blip(1900, 0.025, 0.07, 'square'); noise(0.22, 0.07, 2500, 4500, 0.6, 0, 0.02) }; if (at) placed(...at, f); else f() }
export const radioClose = (at?: [number, number, number]) => { const f = () => { noise(0.18, 0.06, 3500, 2000, 0.6, 0, 0.01); blip(1300, 0.03, 0.06, 'square', 0.16) }; if (at) placed(...at, f); else f() }
/** Computer chatter: a few quick chirps in a random pattern, as consoles talk to each other. */
export const computerBeeps = () => {
  placed(...around(), computerBeepsNow)
}
const computerBeepsNow = () => {
  const n = 2 + Math.floor(Math.random() * 4)
  const base = 900 + Math.random() * 900
  for (let i = 0; i < n; i++) blip(base * (Math.random() < 0.5 ? 1 : 1.5), 0.05 + Math.random() * 0.05, 0.07, Math.random() < 0.5 ? 'square' : 'triangle', i * (0.07 + Math.random() * 0.06))
}

/** Small interface sounds for the console: a soft tick under the pointer, a firmer click on press, a monitor beep per heartbeat. */
let lastHover = 0
export const uiHover = () => { const n = performance.now(); if (n - lastHover < 90) return; lastHover = n; blip(2400, 0.02, 0.025, 'sine') }
export const uiClick = () => { blip(1500, 0.04, 0.07, 'triangle'); blip(900, 0.05, 0.05, 'sine', 0.025) }
let lastBeat = 0
export const monitorBeep = () => { const n = performance.now(); if (n - lastBeat < 350) return; lastBeat = n; blip(1000, 0.09, 0.045, 'sine') }

/** Moving to another screen. */
export const navTick = () => { blip(1320, 0.035, 0.05, 'triangle') }
/** A new alert opened: two rising tones for Watch, three more insistent ones for Act. */
export const alertChime = (act: boolean) => {
  if (act) { blip(587, 0.16, 0.11, 'triangle'); blip(587, 0.16, 0.11, 'triangle', 0.2); blip(880, 0.3, 0.12, 'triangle', 0.4) }
  else { blip(660, 0.14, 0.09, 'sine'); blip(990, 0.26, 0.09, 'sine', 0.15) }
}
/** Saved, done: a short major arpeggio. */
export const confirmChime = () => { [523, 659, 784].forEach((f, i) => blip(f, 0.22, 0.08, 'sine', i * 0.08)) }
/** The demo run starting: a rising sweep. */
export const demoStart = () => { blip(220, 0.45, 0.06, 'sawtooth', 0, 880); noise(0.5, 0.05, 400, 3000, 0.8) }
/** Reaction test: the lamp turns green, a tap counts, a tap was too early. */
export const lampGo = () => { blip(1046, 0.12, 0.12, 'square') }
export const tapTick = () => { blip(1600, 0.03, 0.06, 'triangle') }
export const tapEarly = () => { blip(160, 0.2, 0.1, 'sawtooth', 0, 110) }

/* ---------- the cabin ---------- */

/** Floating to another tour stop; a jump past several stops is one whoosh, not one per stop. */
let lastWhoosh = 0
export const whoosh = () => {
  const now = performance.now()
  if (now - lastWhoosh < 600) return
  lastWhoosh = now
  placed((Math.random() < 0.5 ? -1 : 1) * 2.5, 0, 0.5, () => noise(0.7, 0.08, 300, 1400, 1.2))
}
/** Picking a crew member or a panel. */
export const select = () => { blip(1180, 0.05, 0.07, 'sine'); blip(1770, 0.08, 0.05, 'sine', 0.05) }
/** The visor lifting away from the helmet stop: a short release of air. */
export const visorOpen = () => { noise(0.35, 0.04, 2500, 5000, 0.7, 0, 0.03) }
/** The visor closing: a seal clunk, a hiss of air, then the HUD booting with rising chirps. */
export const visorSeal = () => {
  blip(90, 0.18, 0.18, 'sine', 0, 50)
  noise(0.9, 0.06, 5000, 2500, 0.7, 0.05, 0.05)
}
export const hudBoot = () => { [700, 940, 1250, 1680].forEach((f, i) => blip(f, 0.06, 0.05, 'square', i * 0.07)); blip(2100, 0.2, 0.04, 'sine', 0.32) }
/** The arrival: a deep swell of the flight in, the glare, and the cabin pressurising. */
export const flyRumble = () => { blip(48, 4.2, 0.16, 'sine', 0, 70); noise(4.4, 0.05, 120, 600, 0.6, 0, 3) }
export const glare = () => { blip(220, 0.9, 0.06, 'sawtooth', 0, 1760); noise(0.8, 0.07, 1500, 6000, 0.5, 0, 0.6) }
export const pressurise = () => { noise(1.4, 0.07, 3000, 900, 0.6, 0, 0.08) }

/*
 * The cabin hum: life support. Two detuned low tones and filtered air noise through one lowpass, which closes
 * outside the station (no air, so only what carries through the suit).
 */
let wantHum = false
let hum: { stop: () => void; filter: BiquadFilterNode; gain: GainNode } | null = null

function startHum() {
  const c = ctx
  if (framed || !c || !master || !noiseBuf || hum) return
  const filter = c.createBiquadFilter()
  filter.type = 'lowpass'
  filter.frequency.value = 900
  const gain = c.createGain()
  gain.gain.setValueAtTime(0.0001, c.currentTime)
  gain.gain.exponentialRampToValueAtTime(1, c.currentTime + 2.5)
  filter.connect(gain).connect(master)
  const tone = (f: number, v: number) => {
    const o = c.createOscillator(), g = c.createGain()
    o.frequency.value = f; g.gain.value = v
    o.connect(g).connect(filter); o.start()
    return o
  }
  const a = tone(55, 0.09), b = tone(55.4, 0.07), h = tone(110.2, 0.02)
  const air = c.createBufferSource(), airF = c.createBiquadFilter(), airG = c.createGain()
  air.buffer = noiseBuf; air.loop = true
  airF.type = 'bandpass'; airF.frequency.value = 420; airF.Q.value = 0.5
  airG.gain.value = 0.07
  air.connect(airF).connect(airG).connect(filter); air.start()
  // a slow swell in the air, like the fans cycling
  const lfo = c.createOscillator(), lfoG = c.createGain()
  lfo.frequency.value = 0.07; lfoG.gain.value = 0.012
  lfo.connect(lfoG).connect(airG.gain); lfo.start()
  hum = {
    filter, gain,
    stop: () => {
      const t = c.currentTime
      gain.gain.cancelScheduledValues(t); gain.gain.setTargetAtTime(0.0001, t, 0.3)
      for (const n of [a, b, h, air, lfo]) n.stop(t + 1.5)
    },
  }
}

/** Start or stop the cabin hum (it waits for the first gesture if there has not been one). */
export function cabinHum(on: boolean) {
  wantHum = on
  if (on) { if (ctx?.state === 'running') startHum() }
  else if (hum) { hum.stop(); hum = null }
}
/** Muffle the hum outside the station (0 = inside, 1 = out on EVA). */
export function humOutside(k: number) {
  if (!hum || !ctx) return
  hum.filter.frequency.setTargetAtTime(900 - 760 * k, ctx.currentTime, 0.4)
}
