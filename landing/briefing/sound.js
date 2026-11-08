/* ============================================================
   ASTRODOCX — Mission Briefing sound (Web Audio, no files)
   A quiet cabin pad, soft glass ticks while NOVA talks and a glass tick
   or chime when a door lights up (FM glass bells with a little room,
   from the audio palette). Off by default; the choice is remembered (same key
   as the story page). Browsers only allow audio after a gesture, so
   a remembered "on" starts at the visitor's first click or key.
============================================================ */
const KEY = 'adx-sound'
const AC = window.AudioContext || window.webkitAudioContext
const store = {
  get: () => { try { return localStorage.getItem(KEY) } catch { return null } },
  set: (v) => { try { localStorage.setItem(KEY, v) } catch { /* private mode */ } },
}

let ctx = null, master = null, pad = null, verb = null, on = false, lastBlip = 0

function boot() {
  if (ctx || !AC) return
  ctx = new AC()
  master = ctx.createGain(); master.gain.value = 0; master.connect(ctx.destination)
  // pad: two detuned low tones through a slow, breathing low-pass
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 520; lp.Q.value = 0.7
  const lfo = ctx.createOscillator(), lfoG = ctx.createGain(); lfo.frequency.value = 0.06; lfoG.gain.value = 180
  lfo.connect(lfoG); lfoG.connect(lp.frequency); lfo.start()
  pad = ctx.createGain(); pad.gain.value = 0.05
  for (const [f, type] of [[55, 'sine'], [82.4, 'triangle'], [110.3, 'sine']]) {
    const o = ctx.createOscillator(); o.type = type; o.frequency.value = f; o.detune.value = (Math.random() - 0.5) * 12; o.connect(lp); o.start()
  }
  lp.connect(pad); pad.connect(master)
  // a small synthetic room for the glass bells: decaying stereo noise
  verb = ctx.createConvolver()
  const n = Math.floor(ctx.sampleRate * 2.4), ir = ctx.createBuffer(2, n, ctx.sampleRate)
  for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 2.4) }
  verb.buffer = ir
  const wet = ctx.createGain(); wet.gain.value = 0.9; verb.connect(wet); wet.connect(master)
}

function ramp(v, s = 0.6) {
  if (!ctx) return
  const t = ctx.currentTime
  master.gain.cancelScheduledValues(t); master.gain.setValueAtTime(master.gain.value, t); master.gain.linearRampToValueAtTime(v, t + s)
}

/* an FM glass bell: a carrier whose modulation dies away faster than the note, with a send to the room */
function bell(freq, dur, vol, delay = 0, ratio = 2, idx = 1, rev = 0.3) {
  if (!on || !ctx) return
  const t = ctx.currentTime + delay, car = ctx.createOscillator(), mod = ctx.createOscillator(), mg = ctx.createGain(), gn = ctx.createGain()
  car.frequency.value = freq; mod.frequency.value = freq * ratio
  mg.gain.setValueAtTime(freq * idx, t); mg.gain.exponentialRampToValueAtTime(0.01 * freq, t + dur)
  mod.connect(mg); mg.connect(car.frequency)
  gn.gain.setValueAtTime(0.0001, t); gn.gain.exponentialRampToValueAtTime(vol, t + 0.004); gn.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  car.connect(gn); gn.connect(master)
  if (verb) { const sd = ctx.createGain(); sd.gain.value = rev; gn.connect(sd); sd.connect(verb) }
  car.start(t); mod.start(t); car.stop(t + dur + 0.05); mod.stop(t + dur + 0.05)
}

const GLASS = [1568, 1760, 2093, 2349]
export const sound = {
  available: !!AC,
  get on() { return on },
  set(v) {
    on = !!v && !!AC; store.set(on ? 'on' : 'off')
    if (on) { boot(); ctx.resume?.(); ramp(1) } else ramp(0, 0.3)
    return on
  },
  wanted: () => store.get() === 'on',
  /** a soft glassy tick per few characters while NOVA types */
  blip() { const n = performance.now(); if (n - lastBlip < 55) return; lastBlip = n; bell(GLASS[Math.floor(Math.random() * GLASS.length)], 0.12, 0.03, 0, 2, 0.6, 0.2) },
  tick() { bell(2349, 0.14, 0.05, 0, 2, 0.8, 0.2) },
  chime() { bell(784, 0.9, 0.06, 0, 2, 1.2, 0.5); bell(1175, 1.2, 0.055, 0.1, 2, 1.2, 0.5) },
}
