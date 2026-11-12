import { rng } from '../data/synthetic'
import { plethShape } from '../live/waves'
import type { ExamId } from './exams'
import { quality, type Probe } from './guide'

/*
 * Procedural B-mode pictures. Each exam is a small anatomical model (echogenicity at each point), seen through a
 * probe that may be off target: sliding or tilting moves the anatomy in the image, and quality scales the contrast.
 * Speckle (the grain of real ultrasound) comes from a fixed noise texture that drifts with the tissue's motion.
 * Nothing here is a medical image; it is a drawing that behaves like one.
 */

export const IMG_W = 192
export const IMG_H = 144

const TEX = 128
const texture = (() => {
  const r = rng(90210)
  const t = new Float32Array(TEX * TEX)
  for (let i = 0; i < t.length; i++) t[i] = Math.sqrt(-2 * Math.log(Math.max(1e-9, 1 - r.next()))) * 0.62 // Rayleigh: the statistics of speckle
  return t
})()

/** Numbers that shape the anatomy so the picture matches the measurements the scan will report. */
export interface Anatomy {
  lvef: number; lvedd: number; ijv: number; cpv: number; blines: number; sliding: number; thickness: number; onsd: number
}
export const NORMAL_ANATOMY: Anatomy = { lvef: 62, lvedd: 48, ijv: 0.85, cpv: 85, blines: 0, sliding: 1, thickness: 24, onsd: 4.6 }

export interface Clock { t: number; heartHz: number; breathHz: number }

const sstep = (a: number, b: number, x: number) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t) }
const bump = (x: number, mu: number, w: number) => Math.exp(-0.5 * ((x - mu) / w) ** 2)
/** Position inside an ellipse: <1 is inside, ~1 the wall. */
const ell = (u: number, v: number, cx: number, cy: number, rx: number, ry: number) => Math.hypot((u - cx) / rx, (v - cy) / ry)

/** Heart: four dark chambers in grey muscle; the ventricles squeeze on each beat. */
function cardiac(u: number, v: number, a: Anatomy, c: Clock): number {
  const hp = (c.t * c.heartHz) % 1
  const sys = hp < 0.4 ? Math.sin((Math.PI * hp) / 0.4) ** 1.4 : 0
  const squeeze = 1 - 0.38 * (a.lvef / 62) * sys
  const size = a.lvedd / 48
  let e = 0.2
  const body = ell(u, v, 0, 0.55, 0.78, 0.5)
  if (body < 1) e = 0.5
  const lv = ell(u, v, -0.24, 0.5, 0.22 * size * squeeze, 0.31 * size * squeeze)
  const rv = ell(u, v, 0.27, 0.46, 0.2 * (1 + 0.3 * (1 - squeeze)), 0.27)
  const la = ell(u, v, -0.2, 0.86, 0.2, 0.1)
  const ra = ell(u, v, 0.25, 0.86, 0.18, 0.1)
  const chamber = Math.min(lv, rv, la, ra)
  if (chamber < 1) e = 0.04
  e += 0.55 * (bump(lv, 1, 0.12) + bump(rv, 1, 0.12) + 0.6 * bump(la, 1, 0.12) + 0.6 * bump(ra, 1, 0.12))
  return Math.min(e, 1.3)
}

/** Neck (transverse): carotid artery pulses, jugular vein is the larger, softer oval beside it. */
function vascular(u: number, v: number, a: Anatomy, c: Clock): number {
  const pulse = plethShape((c.t * c.heartHz) % 1)
  let e = 0.34
  if (v < 0.09) e = 0.85
  else if (v < 0.16) e = 0.25
  else if (v < 0.34) e = 0.42 + 0.06 * Math.sin(u * 40)
  const ca = ell(u, v, -0.26, 0.5, 0.13 * (1 + 0.1 * pulse), 0.13 * (1 + 0.1 * pulse))
  const rIjv = 0.21 * Math.sqrt(a.ijv / 0.85)
  const ij = ell(u, v, 0.22, 0.46, rIjv, rIjv * 0.72 * (1 + 0.04 * Math.sin(c.t * c.breathHz * 6.28)))
  const lumen = Math.min(ca, ij)
  if (lumen < 1) e = 0.03
  return e + 0.9 * bump(ca, 1, 0.08) + 0.35 * bump(ij, 1, 0.07)
}

/** Lung (intercostal): chest wall, the bright pleural line, ribs with shadows, A-lines or B-lines below. */
function lung(u: number, v: number, a: Anatomy, c: Clock): number {
  const pleura = 0.3
  let e: number
  if (v < 0.07) e = 0.85
  else if (v < pleura) e = 0.4 + 0.15 * Math.sin(v * 70) * 0.5 + 0.2 * bump(v, 0.13, 0.008) + 0.2 * bump(v, 0.21, 0.008)
  else e = 0.07
  e += 2.0 * bump(v, pleura, 0.014)
  if (v > pleura) {
    for (const k of [2, 3]) e += (0.32 / k) * bump(v, pleura * k, 0.01) // A-lines: reverberations of the pleura at multiples of its depth
    for (let i = 0; i < Math.round(a.blines); i++) {
      const ux = -0.8 + (1.6 * (i + 0.5)) / Math.max(1, Math.round(a.blines)) + 0.03 * Math.sin(c.t * c.breathHz * 6.28)
      e += 0.8 * bump(u, ux, 0.035) * (1 - 0.35 * sstep(pleura, 1, v))
    }
  }
  for (const rib of [-0.72, 0.72]) {
    const near = bump(u, rib, 0.1)
    if (v > 0.12 && v < pleura) e += 0.9 * near * bump(v, 0.2, 0.05)
    if (v >= pleura) e *= 1 - 0.9 * near
  }
  return e
}

