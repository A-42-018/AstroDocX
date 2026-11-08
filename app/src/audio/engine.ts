/*
 * The Web Audio engine shared by the effects (sfx.ts) and the score (music.ts): one AudioContext, one master chain
 * (gain → compressor → speakers), a hall reverb and a tape echo to send to, and the synthesis primitives the sounds
 * are written with (tone, glass bell, filtered noise, thump, pad, organ, electric piano). No audio files: everything
 * is generated, so it works offline.
 *
 * The context starts on the first tap or key press (browsers block sound before one). Anything asked for before that,
 * while muted, in the cabin's framed wall screens, or while the tab is hidden, is dropped by `live()`.
 */

const AC = typeof window !== 'undefined' ? (window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext) : undefined

/** The cabin's wall screens are the console in frames: they stay silent, the cabin speaks for them. */
export const framed = typeof window !== 'undefined' && window.self !== window.top

/**
 * Effects are written at the audio-palette preview's levels (docs/design-refs/audio-palette); this brings them to the
 * level they sit at over the score and the voices. It is one gain on the effects bus, so it is the one number to turn.
 */
export const LOUD = 1.1

let ctx: AudioContext | null = null
let master: GainNode | null = null
let sfxBus: GainNode | null = null
let musicBus: GainNode | null = null
let verb: ConvolverNode | null = null
let echo: DelayNode | null = null
let noiseBuf: AudioBuffer | null = null
let isOn: () => boolean = () => true
let ready: (() => void)[] = []

/** The Sound toggle's state, read on every call (sfx.ts binds it). */
export const bindOn = (f: () => boolean) => { isOn = f }

/** A decaying stereo noise burst: a synthetic hall. */
function impulse(c: AudioContext, sec: number, decay: number) {
  const n = Math.floor(c.sampleRate * sec), b = c.createBuffer(2, n, c.sampleRate)
  for (let ch = 0; ch < 2; ch++) { const d = b.getChannelData(ch); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, decay) }
  return b
}

export function boot(): AudioContext | null {
  if (ctx) return ctx
  if (!AC) return null
  try { ctx = new AC() } catch { return null }
  const c = ctx
  master = c.createGain()
  master.gain.value = isOn() ? 1 : 0
  const comp = c.createDynamicsCompressor()
  comp.threshold.value = -16; comp.ratio.value = 4; comp.knee.value = 12
  master.connect(comp); comp.connect(c.destination)
  sfxBus = c.createGain(); sfxBus.gain.value = LOUD; sfxBus.connect(master)
  musicBus = c.createGain(); musicBus.gain.value = 0.9; musicBus.connect(master)
  verb = c.createConvolver(); verb.buffer = impulse(c, 3.2, 2.4)
  const vo = c.createGain(); vo.gain.value = 0.9; verb.connect(vo); vo.connect(master)
  echo = c.createDelay(1); echo.delayTime.value = 0.375
  const fb = c.createGain(); fb.gain.value = 0.38
  const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2400
  echo.connect(lp); lp.connect(fb); fb.connect(echo); lp.connect(master); lp.connect(verb)
  // two seconds of white noise, looped and filtered for air, whooshes and hiss
  noiseBuf = c.createBuffer(1, c.sampleRate * 2, c.sampleRate)
  const d = noiseBuf.getChannelData(0)
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
  return c
}

/** The context, running, or null before the first gesture, when muted, framed, or without Web Audio. */
export function live(): AudioContext | null {
  if (framed || !ctx || !isOn() || ctx.state !== 'running') return null
  return ctx
}
/** True when sound is on and the browser has allowed it (after the first gesture). */
export const audible = () => !!live()
/** The context as it is, running or not (null before the first gesture). */
export const rawContext = () => ctx
export const hasBuses = () => !!(master && sfxBus && musicBus && verb && echo && noiseBuf)

/** Run `f` once the context is running (at once if it already is). */
export function whenRunning(f: () => void) {
  if (ctx?.state === 'running') f(); else ready.push(f)
}

/** Set the master level: used for the Sound toggle (a short delay on the way down lets a "turned off" blip finish). */
let muteTimer = 0
export function setMaster(on: boolean, afterMs = 0) {
  window.clearTimeout(muteTimer)
  const apply = () => { if (ctx && master) master.gain.setTargetAtTime(on ? 1 : 0, ctx.currentTime, 0.05) }
  if (on || !afterMs) apply(); else muteTimer = window.setTimeout(apply, afterMs)
}

if (typeof window !== 'undefined') {
  const unlock = () => {
    const c = boot()
    if (!c) return
    void c.resume().then(() => {
      if (c.state !== 'running') return
      window.removeEventListener('pointerdown', unlock); window.removeEventListener('keydown', unlock)
      const fns = ready; ready = []
      fns.forEach((f) => f())
    })
  }
  window.addEventListener('pointerdown', unlock)
  window.addEventListener('keydown', unlock)
  // a hidden tab goes quiet (the score and effects with it), and frees the audio thread
  document.addEventListener('visibilitychange', () => { if (!ctx) return; if (document.hidden) void ctx.suspend(); else void ctx.resume() })
}

