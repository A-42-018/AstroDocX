import { create } from 'zustand'
import { bell, hz, noise, parts, rhodes, organ, pad, thump, tone, whenRunning } from './engine'
import { pick, rnd, sting, useSound, type StingerId } from './sfx'

/*
 * The score, generated with Web Audio (no files, no network, so it works offline): five beds that loop and evolve
 * (notes are chosen at random, so no two passes are the same), crossfaded when the screen changes and ducked under
 * speech. The numbers come from the audio-palette preview (docs/design-refs/audio-palette). Music is opt-in (the ♪
 * button); Sound off silences it, a hidden tab suspends it (engine.ts), and leaving the cabin disposes it.
 *
 * Which bed plays follows the screen: `setMusicArea` (called from the app shell and the cabin). The Red Alert bed
 * plays only on the Alerts screen and only while an Act-level alert is open (`setMusicAlert`).
 */

export type MusicArea = 'dashboard' | 'checkin' | 'trends' | 'alert' | 'cabin' | 'ground'
type BedId = 'orbit' | 'station' | 'pulse' | 'warmth' | 'alert'

interface MusicState { on: boolean; area: MusicArea; alert: boolean; bed: BedId | null }
export const useMusic = create<MusicState>(() => ({ on: false, area: 'dashboard', alert: false, bed: null }))

/** The score bus's level, and what it drops to while anyone speaks (about -10 dB). */
const NORMAL = 0.9
const DUCKED = 0.28

interface Run { id: BedId; out: GainNode; nodes: { stop: () => void }[]; i: number; next: number; timer: number }
interface Bed { id: BedId; dt: number; level: number; init?: (st: Run) => void; step: (st: Run, i: number, t: number) => void }

/** Reverb send for a node made outside the primitives (a drone's own output). */
function wet(node: AudioNode, amount: number) {
  const p = parts()
  if (!p) return
  const s = p.c.createGain()
  s.gain.value = amount
  node.connect(s); s.connect(p.verb)
}

