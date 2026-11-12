/**
 * The mirror's settings: what is shown (layers), how it looks, how much of the real face shows through, which part of
 * the head is revealed, and the fit to this person's head. Pure data + helpers, so it is easy to test and to save.
 */
export type Layer = 'skull' | 'brain' | 'muscles' | 'hands' | 'eyes' | 'outline'
export type Layers = Record<Layer, boolean>
export type Look = 'xray' | 'solid'
export type Reveal = 'whole' | 'left' | 'right' | 'top' | 'lower' | 'lens'

export const REVEALS: readonly { id: Reveal; label: string }[] = [
  { id: 'whole', label: 'Whole head' },
  { id: 'left', label: 'Left half only' },
  { id: 'right', label: 'Right half only' },
  { id: 'top', label: 'Top of the head only' },
  { id: 'lower', label: 'Lower face only' },
  { id: 'lens', label: 'X-ray lens (follows your fingertip)' },
]

export interface Fit {
  /** Scale factors (1 = the model's own size). */
  size: number; width: number; height: number; depth: number
  /** Shifts in cm along the head's own axes: left/right, up/down, forward/back. */
  dx: number; dy: number; dz: number
}

export interface XraySettings {
  layers: Layers
  look: Look
  strength: number
  brightness: number
  /** How much of the plain camera picture shows through the X-ray (0–1). */
  realThrough: number
  /** How soft the edge of a revealed part is (0–1). */
  feather: number
  reveal: Reveal
  /** The X-ray lens' radius, as a share of the screen's height. */
  lensSize: number
  fit: Fit
  labels: boolean
  dots: boolean
}

export const DEFAULT_FIT: Fit = { size: 1, width: 1, height: 1, depth: 1, dx: 0, dy: 0, dz: 0 }

export const DEFAULTS: XraySettings = {
  layers: { skull: true, brain: true, muscles: true, hands: true, eyes: true, outline: false },
  look: 'xray', strength: 0.7, brightness: 1, realThrough: 0, feather: 0.2, reveal: 'whole', lensSize: 0.18,
  fit: DEFAULT_FIT, labels: false, dots: false,
}

export const PRESETS: readonly { id: string; label: string; layers: Layers }[] = [
  { id: 'all', label: 'Everything', layers: { skull: true, brain: true, muscles: true, hands: true, eyes: true, outline: true } },
  { id: 'skull', label: 'Skull', layers: { skull: true, brain: false, muscles: false, hands: true, eyes: true, outline: false } },
  { id: 'brain', label: 'Brain', layers: { skull: false, brain: true, muscles: false, hands: false, eyes: false, outline: false } },
  { id: 'muscles', label: 'Muscles', layers: { skull: false, brain: false, muscles: true, hands: false, eyes: false, outline: false } },
]

export const FIT_RANGE = { scale: { min: 0.7, max: 1.3, step: 0.01 }, shift: { min: -5, max: 5, step: 0.1 } } as const

const num = (v: unknown, lo: number, hi: number, d: number) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d)
const bool = (v: unknown, d: boolean) => (typeof v === 'boolean' ? v : d)
const pick = <T extends string>(v: unknown, all: readonly T[], d: T): T => (all.includes(v as T) ? (v as T) : d)

/** Turns anything (a saved blob, a half-filled object) into valid settings, falling back to the default per field. */
export function normalize(raw: unknown): XraySettings {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const l = (r.layers && typeof r.layers === 'object' ? r.layers : {}) as Record<string, unknown>
  const f = (r.fit && typeof r.fit === 'object' ? r.fit : {}) as Record<string, unknown>
  const { scale: sc, shift: sh } = FIT_RANGE
  return {
    layers: Object.fromEntries((Object.keys(DEFAULTS.layers) as Layer[]).map((k) => [k, bool(l[k], DEFAULTS.layers[k])])) as Layers,
    look: pick(r.look, ['xray', 'solid'] as const, DEFAULTS.look),
    strength: num(r.strength, 0.15, 1, DEFAULTS.strength),
    brightness: num(r.brightness, 0.3, 1.5, DEFAULTS.brightness),
    realThrough: num(r.realThrough, 0, 1, DEFAULTS.realThrough),
    feather: num(r.feather, 0, 1, DEFAULTS.feather),
    reveal: pick(r.reveal, REVEALS.map((x) => x.id), DEFAULTS.reveal),
    lensSize: num(r.lensSize, 0.05, 0.45, DEFAULTS.lensSize),
    fit: {
      size: num(f.size, sc.min, sc.max, 1), width: num(f.width, sc.min, sc.max, 1), height: num(f.height, sc.min, sc.max, 1), depth: num(f.depth, sc.min, sc.max, 1),
      dx: num(f.dx, sh.min, sh.max, 0), dy: num(f.dy, sh.min, sh.max, 0), dz: num(f.dz, sh.min, sh.max, 0),
    },
    labels: bool(r.labels, DEFAULTS.labels),
    dots: bool(r.dots, DEFAULTS.dots),
  }
}

const KEY = 'astrodocx.xray.v1'

export function loadSettings(): XraySettings {
  try { const t = localStorage.getItem(KEY); return normalize(t ? JSON.parse(t) : null) } catch { return normalize(null) }
}

export function saveSettings(s: XraySettings): void {
  try { localStorage.setItem(KEY, JSON.stringify(s)) } catch { /* private window or blocked storage: the settings just do not persist */ }
}

/** The "line it up" recipe from the demo: solid bones with about half the real face showing. */
export function alignMode(s: XraySettings): XraySettings {
  return { ...s, look: 'solid', realThrough: 0.5, reveal: 'whole', layers: { ...s.layers, skull: true, outline: false } }
}
