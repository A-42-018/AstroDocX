/* ============================================================
   ASTRODOCX — Mission Briefing sound (Web Audio, no files)
   A quiet cabin pad, soft chirps while VITA talks and a tick when a
   door lights up. Off by default; the choice is remembered (same key
   as the story page). Browsers only allow audio after a gesture, so
   a remembered "on" starts at the visitor's first click or key.
============================================================ */
const KEY = 'adx-sound'
const AC = window.AudioContext || window.webkitAudioContext
const store = {
  get: () => { try { return localStorage.getItem(KEY) } catch { return null } },
  set: (v) => { try { localStorage.setItem(KEY, v) } catch { /* private mode */ } },
}

let ctx = null, master = null, pad = null, on = false, lastBlip = 0

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
}

function ramp(v, s = 0.6) {
  if (!ctx) return
  const t = ctx.currentTime
  master.gain.cancelScheduledValues(t); master.gain.setValueAtTime(master.gain.value, t); master.gain.linearRampToValueAtTime(v, t + s)
}

function tone(freq, dur, type = 'sine', vol = 0.05) {
  if (!on || !ctx) return
  const t = ctx.currentTime, o = ctx.createOscillator(), gn = ctx.createGain()
  o.type = type; o.frequency.setValueAtTime(freq, t)
  gn.gain.setValueAtTime(0.0001, t); gn.gain.exponentialRampToValueAtTime(vol, t + 0.008); gn.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  o.connect(gn); gn.connect(master); o.start(t); o.stop(t + dur + 0.02)
}

export const sound = {
  available: !!AC,
  get on() { return on },
  set(v) {
    on = !!v && !!AC; store.set(on ? 'on' : 'off')
    if (on) { boot(); ctx.resume?.(); ramp(1) } else ramp(0, 0.3)
    return on
  },
  wanted: () => store.get() === 'on',
  /** a soft chirp per few characters while VITA types */
  blip() { const n = performance.now(); if (n - lastBlip < 55) return; lastBlip = n; tone(880 + Math.random() * 520, 0.05, 'square', 0.012) },
  tick() { tone(1320, 0.06, 'triangle', 0.03) },
  chime() { tone(660, 0.25, 'sine', 0.04); setTimeout(() => tone(990, 0.3, 'sine', 0.03), 90) },
}
