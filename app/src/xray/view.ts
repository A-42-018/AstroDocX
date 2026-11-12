/** Where the mirror's pixels come from: the video fills the screen like CSS `object-fit: cover`. */
export interface Cover {
  /** How many screen pixels one video pixel takes. */
  k: number
  /** Video pixels cut off on the left and on the right (each), and at the top and at the bottom (each). */
  ox: number
  oy: number
}

/** The part of a vw×vh video that shows in a cw×ch box when it covers the box, centred. */
export function coverRect(vw: number, vh: number, cw: number, ch: number): Cover {
  if (!(vw > 0 && vh > 0 && cw > 0 && ch > 0)) return { k: 1, ox: 0, oy: 0 }
  const k = Math.max(cw / vw, ch / vh)
  return { k, ox: (vw - cw / k) / 2, oy: (vh - ch / k) / 2 }
}

/** The camera picture under the X-ray: grey, darker and harder as the strength goes up (0 = the plain mirror); `realThrough` (0–1) lets that much of the plain picture back. */
export function videoFilter(strength: number, realThrough = 0): string {
  const s = Math.max(0, Math.min(1, strength)) * (1 - Math.max(0, Math.min(1, realThrough)))
  return `grayscale(${s.toFixed(2)}) brightness(${(1 - 0.62 * s).toFixed(2)}) contrast(${(1 + 0.35 * s).toFixed(2)})`
}

/** The blue film over the darkened video, as a CSS colour. */
export const tintFor = (strength: number, realThrough = 0) =>
  `rgba(0, 26, 48, ${(0.42 * Math.max(0, Math.min(1, strength)) * (1 - Math.max(0, Math.min(1, realThrough)))).toFixed(3)})`