/** Thigh: skin, fat, the muscle between two fascia lines (as thick as the measurement says), then the bone and its shadow. */
function muscle(u: number, v: number, a: Anatomy): number {
  const top = 0.17
  const t = (a.thickness / 60) * 1.0 // 6 cm of depth across the picture
  const bottom = top + t
  const bone = bottom + 0.2
  let e: number
  if (v < 0.05) e = 0.9
  else if (v < top) e = 0.22 + 0.15 * bump(v, 0.11, 0.01)
  else if (v < bottom) e = 0.36 + 0.12 * Math.sin(v * 220 + u * 3)
  else if (v < bone) e = 0.3 + 0.1 * Math.sin(v * 160)
  else e = 0.12
  e += 0.9 * bump(v, top, 0.012) + 0.8 * bump(v, bottom, 0.012)
  e += 1.4 * bump(v, bone, 0.014) * (1 - 0.3 * Math.abs(u))
  if (v > bone) e *= 0.35 // acoustic shadow
  return e
}

/** Eye through the closed lid: dark globe, bright back wall and lens, and the optic nerve with its bright sheath behind. */
function ocular(u: number, v: number, a: Anatomy): number {
  let e = v < 0.08 ? 0.9 : 0.45
  const g = ell(u, v, 0, 0.3, 0.3, 0.2)
  if (g < 1) e = 0.03
  e += 0.9 * bump(g, 1, 0.07) * (v > 0.3 ? 1 : 0.4)
  e += 0.8 * bump(ell(u, v, 0, 0.17, 0.12, 0.03), 1, 0.3) // the lens
  if (v > 0.5) {
    const half = 0.025 * a.onsd // sheath half-width grows with the measurement
    e = 0.58 + 0.12 * Math.sin(v * 90 + u * 20)
    if (Math.abs(u) < half) e = 0.1 + 0.25 * bump(Math.abs(u), 0, 0.02) // nerve inside the sheath
    e += 1.0 * bump(Math.abs(u), half, 0.014) // the sheath itself
    if (v > 0.8) e *= 0.6
  }
  return e
}

const SCENES: Record<ExamId, (u: number, v: number, a: Anatomy, c: Clock) => number> = {
  cardiac, vascular, lung, muscle: (u, v, a) => muscle(u, v, a), ocular: (u, v, a) => ocular(u, v, a),
}

/** Draws one frame into `img` (IMG_W x IMG_H). `gain` is the user's brightness control, about 0.6 to 1.6. */
export function renderFrame(img: ImageData, exam: ExamId, clock: Clock, probe: Probe, anatomy: Anatomy, gain = 1) {
  const q = quality(probe)
  const scene = SCENES[exam]
  const sector = exam === 'cardiac'
  const grainSeed = Math.floor(clock.t * 24)
  const dx = Math.floor(clock.t * 3) // tissue shimmer
  // sliding lung: the speckle along the pleura slides with each breath; a lung that does not slide keeps it still
  const slide = exam === 'lung' && anatomy.sliding >= 0.5 ? Math.round(5 * Math.sin(clock.t * clock.breathHz * 6.28)) : 0
  const d = img.data
  for (let py = 0; py < IMG_H; py++) {
    const v0 = py / IMG_H
    for (let px = 0; px < IMG_W; px++) {
      const p = (py * IMG_W + px) * 4
      const u0 = (px / IMG_W - 0.5) * 2
      if (sector && Math.abs(u0) > 0.22 + v0 * 0.85) { d[p] = d[p + 1] = d[p + 2] = 3; d[p + 3] = 255; continue }
      // the probe is off target: the anatomy sits shifted and tilted in the picture
      const u = u0 + probe.x * 0.9 + probe.tilt * 0.35 * (v0 - 0.5)
      const v = v0 + probe.y * 0.5
      const e = scene(u, v, anatomy, clock)
      const nearPleura = exam === 'lung' && Math.abs(v - 0.3) < 0.05
      const sx = (px + (nearPleura ? slide : 0) + (exam === 'cardiac' ? dx : 0)) & (TEX - 1)
      const speck = texture[(py & (TEX - 1)) * TEX + sx]
      const atten = Math.exp(-1.15 * v0)
      let i = e * (0.45 + 0.55 * speck) * (0.35 + 0.65 * atten) * gain * (0.3 + 0.7 * q)
      // grain from a poorly coupled probe
      const g = ((Math.imul(px * 73856093 ^ py * 19349663 ^ grainSeed * 83492791, 0x9e3779b1) >>> 24) / 255 - 0.5) * (1 - q) * 0.5
      i = Math.max(0, Math.min(1, Math.pow(Math.max(0, i + g), 0.8)))
      const lum = Math.round(255 * i)
      d[p] = Math.round(lum * 0.86); d[p + 1] = Math.round(lum * 0.95); d[p + 2] = lum; d[p + 3] = 255
    }
  }
}

/** Doppler velocity envelope at heart phase 0..1, in the same units as the peak (cm/s). */
export const dopplerEnvelope = (phase: number, peak: number) => peak * plethShape(phase)
