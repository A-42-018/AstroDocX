import { create } from 'zustand'
import { audible, bell, bindOn, framed, hz, live, noise, organ, parts, pad, rhodes, setMaster, thump, tone, whenRunning, withBus } from './engine'

export { audible }

/*
 * Sound for the console and the 3D cabin, synthesised with Web Audio: no audio files to download or precache.
 * One identity, "glass and air": FM glass bells and a little room for the interface, success and alerts, filtered air
 * for motion (whooshes, hiss, thrusters), and the low organ for ambience. The numbers come from the audio-palette
 * preview (docs/design-refs/audio-palette). The engine (engine.ts) starts the context on the first tap or key press
 * (browsers block sound before one); anything asked for before that is dropped, except the cabin hum, which starts with
 * the gesture. Muting is remembered per browser.
 */

const KEY = 'adx-sound'
const stored = () => { try { return localStorage.getItem(KEY) !== 'off' } catch { return true } }

interface SoundState { on: boolean; toggle: () => void }
export const useSound = create<SoundState>((set, get) => ({
  on: stored(),
  toggle: () => {
    const on = !get().on
    // turning off: the "off" pair plays while sound is still on (the master fades a moment later)
    if (!on) toggleSound(false)
    try { localStorage.setItem(KEY, on ? 'on' : 'off') } catch { /* private mode: it lasts for this visit */ }
    set({ on })
    if (on) toggleSound(true)
  },
}))
bindOn(() => useSound.getState().on)
if (typeof window !== 'undefined') useSound.subscribe((s) => setMaster(s.on, 450))

/* ---------- spatial sound ---------- */

/*
 * Effects can be placed in the cabin (x right, y up, z back, in metres from the listener) and are rendered with the
 * browser's HRTF 3D panner, so consoles chirp from beside you and radio calls come from where the speaker floats.
 * This is positional 3D audio over any headphones or speakers; it is not Dolby Atmos, a licensed format the browser
 * cannot produce. Speech itself cannot be routed through it, so voices stay centred.
 */
export function placed(x: number, y: number, z: number, play: () => void) {
  const c = live(), p = parts()
  if (!c || !p) return
  const pan = c.createPanner()
  pan.panningModel = 'HRTF'; pan.distanceModel = 'inverse'; pan.refDistance = 1.5; pan.rolloffFactor = 0.7
  pan.positionX.value = x; pan.positionY.value = y; pan.positionZ.value = z
  pan.connect(p.sfx)
  withBus(pan, play, true)
  window.setTimeout(() => pan.disconnect(), 4000)
}
/** A random spot around the listener, at console height or above. */
export const around = (min = 1.5, max = 4.5): [number, number, number] => {
  const a = Math.random() * Math.PI * 2, d = min + Math.random() * (max - min)
  return [Math.sin(a) * d, -0.4 + Math.random() * 1.6, -Math.cos(a) * d]
}
const rnd = (a: number, b: number) => a + Math.random() * (b - a)
const pick = <T,>(a: readonly T[]): T => a[Math.floor(Math.random() * a.length)]

/**
 * Stingers are written at full scale: run `f` through a quiet bus so they sit under the voice (as the preview's quiet()).
 * Used by music.ts for the three stingers.
 */
export function quiet(f: () => void, k = 0.4) {
  const c = live(), p = parts()
  if (!c || !p) return
  const g = c.createGain()
  g.gain.value = k
  g.connect(p.sfx)
  withBus(g, f)
  window.setTimeout(() => g.disconnect(), 14000)
}

/* ---------- interface ---------- */

