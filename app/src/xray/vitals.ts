/**
 * Vital signs in the mirror: the same camera-pulse (rPPG) pipeline as the Face Scan (src/scan), fed from the mirror's
 * own video instead of a second camera. The skin patches follow the face (forehead and both cheeks, placed from the
 * face landmarks), so the person does not have to line up with an oval. Frames are reduced to three average colours
 * and dropped; nothing is stored or sent.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { measureFrame as measureSkin, type FrameMeasure, type Rect } from '../scan/roi'
import { ScanSession, type SessionView } from '../scan/session'
import type { TrackFrame } from './useTracker'

/** The video is read at this size: a face patch of about 12 x 8 pixels is enough for an average colour. */
const W = 256, H = 144

/** MediaPipe face-mesh points: forehead centre, the two cheeks, and the two edges of the face. */
const FOREHEAD = 151, CHEEK_L = 205, CHEEK_R = 425, EDGE_L = 234, EDGE_R = 454, TOP = 10, CHIN = 152

/** Nothing to read: reports a frame with no skin, so the session says "no face" and restarts a run after a gap. */
const EMPTY: FrameMeasure = { r: 0, g: 0, b: 0, skin: 0, luma: 128, clipped: 0, cx: null, cy: null }

const clamp = (x: number) => Math.min(1, Math.max(0, x))

/** The three skin patches and the face box, as fractions of the video frame, from the face landmarks. Null if too few points. */
export function faceRegions(lm: ArrayLike<{ x: number; y: number }>): { rois: Rect[]; area: Rect } | null {
  const need = [FOREHEAD, CHEEK_L, CHEEK_R, EDGE_L, EDGE_R, TOP, CHIN]
  if (need.some((i) => !lm[i])) return null
  const width = Math.abs(lm[EDGE_R].x - lm[EDGE_L].x)
  if (width < 0.02) return null
  const box = (p: { x: number; y: number }, hw: number, hh: number): Rect => ({ x0: clamp(p.x - hw), x1: clamp(p.x + hw), y0: clamp(p.y - hh), y1: clamp(p.y + hh) })
  const pw = width * 0.13, ph = width * 0.09
  const forehead = { x: lm[FOREHEAD].x, y: lm[FOREHEAD].y + (lm[TOP].y - lm[FOREHEAD].y) * -0.15 }
  const pad = width * 0.1
  return {
    rois: [box(forehead, pw * 1.3, ph * 0.9), box(lm[CHEEK_L], pw, ph), box(lm[CHEEK_R], pw, ph)],
    area: { x0: clamp(Math.min(lm[EDGE_L].x, lm[EDGE_R].x) - pad), x1: clamp(Math.max(lm[EDGE_L].x, lm[EDGE_R].x) + pad), y0: clamp(lm[TOP].y - pad), y1: clamp(lm[CHIN].y + pad) },
  }
}

/** The scan session for the mirror: `feed` it every tracked frame, read `view` for the numbers. */
export function useVitals(active: boolean) {
  const [view, setView] = useState<SessionView>(ScanSession.initial)
  const session = useRef(new ScanSession())
  const canvas = useRef<{ c: HTMLCanvasElement; ctx: CanvasRenderingContext2D } | null>(null)
  const on = useRef(active)
  useEffect(() => { on.current = active }, [active])

  const again = useCallback(() => { session.current = new ScanSession(); setView(session.current.state) }, [])

  const feed = useCallback((f: TrackFrame) => {
    if (!on.current || session.current.state.phase === 'done') return
    let m = EMPTY
    const regions = f.face && f.video ? faceRegions(f.face.lm) : null
    if (regions && f.video) {
      if (!canvas.current) {
        const c = document.createElement('canvas'); c.width = W; c.height = H
        const ctx = c.getContext('2d', { willReadFrequently: true })
        if (ctx) canvas.current = { c, ctx }
      }
      const k = canvas.current
      if (k) {
        k.ctx.drawImage(f.video, 0, 0, W, H)
        m = measureSkin(k.ctx.getImageData(0, 0, W, H).data, W, H, regions.rois, regions.area)
      }
    }
    if (session.current.feed(m, f.now)) setView(session.current.state)
  }, [])

  return { view, feed, again }
}
