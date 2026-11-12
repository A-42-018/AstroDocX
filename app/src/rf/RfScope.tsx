import { useEffect, useRef } from 'react'
import { useHidden, useReducedMotion } from '../live/usePaused'
import { CSI_HZ, N_SC } from './csi'
import { WATERFALL_COLS, type RfFeed } from './feed'
import { WINDOW_S } from './dsp'
import { breathPeaks } from './peaks'

const FPS = 30
const css = (el: Element, name: string, fallback: string) => getComputedStyle(el).getPropertyValue(name).trim() || fallback

function sizeTo(cv: HTMLCanvasElement, h: number) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  const box = cv.getBoundingClientRect()
  const w = Math.max(1, Math.floor(box.width))
  cv.width = Math.floor(w * dpr); cv.height = Math.floor(h * dpr)
  const ctx = cv.getContext('2d')!
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  return { ctx, w, h }
}

/** Waterfall colour: dark for no change, cyan for a rise, magenta for a dip. */
function shade(v: number): [number, number, number] {
  const t = Math.max(-1, Math.min(1, v))
  if (t >= 0) return [8 + 150 * t, 24 + 200 * t, 36 + 215 * t]
  return [8 - 100 * t, 24 + 10 * -t, 36 - 120 * t]
}

function drawWaterfall(off: HTMLCanvasElement, feed: RfFeed, size: { ctx: CanvasRenderingContext2D; w: number; h: number }) {
  const octx = off.getContext('2d')!
  const img = octx.createImageData(WATERFALL_COLS, N_SC)
  const cols = feed.waterfall
  const start = WATERFALL_COLS - cols.length
  for (let c = 0; c < WATERFALL_COLS; c++) {
    const col = cols[c - start]
    for (let k = 0; k < N_SC; k++) {
      const [r, g, b] = col ? shade(col[k]) : [4, 12, 18]
      const p = (k * WATERFALL_COLS + c) * 4
      img.data[p] = r; img.data[p + 1] = g; img.data[p + 2] = b; img.data[p + 3] = 255
    }
  }
  octx.putImageData(img, 0, 0)
  const { ctx, w, h } = size
  ctx.imageSmoothingEnabled = true
  ctx.drawImage(off, 0, 0, w, h)
}

function drawIq(feed: RfFeed, size: { ctx: CanvasRenderingContext2D; w: number; h: number }, color: string) {
  const { ctx, w, h } = size
  ctx.clearRect(0, 0, w, h)
  const cx = w / 2, cy = h / 2, R = Math.min(w, h) / 2 - 6
  if (R < 8) return // not laid out yet
  ctx.strokeStyle = 'rgba(70,225,245,0.18)'; ctx.lineWidth = 1
  for (const r of [0.33, 0.66, 1]) { ctx.beginPath(); ctx.arc(cx, cy, R * r, 0, Math.PI * 2); ctx.stroke() }
  ctx.beginPath(); ctx.moveTo(cx - R, cy); ctx.lineTo(cx + R, cy); ctx.moveTo(cx, cy - R); ctx.lineTo(cx, cy + R); ctx.stroke()
  const pts = feed.iq
  if (pts.length < 2) return
  let m = 0
  for (const [x, y] of pts) m = Math.max(m, Math.hypot(x, y))
  const sc = R / Math.max(m, 0.02)
  ctx.lineCap = 'round'; ctx.lineWidth = 1.6
  for (let i = 1; i < pts.length; i++) {
    ctx.globalAlpha = (i / pts.length) ** 2
    ctx.strokeStyle = color
    ctx.beginPath()
    ctx.moveTo(cx + pts[i - 1][0] * sc, cy - pts[i - 1][1] * sc)
    ctx.lineTo(cx + pts[i][0] * sc, cy - pts[i][1] * sc)
    ctx.stroke()
  }
  ctx.globalAlpha = 1
  const last = pts[pts.length - 1]
  ctx.fillStyle = color; ctx.shadowColor = color; ctx.shadowBlur = 10
  ctx.beginPath(); ctx.arc(cx + last[0] * sc, cy - last[1] * sc, 3.2, 0, Math.PI * 2); ctx.fill()
  ctx.shadowBlur = 0
}