/* ---------- routing ---------- */

let bus: AudioNode | null = null
let spatial = false
/** Send everything created inside `f` to `node` instead of the effects bus (a quiet stinger, a spatial panner, a bed's own fader). */
export function withBus(node: AudioNode, f: () => void, isSpatial = false) {
  const was = [bus, spatial] as const
  bus = node; spatial = isSpatial
  try { f() } finally { bus = was[0]; spatial = was[1] }
}

/** Where a sound goes: its own `out`, else the current bus, else the effects bus; with an optional stereo pan. */
interface Route { out?: AudioNode; pan?: number }
function route(c: AudioContext, o: Route): AudioNode {
  let out = o.out ?? bus ?? sfxBus!
  if (o.pan != null && !spatial && c.createStereoPanner) { const p = c.createStereoPanner(); p.pan.value = o.pan; p.connect(out); out = p }
  return out
}
function send(c: AudioContext, node: AudioNode, rev?: number, ech?: number) {
  if (rev) { const s = c.createGain(); s.gain.value = rev; node.connect(s); s.connect(verb!) }
  if (ech) { const s = c.createGain(); s.gain.value = ech; node.connect(s); s.connect(echo!) }
}
function env(c: AudioContext, vol: number, at: number, a: number, hold: number, dec: number, out: AudioNode) {
  const g = c.createGain(), p = g.gain, v = Math.max(vol, 0.0003)
  p.setValueAtTime(0.0001, at)
  p.exponentialRampToValueAtTime(v, at + a)
  if (hold) p.setValueAtTime(v, at + a + hold)
  p.exponentialRampToValueAtTime(0.0001, at + a + hold + dec)
  g.connect(out)
  return g
}

export const hz = (m: number) => 440 * 2 ** ((m - 69) / 12)

/* ---------- primitives ---------- */

interface Sends { rev?: number; echo?: number }
interface Timing { at?: number; vol?: number }

export interface ToneOpts extends Route, Sends, Timing { f: number; to?: number; dur: number; hold?: number; type?: OscillatorType; a?: number; lp?: number }
/** A short tone (sine unless told otherwise), optionally gliding to `to`, held for `hold` seconds, low-passed at `lp`. */
export function tone(o: ToneOpts) {
  const c = live()
  if (!c || !hasBuses()) return
  const at = (o.at ?? 0) + c.currentTime, a = o.a ?? 0.006, h = o.hold ?? 0
  const osc = c.createOscillator()
  osc.type = o.type ?? 'sine'
  osc.frequency.setValueAtTime(o.f, at)
  if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, at + a + h + o.dur)
  let n: AudioNode = osc
  if (o.lp) { const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = o.lp; osc.connect(f); n = f }
  const g = env(c, o.vol ?? 0.2, at, a, h, o.dur, route(c, o))
  n.connect(g); send(c, g, o.rev, o.echo)
  osc.start(at); osc.stop(at + a + h + o.dur + 0.06)
}

export interface BellOpts extends Route, Sends, Timing { f: number; dur: number; ratio?: number; idx?: number }
/** An FM glass bell: a carrier whose modulation dies away faster than the note. */
export function bell(o: BellOpts) {
  const c = live()
  if (!c || !hasBuses()) return
  const at = (o.at ?? 0) + c.currentTime
  const car = c.createOscillator(), mod = c.createOscillator(), mg = c.createGain()
  car.frequency.value = o.f; mod.frequency.value = o.f * (o.ratio ?? 3.5)
  mg.gain.setValueAtTime(o.f * (o.idx ?? 2.5), at); mg.gain.exponentialRampToValueAtTime(0.01 * o.f, at + o.dur)
  mod.connect(mg); mg.connect(car.frequency)
  const g = env(c, o.vol ?? 0.2, at, 0.004, 0, o.dur, route(c, o))
  car.connect(g); send(c, g, o.rev, o.echo)
  car.start(at); mod.start(at); car.stop(at + o.dur + 0.1); mod.stop(at + o.dur + 0.1)
}

export interface NoiseOpts extends Route, Sends, Timing { dur: number; f0: number; f1?: number; q?: number; type?: BiquadFilterType; a?: number }
/** Filtered noise: a whoosh when the band sweeps, a hiss when it stays high. */
export function noise(o: NoiseOpts) {
  const c = live()
  if (!c || !hasBuses()) return
  const at = (o.at ?? 0) + c.currentTime, a = o.a ?? o.dur * 0.3
  const src = c.createBufferSource()
  src.buffer = noiseBuf; src.loop = true
  const f = c.createBiquadFilter()
  f.type = o.type ?? 'bandpass'; f.Q.value = o.q ?? 1
  f.frequency.setValueAtTime(o.f0, at); f.frequency.exponentialRampToValueAtTime(o.f1 ?? o.f0, at + o.dur)
  src.connect(f)
  const g = env(c, o.vol ?? 0.1, at, a, 0, Math.max(0.02, o.dur - a), route(c, o))
  f.connect(g); send(c, g, o.rev, o.echo)
  src.start(at, Math.random() * 1.5); src.stop(at + o.dur + 0.06)
}

