import { useEffect, useRef, useState } from 'react'
import { HAZARDS } from '../board/snapshot'
import { drawMiniBody, HAZARD_INDEX, loadBody, turned, twinRenderer, type Body3D } from '../board/body3d'
import type { Hazard, Status } from '../data/types'
import { STATUS_SHORT } from '../ui'
import type { TrendSeries } from './series'

/** Sparkline of a series in a w × h box; with `band`, the latest personal band is drawn as a strip behind it. */
export function Spark({ s, w, h, band = false, className }: { s: TrendSeries; w: number; h: number; band?: boolean; className?: string }) {
  const pts = s.points
  if (pts.length < 2) return <svg className={className} viewBox={`0 0 ${w} ${h}`} aria-hidden="true" />
  const last = [...pts].reverse().find((p) => p.band)?.band
  const vals = pts.map((p) => p.value).concat(band && last ? last : [])
  const lo = Math.min(...vals), hi = Math.max(...vals), span = hi - lo || 1
  const X = (i: number) => (i / (pts.length - 1)) * w
  const Y = (v: number) => 1.5 + (1 - (v - lo) / span) * (h - 3)
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)} ${Y(p.value).toFixed(1)}`).join('')
  return (
    <svg className={className} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden="true">
      {band && last && <rect x="0" width={w} y={Y(last[1])} height={Math.max(1, Y(last[0]) - Y(last[1]))} className="sp-band" />}
      {band && <path d={`${line}L${w} ${h}L0 ${h}Z`} className="sp-area" />}
      <path d={line} className="sp-line" vectorEffect="non-scaling-stroke" />
    </svg>
  )
}

const ANG = 0.12

/**
 * Body region (plan §4.3): the twin's particles from the front with the focused metric's hazard region lit in
 * its status colour, and one callout. Drawn once per change (no animation loop); without WebGL it falls back
 * to the flat 2D figure Ground uses, tinted by the status.
 */
export function BodyRegion({ hazard, status }: { hazard: Hazard; status: Status }) {
  const [body, setBody] = useState<Body3D | null>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  useEffect(() => { let on = true; void loadBody().then((b) => { if (on) setBody(b) }); return () => { on = false } }, [])
  useEffect(() => {
    const el = canvas.current
    if (!body || !el) return
    let r: ReturnType<typeof twinRenderer> | null = null
    try { r = twinRenderer(el, body) } catch { r = null }
    const paint = () => {
      if (r) { r.resize(); r.setStatus({ [hazard]: status }); r.draw(0, ANG, 9, HAZARD_INDEX[hazard], -1) }
      else drawMiniBody(el, body, getComputedStyle(el).getPropertyValue('--st').trim() || '#36e2f5')
    }
    paint()
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(paint)
    ro?.observe(el)
    return () => { ro?.disconnect(); r?.dispose() }
  }, [body, hazard, status])
  const name = HAZARDS.find((h) => h.id === hazard)?.name ?? hazard
  const [ax, ay] = body ? turned(body.anchors[hazard], ANG) : [150, 330]
  return (
    <div className={`br-bay st-${status}`}>
      <div className="br-fig">
        {body && <canvas ref={canvas} className="br-canvas" aria-hidden="true" />}
        <svg viewBox="0 0 300 660" className="br-lead" aria-hidden="true">
          <circle cx={ax} cy={ay} r="14" className="br-ring" />
          <circle cx={ax} cy={ay} r="4" className="br-dot" />
          <path d={`M${ax + 14} ${ay}H300`} className="br-line" />
        </svg>
        <p className="br-call" style={{ top: `${(ay / 660) * 100}%` }}>{name} · {STATUS_SHORT[status]}</p>
      </div>
    </div>
  )
}