const BEDS: Record<BedId, Bed> = {
  // Slow organ chords (Am, F, C, G) with sparse high "star" notes in a big hall: the landing page's soundtrack.
  orbit: {
    id: 'orbit', dt: 14, level: 0.17,
    step(st, i, t) {
      const p = parts(); if (!p) return
      const C = [[45, 52, 59, 60], [41, 48, 57, 60], [36, 48, 55, 64], [43, 50, 55, 62]], at = t - p.c.currentTime
      organ(C[i % 4], { at, dur: 18, out: st.out, cut: 700 + (i % 4) * 120 })
      for (let k = 0; k < 4; k++) {
        const m = pick(C[i % 4]) + 24 + (Math.random() < 0.3 ? 12 : 0)
        tone({ f: hz(m), dur: 3.2, vol: 0.07, a: 0.04, at: at + rnd(1, 13), rev: 0.9, out: st.out })
      }
    },
  },
  // Lydian pads (Dmaj7, Bm9, Gmaj7, Asus) with glassy pentatonic notes drifting through a tape echo.
  station: {
    id: 'station', dt: 0.5, level: 1.3,
    step(st, i, t) {
      const p = parts(); if (!p) return
      const at = t - p.c.currentTime
      if (i % 32 === 0) {
        const P = [[50, 57, 61, 66], [47, 54, 57, 61, 66], [43, 50, 54, 62], [45, 52, 57, 59]]
        pad(P[((i / 32) % 4) | 0].map(hz), { at, dur: 20, vol: 0.12, cut: 1100, out: st.out, rev: 0.7 })
      }
      if (Math.random() < 0.34) bell({ f: hz(pick([62, 64, 66, 69, 71, 74, 76, 78])), dur: 2.6, vol: 0.07, ratio: 2, idx: 1.1, at, rev: 0.55, echo: 0.5, pan: rnd(-0.7, 0.7), out: st.out })
    },
  },
  // A low drone and a quiet 60 bpm lub-dub (the heart is the metronome), with a faint high shimmer.
  pulse: {
    id: 'pulse', dt: 1, level: 0.27,
    init(st) {
      const p = parts(); if (!p) return
      const c = p.c, f = c.createBiquadFilter()
      f.type = 'lowpass'; f.frequency.value = 260
      const g = c.createGain(); g.gain.value = 0.16
      f.connect(g); g.connect(st.out); wet(g, 0.4)
      for (const fr of [55, 55.3, 82.4]) {
        const o = c.createOscillator(); o.type = 'sine'; o.frequency.value = fr
        const og = c.createGain(); og.gain.value = fr < 80 ? 0.5 : 0.22
        o.connect(og); og.connect(f); o.start(); st.nodes.push(o)
      }
    },
    step(st, i, t) {
      const p = parts(); if (!p) return
      const at = t - p.c.currentTime
      thump({ f0: 72, f1: 40, dur: 0.2, vol: 0.4, at, out: st.out }); thump({ f0: 68, f1: 38, dur: 0.18, vol: 0.18, at: at + 0.28, out: st.out })
      if (i % 6 === 0) bell({ f: hz(pick([81, 85, 88, 93])), dur: 3.5, vol: 0.045, ratio: 1, idx: 0.3, at: at + 0.5, rev: 0.95, out: st.out })
    },
  },
  // 70 bpm electric piano (Fmaj7, Em7, Dm9, Cmaj7), soft sub bass and brushed hats: "end of the shift, how are you?"
  warmth: {
    id: 'warmth', dt: 60 / 70 / 2, level: 0.5,
    step(st, i, t) {
      const p = parts(); if (!p) return
      const at = t - p.c.currentTime, bar = Math.floor(i / 8) % 4, b = i % 8
      const CH = [[53, 57, 60, 64], [52, 55, 59, 62], [50, 53, 57, 60, 64], [48, 52, 55, 59]], root = [41, 40, 38, 36][bar]
      if (b === 0 || b === 4) CH[bar].forEach((m, k) => rhodes(hz(m), { at: at + k * 0.028, vol: b ? 0.07 : 0.1, dur: 1.6, out: st.out, echo: 0.2 }))
      if (b === 0) tone({ f: hz(root), dur: 1.3, vol: 0.28, a: 0.02, at, out: st.out })
      if (b === 4) tone({ f: hz(root + 7), dur: 0.6, vol: 0.16, a: 0.02, at, out: st.out })
      noise({ dur: 0.06, vol: b % 2 ? 0.012 : 0.02, f0: 7500, f1: 6500, q: 0.7, type: 'bandpass', a: 0.004, at: at + (b % 2 ? 0.045 : 0), out: st.out, pan: b % 2 ? 0.3 : -0.3 })
      if (b === 2 && Math.random() < 0.55) rhodes(hz(pick([72, 74, 76, 79, 81])), { at, vol: 0.06, dur: 1.4, out: st.out, echo: 0.35 })
    },
  },
  // A tritone drone that pulses, a 120 bpm tick and a slow riser: tension without a siren, so the voice stays clear.
  alert: {
    id: 'alert', dt: 0.5, level: 0.28,
    init(st) {
      const p = parts(); if (!p) return
      const c = p.c, f = c.createBiquadFilter()
      f.type = 'lowpass'; f.frequency.value = 380
      const g = c.createGain(); g.gain.value = 0.16
      f.connect(g); g.connect(st.out)
      for (const fr of [55, 77.8]) { const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = fr; o.connect(f); o.start(); st.nodes.push(o) }
      const l = c.createOscillator(), lg = c.createGain()
      l.frequency.value = 0.8; lg.gain.value = 0.07
      l.connect(lg); lg.connect(g.gain); l.start(); st.nodes.push(l)
    },
    step(st, i, t) {
      const p = parts(); if (!p) return
      const at = t - p.c.currentTime
      tone({ f: 1800, dur: 0.03, vol: 0.08, at, out: st.out, type: 'triangle' })
      if (i % 2 === 0) thump({ f0: 60, f1: 42, dur: 0.2, vol: 0.3, at, out: st.out })
      if (i % 16 === 0) noise({ dur: 6, vol: 0.05, f0: 400, f1: 3200, q: 1.2, a: 5, at, out: st.out })
    },
  },
}