let lastHover = 0
/** A glass tick under the pointer. */
export const uiHover = () => { const n = performance.now(); if (n - lastHover < 90) return; lastHover = n; bell({ f: 3520, dur: 0.09, vol: 0.1, ratio: 2.76, idx: 1.2, rev: 0.15 }) }
/** A soft key: a dry tick over a low thock. */
export const uiClick = () => { noise({ dur: 0.03, vol: 0.14, f0: 3200, f1: 2000, q: 1.2, a: 0.002 }); thump({ f0: 420, f1: 220, dur: 0.08, vol: 0.28 }) }
/** Moving to another screen: an air sweep that lands on a glass note. */
export const navTick = () => { noise({ dur: 0.22, vol: 0.1, f0: 700, f1: 3600, q: 1.5, a: 0.08 }); bell({ f: 1760, dur: 0.25, vol: 0.07, at: 0.12, rev: 0.3 }) }
/** Picking a crew member or a panel: two soft glass notes. */
export const select = () => { bell({ f: 1180, dur: 0.16, vol: 0.12, ratio: 2, idx: 0.8, rev: 0.15 }); bell({ f: 1770, dur: 0.24, vol: 0.1, at: 0.05, ratio: 2, idx: 0.8, rev: 0.2 }) }
/** A switch going on (rising pair) or off (falling pair). */
export const toggleSound = (on: boolean) => {
  if (on) { tone({ f: 660, dur: 0.09, vol: 0.2, rev: 0.1 }); tone({ f: 990, dur: 0.14, vol: 0.2, at: 0.07, rev: 0.1 }) }
  else { tone({ f: 880, dur: 0.09, vol: 0.2, rev: 0.1 }); tone({ f: 587, dur: 0.14, vol: 0.2, at: 0.07, rev: 0.1 }) }
}
/** Not allowed: two soft low notes, no harshness. */
export const notAllowed = () => { tone({ f: 233, dur: 0.16, vol: 0.24, type: 'triangle', lp: 1200 }); tone({ f: 175, dur: 0.26, vol: 0.24, type: 'triangle', lp: 900, at: 0.13 }) }
/** Saved, done: a glass arpeggio with room. */
export const confirmChime = () => { [659, 784, 988, 1319].forEach((f, i) => bell({ f, dur: 0.9, vol: 0.15, ratio: 2, idx: 1.5, at: i * 0.09, rev: 0.5 })) }
/** Sleep logged: slow falling bells, a wind-down. */
export const sleepLogged = () => { [880, 659, 554, 440].forEach((f, i) => bell({ f, dur: 1.8, vol: 0.14, ratio: 2, idx: 1, at: i * 0.5, rev: 0.7 })) }
/** The demo run starting: a rising sweep. */
export const demoStart = () => { tone({ f: 220, to: 880, dur: 0.45, vol: 0.16, type: 'sawtooth' }); noise({ dur: 0.5, vol: 0.13, f0: 400, f1: 3000, q: 0.8, a: 0.18 }) }
/** Reaction test: the lamp turns green, a tap counts, a tap was too early. */
export const lampGo = () => { tone({ f: 1046, dur: 0.12, vol: 0.31, type: 'square' }) }
export const tapTick = () => { tone({ f: 1600, dur: 0.03, vol: 0.16, type: 'triangle' }) }
export const tapEarly = () => { tone({ f: 160, to: 110, dur: 0.2, vol: 0.26, type: 'sawtooth' }) }

/* ---------- alerts and health ---------- */

/** A new alert opened: two glass bells for Watch; for Act, three pulses with a sub thump, then a held note. */
export const alertChime = (act: boolean) => {
  if (act) {
    for (let i = 0; i < 3; i++) { tone({ f: 880, dur: 0.12, vol: 0.22, type: 'square', lp: 2400, at: i * 0.22 }); thump({ f0: 110, f1: 70, dur: 0.15, vol: 0.38, at: i * 0.22 }) }
    tone({ f: 1175, dur: 0.5, vol: 0.22, type: 'square', lp: 2200, at: 0.72, rev: 0.3 })
  } else {
    bell({ f: 659, dur: 1.4, vol: 0.2, ratio: 3, idx: 2, rev: 0.55 })
    bell({ f: 988, dur: 1.8, vol: 0.2, at: 0.22, ratio: 3, idx: 2, rev: 0.55 })
  }
}
/** Master alarm: a rising whoop three times. For a critical fault only. */
export const masterAlarm = () => { for (let i = 0; i < 3; i++) tone({ f: 520, to: 880, dur: 0.42, vol: 0.2, type: 'sawtooth', lp: 1800, at: i * 0.5 }) }
let lastBeat = 0
/** A monitor beep per heartbeat: an ECG tone with a second harmonic. */
export const monitorBeep = () => { const n = performance.now(); if (n - lastBeat < 350) return; lastBeat = n; tone({ f: 1000, dur: 0.1, vol: 0.15 }); tone({ f: 2000, dur: 0.06, vol: 0.04 }) }
/** A wearable dropped out: one steady tone. */
export const sensorLost = () => { tone({ f: 1000, dur: 0.1, hold: 1.2, vol: 0.1, a: 0.01 }) }

