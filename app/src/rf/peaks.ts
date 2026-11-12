import { CSI_HZ } from './csi'

/** Local maxima at least `gap` samples apart and above `floor` of the tallest one. */
export function breathPeaks(w: Float64Array, gap = Math.round(1.5 * CSI_HZ), floor = 0.35): number[] {
  let top = 0
  for (const v of w) top = Math.max(top, Math.abs(v))
  const out: number[] = []
  for (let i = 2; i < w.length - 2; i++) {
    if (w[i] > floor * top && w[i] >= w[i - 1] && w[i] > w[i + 1] && w[i] >= w[i - 2] && w[i] > w[i + 2] && (!out.length || i - out[out.length - 1] >= gap)) out.push(i)
  }
  return out
}