/** Which bed a screen gets (null: silence). The alert bed needs an open Act-level alert; without one that screen gets the station's. */
function bedFor(area: MusicArea, alert: boolean): BedId | null {
  switch (area) {
    case 'checkin': return 'warmth'
    case 'trends': return 'pulse'
    case 'alert': return alert ? 'alert' : 'station'
    case 'ground': return null
    default: return 'station'
  }
}

let run: Run | null = null
let ducked = false

function stopRun(fade = 1.2) {
  const b = run
  if (!b) return
  run = null
  window.clearInterval(b.timer)
  const p = parts()
  if (!p) return
  const t = p.c.currentTime
  b.out.gain.cancelScheduledValues(t)
  b.out.gain.setValueAtTime(b.out.gain.value, t)
  b.out.gain.linearRampToValueAtTime(0, t + fade)
  window.setTimeout(() => { b.nodes.forEach((n) => { try { n.stop() } catch { /* already stopped */ } }); b.out.disconnect() }, fade * 1000 + 150)
}

function startRun(bed: Bed, fade = 2) {
  const p = parts()
  if (!p) return
  const c = p.c
  stopRun(1.5)
  const out = c.createGain()
  out.gain.setValueAtTime(0, c.currentTime)
  out.gain.linearRampToValueAtTime(bed.level, c.currentTime + fade)
  out.connect(p.music)
  const st: Run = { id: bed.id, out, nodes: [], i: 0, next: c.currentTime + 0.08, timer: 0 }
  run = st
  bed.init?.(st)
  // schedule a little ahead of the clock; a suspended context (hidden tab) holds the clock, so nothing piles up
  const pump = () => { while (st.next < c.currentTime + 0.7) { bed.step(st, st.i++, st.next); st.next += bed.dt } }
  pump()
  st.timer = window.setInterval(pump, 150)
}

/** Bring the sound in line with the state: the right bed, or none when music is off, Sound is off or the screen is silent. */
function sync() {
  const m = useMusic.getState()
  const want = m.on && useSound.getState().on ? bedFor(m.area, m.alert) : null
  if (!want) { if (run) { stopRun(useSound.getState().on ? 1.2 : 0.3) } if (m.bed) useMusic.setState({ bed: null }); return }
  if (m.bed === want && run) return
  useMusic.setState({ bed: want })
  // the context may not be running yet (first click): the bed then starts as it comes up
  whenRunning(() => { const s = useMusic.getState(); if (s.bed === want && useSound.getState().on && s.on && run?.id !== want) { startRun(BEDS[want]); applyDuck() } })
}

function applyDuck() {
  const p = parts()
  if (p) p.music.gain.setTargetAtTime(ducked ? DUCKED : NORMAL, p.c.currentTime, 0.12)
}

/** Start the score (it waits for the first click if there has not been one). */
export function startMusic() {
  useMusic.setState({ on: true })
  sync()
}

/** Lower the score while someone is speaking, so the words come through (to about 28%). */
export function duckMusic(on: boolean) { ducked = on; applyDuck() }

export function stopMusic() {
  useMusic.setState({ on: false })
  sync()
}

/** Leaving the cabin takes the score with it. */
export function disposeMusic() {
  useMusic.setState({ on: false, bed: null })
  stopRun(0.6)
}

/** The screen the crew is on picks the bed (the shell and the cabin call this). */
export function setMusicArea(area: MusicArea) {
  if (useMusic.getState().area === area) return
  useMusic.setState({ area })
  sync()
}

/** An Act-level alert is open (or none is): the Alerts screen then plays the Red Alert bed. */
export function setMusicAlert(active: boolean) {
  if (useMusic.getState().alert === active) return
  useMusic.setState({ alert: active })
  sync()
}

/** One-shot stingers, under the voice: the logo reveal, a check-in saved, mission success. They follow the Sound toggle, not the score's. */
export const stinger = (id: StingerId) => sting(id)

// Sound off stops the score; on again brings it back if it was playing
useSound.subscribe(() => sync())