/* ---------- radio and comms ---------- */

/*
 * NASA's push-to-talk: a Quindar tone (2525 Hz) opens a transmission and another (2475 Hz) closes it, each about a
 * quarter of a second, steady. Between them a faint band-limited hiss sits under the voice. The hiss is its own
 * longer-running node, not spatial, so it can run as long as the line does.
 */
let hiss: { stop: (fade?: number) => void } | null = null
const stopHiss = (fade = 0.08) => { const h = hiss; hiss = null; h?.stop(fade) }
function startHiss() {
  const c = live(), p = parts()
  stopHiss(0.02)
  if (!c || !p) return
  const t = c.currentTime + 0.3
  const src = c.createBufferSource(), hp = c.createBiquadFilter(), lp = c.createBiquadFilter(), g = c.createGain()
  src.buffer = p.noise; src.loop = true
  hp.type = 'highpass'; hp.frequency.value = 380; lp.type = 'lowpass'; lp.frequency.value = 2900
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.05, t + 0.12)
  src.connect(hp); hp.connect(lp); lp.connect(g); g.connect(p.sfx)
  src.start(t, Math.random() * 1.5)
  let done = false
  const stop = (fade = 0.08) => {
    if (done) return
    done = true
    const now = c.currentTime
    g.gain.cancelScheduledValues(now); g.gain.setValueAtTime(Math.max(g.gain.value, 0.0001), now); g.gain.exponentialRampToValueAtTime(0.0001, now + fade)
    try { src.stop(now + fade + 0.05) } catch { /* already stopped */ }
    window.setTimeout(() => g.disconnect(), (fade + 0.2) * 1000)
  }
  hiss = { stop }
  // a line that is never closed (speech cut off, tab changes) must not hiss for ever
  window.setTimeout(() => { if (hiss?.stop === stop) stopHiss(0.3) }, 40000)
}
const quindar = (f: number) => tone({ f, dur: 0.03, hold: 0.22, vol: 0.2, a: 0.003 })
/** A transmission opens: Quindar tone in (2525 Hz), then the line's hiss. */
export const radioOpen = (at?: [number, number, number]) => { const f = () => quindar(2525); if (at) placed(...at, f); else f(); if (live()) startHiss() }
/** A transmission ends: the hiss drops away and the Quindar tone out (2475 Hz) closes it. */
export const radioClose = (at?: [number, number, number]) => { stopHiss(); const f = () => quindar(2475); if (at) placed(...at, f); else f() }
/** An incoming call: three soft bells over hiss. */
export const incomingCall = () => { [784, 988, 1175].forEach((f, i) => bell({ f, dur: 0.9, vol: 0.14, ratio: 2, idx: 1, at: i * 0.16, rev: 0.5 })); noise({ dur: 0.7, vol: 0.04, f0: 3500, q: 0.4, a: 0.05 }) }
/** Data link up: fast chirps. */
export const linkAcquired = () => { [1200, 1800, 1500, 2200, 1700, 2600, 2000, 3000].forEach((f, i) => tone({ f, dur: 0.04, vol: 0.09, type: 'square', lp: 5000, at: i * 0.05 })) }
/** Console chatter: pentatonic pings, each from its own spot around the room. */
export const computerBeeps = () => {
  const n = 5 + Math.floor(Math.random() * 3)
  for (let i = 0; i < n; i++) {
    const at = around(), f = pick([880, 988, 1175, 1319, 1568]), delay = i * 0.075
    placed(...at, () => bell({ f, dur: 0.25, vol: 0.09, ratio: 2, idx: 0.8, at: delay, rev: 0.25 }))
  }
}

/* ---------- scan and hologram ---------- */