function drawWave(feed: RfFeed, size: { ctx: CanvasRenderingContext2D; w: number; h: number }, color: string, accent: string) {
  const { ctx, w, h } = size
  ctx.clearRect(0, 0, w, h)
  ctx.strokeStyle = 'rgba(70,225,245,0.14)'; ctx.lineWidth = 1
  ctx.beginPath(); ctx.moveTo(0, h / 2); ctx.lineTo(w, h / 2); ctx.stroke()
  const wave = feed.estimateNow?.wave
  if (!wave || wave.length < 4) return
  const pps = w / WINDOW_S
  let top = 0
  for (const v of wave) top = Math.max(top, Math.abs(v))
  if (top === 0) return
  const n = wave.length
  const x = (i: number) => w - ((n - 1 - i) / CSI_HZ + feed.sinceEstimate) * pps
  const y = (v: number) => h / 2 - (v / top) * (h / 2 - 8)
  ctx.strokeStyle = color; ctx.lineWidth = 1.8; ctx.lineJoin = 'round'; ctx.shadowColor = color; ctx.shadowBlur = 6
  ctx.beginPath()
  for (let i = 0; i < n; i++) { if (i === 0) ctx.moveTo(x(i), y(wave[i])); else ctx.lineTo(x(i), y(wave[i])) }
  ctx.stroke(); ctx.shadowBlur = 0
  // a mark on every breath the estimator counted
  if (feed.estimateNow?.breathsPerMin != null) {
    ctx.fillStyle = accent
    for (const i of breathPeaks(wave)) { ctx.beginPath(); ctx.arc(x(i), y(wave[i]), 3.4, 0, Math.PI * 2); ctx.fill() }
  }
}

interface Props { feed: RfFeed; onEstimate: () => void; version: number }

/**
 * The three live pictures of the Wi-Fi channel: the subcarrier waterfall, the I/Q arc of the CSI ratio and the extracted
 * breathing wave. One animation loop advances the simulation and redraws all three. Decorative (aria-hidden):
 * the readouts beside them carry the numbers. Pauses in a background tab; with reduced motion it draws one still frame.
 */
export function RfScope({ feed, onEstimate, version }: Props) {
  const wf = useRef<HTMLCanvasElement>(null)
  const iq = useRef<HTMLCanvasElement>(null)
  const wv = useRef<HTMLCanvasElement>(null)
  const reduced = useReducedMotion()
  const hidden = useHidden()
  const cb = useRef(onEstimate)
  useEffect(() => { cb.current = onEstimate })

  useEffect(() => {
    const a = wf.current, b = iq.current, c = wv.current
    if (!a || !b || !c || !a.getContext('2d')) return
    const color = css(c, '--data', '#2dd4e8')
    const accent = css(c, '--watch', '#ffc53d')
    const off = document.createElement('canvas'); off.width = WATERFALL_COLS; off.height = N_SC
    let sa = sizeTo(a, 150), sb = sizeTo(b, 150), sc = sizeTo(c, 110)
    let raf = 0, last = 0, seen = feed.estimateNow
    const draw = () => { drawWaterfall(off, feed, sa); drawIq(feed, sb, color); drawWave(feed, sc, color, accent) }
    const resize = () => { sa = sizeTo(a, 150); sb = sizeTo(b, 150); sc = sizeTo(c, 110); draw() }
    draw()
    if (reduced || hidden) return
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null
    ro?.observe(a); ro?.observe(b); ro?.observe(c)
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame)
      if (now - last < 1000 / FPS - 1) return
      const dt = Math.min((now - last) / 1000, 0.25)
      last = now
      feed.advance(dt)
      if (feed.estimateNow !== seen) { seen = feed.estimateNow; cb.current() }
      draw()
    }
    last = performance.now()
    raf = requestAnimationFrame(frame)
    return () => { cancelAnimationFrame(raf); ro?.disconnect() }
  }, [feed, reduced, hidden, version])

  return (
    <div className="rf-scope" aria-hidden="true">
      <figure className="rf-fig rf-fig-wide"><figcaption>CSI waterfall · 52 subcarriers × 8 s</figcaption><canvas ref={wf} className="rf-cv" style={{ height: 150 }} /></figure>
      <figure className="rf-fig"><figcaption>Ratio trajectory (I/Q)</figcaption><canvas ref={iq} className="rf-cv" style={{ height: 150 }} /></figure>
      <figure className="rf-fig rf-fig-full"><figcaption>Extracted breathing · last 30 s</figcaption><canvas ref={wv} className="rf-cv" style={{ height: 110 }} /></figure>
    </div>
  )
}
