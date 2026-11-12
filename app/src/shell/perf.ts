/*
 * One guess at how much the device can draw, shared by the 3D cabin, the X-ray mirror and the animated backdrop.
 *
 * Cores and RAM say little about the GPU: a 16 GB laptop with an Intel UHD chip draws far slower than a phone-sized
 * core count suggests. So the guess reads the GPU's name (WEBGL_debug_renderer_info) and only gives the top tier to a
 * discrete or Apple GPU. What the cabin learns while running (it steps down when frames run slow) is remembered, so a
 * second visit starts where the first one settled instead of stuttering through the same downgrade again.
 *
 * Overrides: `?quality=low|mid|high` in the URL (kept for the session), or `?quality=auto` to forget it.
 */

export type Tier = 'high' | 'mid' | 'low'

const KEY = 'adx.perf.tier', LEARNED = 'adx.perf.learned'
const TIERS: Tier[] = ['low', 'mid', 'high']
const rank = (t: Tier) => TIERS.indexOf(t)
const isTier = (v: unknown): v is Tier => v === 'high' || v === 'mid' || v === 'low'

let gpuName: string | null | undefined
/** The GPU's name, as the browser reports it (lower case), or null when it will not say. */
export function gpu(): string | null {
  if (gpuName !== undefined) return gpuName
  gpuName = null
  try {
    const c = document.createElement('canvas')
    const gl = (c.getContext('webgl2') || c.getContext('webgl')) as WebGLRenderingContext | null
    if (gl) {
      const ext = gl.getExtension('WEBGL_debug_renderer_info')
      const name = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER)
      gpuName = typeof name === 'string' ? name.toLowerCase() : null
      gl.getExtension('WEBGL_lose_context')?.loseContext()
    }
  } catch { /* no WebGL: the callers fall back on their own */ }
  return gpuName
}

/** What the hardware suggests, before any override or anything learned. */
export function guessTier(): Tier {
  if (typeof window === 'undefined') return 'mid'
  const cores = navigator.hardwareConcurrency || 4
  const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8
  const coarse = matchMedia('(pointer: coarse)').matches
  const g = gpu() ?? ''
  // software renderers and phone GPUs: the cheapest path
  if (/swiftshader|llvmpipe|software|basic render|mali|adreno|powervr/.test(g)) return 'low'
  if (innerWidth < 768 || coarse || cores <= 4 || mem <= 4) return 'low'
  // integrated graphics: Intel UHD/HD and older Iris draw the cabin's shadows and occlusion slowly; Iris Xe, Arc
  // and Radeon iGPUs manage the middle tier
  if (/intel/.test(g) && !/arc/.test(g)) return /iris.*xe|xe graphics/.test(g) ? 'mid' : 'low'
  if (/radeon(\(tm\))? (graphics|vega)|amd radeon\(tm\) graphics/.test(g)) return 'mid'
  // discrete NVIDIA / AMD, Apple silicon (Safari names every Apple chip "Apple GPU"; phones are caught above): the full look, but a dense Retina screen without many cores stays mid
  if (/nvidia|geforce|rtx|gtx|quadro|radeon rx|radeon pro|apple m\d|apple gpu|arc/.test(g)) return devicePixelRatio > 1.5 && cores < 8 ? 'mid' : 'high'
  // an unknown GPU (the browser hid its name): the middle tier, and the cabin steps down from there if it must
  return 'mid'
}

function readOverride(): Tier | null {
  try {
    const q = new URLSearchParams(location.search).get('quality')
    if (q === 'auto') { sessionStorage.removeItem(KEY); localStorage.removeItem(LEARNED); return null }
    if (isTier(q)) { sessionStorage.setItem(KEY, q); return q }
    const s = sessionStorage.getItem(KEY)
    return isTier(s) ? s : null
  } catch { return null }
}

/** The tier to start at: an override, else the lower of the guess and what an earlier visit learned. */
export function startTier(): Tier {
  const o = readOverride()
  if (o) return o
  const g = guessTier()
  let learned: unknown = null
  try { learned = localStorage.getItem(LEARNED) } catch { /* private mode */ }
  return isTier(learned) && rank(learned) < rank(g) ? learned : g
}

/** Was the tier set by hand (an override)? Then the cabin does not remember what it learns. */
export const forced = () => readOverride() !== null

/** Remembers that this device could only hold `t` (never raises what was learned before). */
export function learn(t: Tier) {
  if (forced()) return
  try {
    const prev = localStorage.getItem(LEARNED)
    if (!isTier(prev) || rank(t) < rank(prev)) localStorage.setItem(LEARNED, t)
  } catch { /* private mode */ }
}

/** Marks the page with the tier (`<html data-perf="low">`), so the CSS can drop costly effects like glass blur. */
export function markDocument(t: Tier = startTier()) {
  if (typeof document !== 'undefined') document.documentElement.dataset.perf = t
  return t
}