/** A scan sweep: rising, finishing on a bell. */
export const scanSweep = () => {
  tone({ f: 300, to: 1800, dur: 1.5, vol: 0.14, a: 0.3, rev: 0.4 }); tone({ f: 600, to: 3600, dur: 1.5, vol: 0.05, type: 'triangle', a: 0.3 })
  noise({ dur: 1.8, vol: 0.06, f0: 800, f1: 5000, q: 2, a: 0.5 }); bell({ f: 1568, dur: 1.5, vol: 0.18, at: 1.85, rev: 0.6 })
}
/** Face lock: a sonar ping, then two ticks. */
export const faceLock = () => { bell({ f: 1200, dur: 2, vol: 0.2, ratio: 1.5, idx: 0.5, rev: 0.7 }); tone({ f: 1760, dur: 0.04, vol: 0.14, type: 'triangle', at: 0.55 }); tone({ f: 1760, dur: 0.04, vol: 0.14, type: 'triangle', at: 0.67 }) }
/** A hologram coming on: a shimmering swell and a bell. */
export const hologramOn = () => { tone({ f: 200, to: 800, dur: 0.8, vol: 0.1, type: 'sawtooth', lp: 1500, a: 0.4, rev: 0.4 }); bell({ f: 1568, dur: 1.2, vol: 0.14, at: 0.6, rev: 0.6 }); noise({ dur: 1, vol: 0.05, f0: 3000, f1: 7000, q: 2, a: 0.5 }) }

/* ---------- the cabin ---------- */

/** Floating to another tour stop; a jump past several stops is one whoosh, not one per stop. */
let lastWhoosh = 0
export const whoosh = () => {
  const now = performance.now()
  if (now - lastWhoosh < 600) return
  lastWhoosh = now
  placed((Math.random() < 0.5 ? -1 : 1) * 2.5, 0, 0.5, () => noise({ dur: 0.7, vol: 0.2, f0: 300, f1: 1400, q: 1.2 }))
}
/** The visor lifting away from the helmet stop: a short release of air. */
export const visorOpen = () => { noise({ dur: 0.35, vol: 0.1, f0: 2500, f1: 5000, q: 0.7, a: 0.03 }) }
/** The visor closing: a seal clunk and a hiss of air, then the HUD booting with rising chirps. */
export const visorSeal = () => { thump({ f0: 90, f1: 50, dur: 0.18, vol: 0.45 }); noise({ dur: 0.9, vol: 0.16, f0: 5000, f1: 2500, q: 0.7, a: 0.05, at: 0.05 }) }
export const hudBoot = () => { [700, 940, 1250, 1680].forEach((f, i) => tone({ f, dur: 0.06, vol: 0.13, type: 'square', at: i * 0.07 })); tone({ f: 2100, dur: 0.2, vol: 0.1, at: 0.32 }) }
/** The arrival: a deep swell of the flight in, the glare, and the cabin pressurising. */
export const flyRumble = () => { tone({ f: 48, to: 70, dur: 4.2, vol: 0.4, a: 0.5 }); noise({ dur: 4.4, vol: 0.13, f0: 120, f1: 600, q: 0.6, a: 3 }) }
export const glare = () => { tone({ f: 220, to: 1760, dur: 0.9, vol: 0.16, type: 'sawtooth' }); noise({ dur: 0.8, vol: 0.18, f0: 1500, f1: 6000, q: 0.5, a: 0.6 }) }
export const pressurise = () => { noise({ dur: 1.4, vol: 0.18, f0: 3000, f1: 900, q: 0.6, a: 0.08 }) }
/** An airlock cycle: hiss, motor, clunk, hiss. */
export const airlock = () => {
  noise({ dur: 1.2, vol: 0.14, f0: 4000, f1: 1800, q: 0.6, a: 0.1 }); tone({ f: 120, to: 240, dur: 0.7, vol: 0.14, type: 'sawtooth', lp: 500, at: 0.1, a: 0.05 })
  thump({ f0: 70, f1: 45, dur: 0.25, vol: 0.5, at: 1.1 }); noise({ dur: 1.3, vol: 0.1, f0: 3200, f1: 1500, q: 0.6, a: 0.1, at: 1.4 })
}
/** Thruster puffs (RCS): a short hard hiss from one side, then the other. */
export const thrusterPuff = () => {
  noise({ dur: 0.35, vol: 0.24, f0: 2500, f1: 1200, q: 0.4, a: 0.01, pan: -0.6 }); thump({ f0: 90, f1: 60, dur: 0.2, vol: 0.25, pan: -0.6 })
  noise({ dur: 0.28, vol: 0.18, f0: 2800, f1: 1400, q: 0.4, a: 0.01, at: 0.5, pan: 0.7 })
}
/** Docking clank: a metal ring and a low thud. */
export const dockingClank = () => {
  bell({ f: 220, dur: 1.3, vol: 0.22, ratio: 5.4, idx: 6, rev: 0.3 }); bell({ f: 330, dur: 0.9, vol: 0.14, ratio: 4.1, idx: 4, at: 0.02 })
  thump({ f0: 60, f1: 40, dur: 0.3, vol: 0.6 }); noise({ dur: 0.1, vol: 0.12, f0: 2000, f1: 900, q: 1, a: 0.002 })
}
/** Three boot steps on a metal hull, muffled. */
export const evaSteps = () => { [0, 0.55, 1.1].forEach((a) => { bell({ f: 900, dur: 0.14, vol: 0.1, ratio: 6.7, idx: 4, at: a, pan: a ? 0.3 : -0.3 }); thump({ f0: 140, f1: 90, dur: 0.06, vol: 0.25, at: a }) }) }

