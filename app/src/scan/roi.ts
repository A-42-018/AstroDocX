/**
 * Turning one camera frame into a skin-colour sample, and deciding whether the frame is good enough to use.
 * No face-tracking model: the person lines their face up with an on-screen oval, we read three patches inside it
 * (forehead and both cheeks) and check, per frame, that those patches really are skin, evenly lit and still.
 * Works offline and adds no download. Pure functions over pixel arrays, so they are testable.
 */

export interface Rect { x0: number; y0: number; x1: number; y1: number }

/** Where the three patches sit, as fractions of the frame. The guide oval is drawn around them. */
export const ROIS: readonly Rect[] = [
  { x0: 0.38, y0: 0.2, x1: 0.62, y1: 0.3 }, // forehead
  { x0: 0.3, y0: 0.5, x1: 0.42, y1: 0.62 }, // one cheek
  { x0: 0.58, y0: 0.5, x1: 0.7, y1: 0.62 }, // the other
]

/** The part of the frame where a face is expected; its skin centroid is tracked to measure motion. */
const FACE_AREA: Rect = { x0: 0.18, y0: 0.05, x1: 0.82, y1: 0.95 }

export interface FrameMeasure {
  /** Mean colour of the skin pixels in the three patches. */
  r: number; g: number; b: number
  /** Share of patch pixels that look like skin, 0 to 1. */
  skin: number
  /** Mean luma of the patches, 0 to 255. */
  luma: number
  /** Share of patch pixels that are blown out or crushed. */
  clipped: number
  /** Centroid of skin pixels in the face area, as fractions of the frame (null when none). */
  cx: number | null; cy: number | null
}

/** Classic YCbCr skin box (Chai and Ngan), tightened by R > G > B, which holds for real skin under most light. */
export function isSkin(r: number, g: number, b: number): boolean {
  if (!(r > g && g > b * 0.9 && r > 60)) return false
  const cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b
  const cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b
  return cb >= 77 && cb <= 127 && cr >= 133 && cr <= 173
}

/** Read the patches and the face area from RGBA pixels (a small canvas, 128 x 96 is plenty). */
export function measureFrame(rgba: Uint8ClampedArray | Uint8Array, w: number, h: number): FrameMeasure {
  let sr = 0, sg = 0, sb = 0, skinN = 0, total = 0, lumaSum = 0, clipN = 0
  for (const roi of ROIS) {
    const x0 = Math.floor(roi.x0 * w), x1 = Math.ceil(roi.x1 * w), y0 = Math.floor(roi.y0 * h), y1 = Math.ceil(roi.y1 * h)
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        const i = (y * w + x) * 4
        const r = rgba[i], g = rgba[i + 1], b = rgba[i + 2]
        total++
        const l = 0.299 * r + 0.587 * g + 0.114 * b
        lumaSum += l
        if (r > 250 || g > 250 || b > 250 || l < 25) clipN++
        if (isSkin(r, g, b)) { sr += r; sg += g; sb += b; skinN++ }
      }
    }
  }
  let mx = 0, my = 0, mn = 0
  const fx0 = Math.floor(FACE_AREA.x0 * w), fx1 = Math.ceil(FACE_AREA.x1 * w), fy0 = Math.floor(FACE_AREA.y0 * h), fy1 = Math.ceil(FACE_AREA.y1 * h)
  for (let y = fy0; y < fy1; y++) {
    for (let x = fx0; x < fx1; x++) {
      const i = (y * w + x) * 4
      if (isSkin(rgba[i], rgba[i + 1], rgba[i + 2])) { mx += x; my += y; mn++ }
    }
  }
  return {
    r: skinN ? sr / skinN : 0, g: skinN ? sg / skinN : 0, b: skinN ? sb / skinN : 0,
    skin: total ? skinN / total : 0, luma: total ? lumaSum / total : 0, clipped: total ? clipN / total : 0,
    cx: mn > 40 ? mx / mn / w : null, cy: mn > 40 ? my / mn / h : null,
  }
}

export type Verdict = 'ok' | 'no-face' | 'too-dark' | 'too-bright' | 'motion'

/** What to tell the person for each reason a frame was rejected. */
export const HINT: Record<Verdict, string> = {
  ok: 'Good signal. Hold still.',
  'no-face': 'Line your face up with the oval, forehead and cheeks in the boxes.',
  'too-dark': 'Too dark. Face a lamp or a window.',
  'too-bright': 'Too bright, or light glare on your face. Turn away from the window.',
  motion: 'Hold still, and keep your head level.',
}

export const LIMITS = {
  /** Patches must be mostly skin. */
  minSkin: 0.6,
  minLuma: 55,
  maxLuma: 225,
  maxClipped: 0.08,
  /** Face-centroid movement per second, as a fraction of frame width: above this the face is not still. */
  maxDrift: 0.35,
} as const

export interface Tracker { cx: number | null; cy: number | null; t: number; speed: number }
export const newTracker = (): Tracker => ({ cx: null, cy: null, t: 0, speed: 0 })

/**
 * Judge one frame. `tracker` carries the previous skin centroid, and a smoothed speed, between calls.
 * Brightness and skin are checked first because a rejected frame says what to fix; motion last.
 */
export function judge(m: FrameMeasure, tMs: number, tr: Tracker): Verdict {
  let verdict: Verdict = 'ok'
  if (m.skin < LIMITS.minSkin) verdict = m.luma < LIMITS.minLuma ? 'too-dark' : 'no-face'
  else if (m.luma < LIMITS.minLuma) verdict = 'too-dark'
  else if (m.luma > LIMITS.maxLuma || m.clipped > LIMITS.maxClipped) verdict = 'too-bright'

  if (m.cx !== null && m.cy !== null && tr.cx !== null && tr.cy !== null && tMs > tr.t) {
    const dt = (tMs - tr.t) / 1000
    const v = Math.hypot(m.cx - tr.cx, m.cy - tr.cy) / dt
    tr.speed = tr.speed * 0.8 + v * 0.2
    if (verdict === 'ok' && tr.speed > LIMITS.maxDrift) verdict = 'motion'
  } else if (m.cx === null) tr.speed = 0
  tr.cx = m.cx; tr.cy = m.cy; tr.t = tMs
  return verdict
}