/** A low thud: a sine falling from `f0` to `f1`. */
export function thump(o: { f0: number; f1: number; dur: number; vol?: number; at?: number; out?: AudioNode; pan?: number }) {
  tone({ f: o.f0, to: o.f1, dur: o.dur, vol: o.vol, at: o.at, a: 0.008, out: o.out, pan: o.pan })
}

export interface PadOpts extends Route, Sends, Timing { dur: number; cut?: number; up?: number; type?: OscillatorType }
/** A soft swelling chord: sustained, detuned oscillators through one low-pass. Returns the oscillators (a bed can stop them early). */
export function pad(freqs: number[], o: PadOpts): OscillatorNode[] {
  const c = live()
  if (!c || !hasBuses()) return []
  const at = (o.at ?? 0) + c.currentTime, dur = o.dur
  const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = o.cut ?? 900; f.Q.value = 0.5
  const g = c.createGain()
  g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(o.vol ?? 0.1, at + dur * (o.up ?? 0.3)); g.gain.linearRampToValueAtTime(0, at + dur)
  f.connect(g); g.connect(route(c, o)); send(c, g, o.rev ?? 0.6, o.echo)
  const stops: OscillatorNode[] = []
  freqs.forEach((fr) => {
    for (const dt of [-6, 6]) {
      const os = c.createOscillator(); os.type = o.type ?? 'sawtooth'; os.frequency.value = fr; os.detune.value = dt + (Math.random() - 0.5) * 3
      const og = c.createGain(); og.gain.value = 1 / freqs.length / 2
      os.connect(og); og.connect(f); os.start(at); os.stop(at + dur + 0.05); stops.push(os)
    }
  })
  return stops
}

export interface OrganOpts extends Route, Sends, Timing { dur: number; cut?: number }
/** A drawbar organ chord (fundamental, octave, twelfth): the landing page's drone. */
export function organ(midis: number[], o: OrganOpts) {
  const c = live()
  if (!c || !hasBuses()) return
  const at = (o.at ?? 0) + c.currentTime, dur = o.dur, vol = o.vol ?? 0.22
  const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = o.cut ?? 800; f.Q.value = 0.4
  const g = c.createGain()
  g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(vol, at + dur * 0.25); g.gain.setValueAtTime(vol, at + dur * 0.7); g.gain.linearRampToValueAtTime(0, at + dur)
  f.connect(g); g.connect(route(c, o)); send(c, g, o.rev ?? 0.7, o.echo)
  midis.forEach((m) => {
    ;([[1, 0.5, 'sine'], [2, 0.18, 'sine'], [3, 0.07, 'triangle']] as const).forEach(([mul, gain, type], i) => {
      const os = c.createOscillator(), og = c.createGain()
      os.type = type; os.frequency.value = hz(m) * mul; os.detune.value = (i % 2 ? 4 : -3) + (Math.random() - 0.5) * 3
      og.gain.value = gain * (m < 44 ? 1.1 : m > 62 ? 0.7 : 0.9)
      os.connect(og); og.connect(f); os.start(at); os.stop(at + dur + 0.05)
    })
  })
}

export interface RhodesOpts extends Route, Sends, Timing { dur?: number }
/** A soft electric-piano note (FM with a short tine). */
export function rhodes(f: number, o: RhodesOpts) {
  const c = live()
  if (!c || !hasBuses()) return
  const at = (o.at ?? 0) + c.currentTime, dur = o.dur ?? 1.4, vol = o.vol ?? 0.12
  const car = c.createOscillator(), mod = c.createOscillator(), mg = c.createGain(), lp = c.createBiquadFilter()
  car.frequency.value = f; mod.frequency.value = f
  mg.gain.setValueAtTime(f * 1.1, at); mg.gain.exponentialRampToValueAtTime(f * 0.12, at + dur * 0.6)
  mod.connect(mg); mg.connect(car.frequency)
  lp.type = 'lowpass'; lp.frequency.value = 3200; car.connect(lp)
  const g = env(c, vol, at, 0.006, 0, dur, route(c, o))
  lp.connect(g); send(c, g, 0.35, o.echo)
  const tn = c.createOscillator(), tg = c.createGain()
  tn.frequency.value = f * 14
  tg.gain.setValueAtTime(vol * 0.12 || 0.01, at); tg.gain.exponentialRampToValueAtTime(0.0001, at + 0.08)
  tn.connect(tg); tg.connect(g)
  car.start(at); mod.start(at); tn.start(at)
  car.stop(at + dur + 0.1); mod.stop(at + dur + 0.1); tn.stop(at + 0.12)
}

/** Buses and helpers for the score and the longer-running sounds (hum, radio hiss). Null until the first gesture. */
export function parts() {
  if (!ctx || !hasBuses()) return null
  return { c: ctx, master: master!, sfx: sfxBus!, music: musicBus!, verb: verb!, echo: echo!, noise: noiseBuf! }
}