/*
 * The cabin hum: life support. Two detuned low tones and filtered air noise through one lowpass, which closes
 * outside the station (no air, so only what carries through the suit).
 */
let wantHum = false
let hum: { stop: () => void; filter: BiquadFilterNode; gain: GainNode } | null = null

function startHum() {
  const p = parts()
  if (framed || !p || hum) return
  const { c, master, noise: nb } = p
  const filter = c.createBiquadFilter()
  filter.type = 'lowpass'
  filter.frequency.value = 900
  const gain = c.createGain()
  gain.gain.setValueAtTime(0.0001, c.currentTime)
  gain.gain.exponentialRampToValueAtTime(1, c.currentTime + 2.5)
  filter.connect(gain).connect(master)
  const tn = (f: number, v: number) => {
    const o = c.createOscillator(), g = c.createGain()
    o.frequency.value = f; g.gain.value = v
    o.connect(g).connect(filter); o.start()
    return o
  }
  const a = tn(55, 0.09), b = tn(55.4, 0.07), h = tn(110.2, 0.02)
  const air = c.createBufferSource(), airF = c.createBiquadFilter(), airG = c.createGain()
  air.buffer = nb; air.loop = true
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
whenRunning(() => { if (wantHum) startHum() })

/** Start or stop the cabin hum (it waits for the first gesture if there has not been one). */
export function cabinHum(on: boolean) {
  wantHum = on
  if (on) { whenRunning(() => { if (wantHum) startHum() }) }
  else if (hum) { hum.stop(); hum = null }
}
/** Muffle the hum outside the station (0 = inside, 1 = out on EVA). */
export function humOutside(k: number) {
  const p = parts()
  if (!hum || !p) return
  hum.filter.frequency.setTargetAtTime(900 - 760 * k, p.c.currentTime, 0.4)
}

/* ---------- stingers (one-shots, used by music.ts) ---------- */

export const STINGERS = {
  /** Landing: the AstroDocX wordmark appears. The A-major resolution: organ swell, a glass bell, a long tail. */
  logo: () => { organ([45, 52, 57, 61, 64], { dur: 7, vol: 0.3, cut: 1800, rev: 0.8 }); bell({ f: 1760, dur: 3.5, vol: 0.18, at: 1.6, ratio: 2, idx: 0.8, rev: 0.9 }); bell({ f: 2217, dur: 3.5, vol: 0.12, at: 2.1, ratio: 2, idx: 0.8, rev: 0.9 }); thump({ f0: 60, f1: 35, dur: 0.8, vol: 0.5 }) },
  /** A check-in saved: a warm rising electric-piano figure with a soft pad under it. */
  checkin: () => { [53, 57, 60, 64, 69].forEach((m, k) => rhodes(hz(m), { at: k * 0.14, vol: 0.13, dur: 2, echo: 0.3 })); pad([53, 60, 64, 69].map(hz), { dur: 4, vol: 0.1, cut: 1400, rev: 0.7 }) },
  /** Mission success: a major stack swells up with a glass arpeggio over it. */
  success: () => { organ([48, 55, 60, 64, 67], { dur: 9, vol: 0.28, cut: 2200, rev: 0.8 }); [72, 76, 79, 84, 88].forEach((m, k) => bell({ f: hz(m), dur: 2.4, vol: 0.14, ratio: 2, idx: 1, at: 1 + k * 0.18, rev: 0.7 })); noise({ dur: 3, vol: 0.05, f0: 2500, f1: 7000, q: 1.4, a: 2, at: 0.6 }) },
} as const
export type StingerId = keyof typeof STINGERS
/** Play a stinger under the voice (quiet() scales it as the preview does). */
export const sting = (id: StingerId) => quiet(STINGERS[id])

// keep helpers used by the score importable from one place
export { rnd, pick }
