import { useLayoutEffect, useRef, useState } from 'react'
import { METRICS, type Status } from '../data/types'
import { MISSION_START } from '../data/synthetic'
import { decimalsFor, tickLabel, trendSummary, type TrendSeries } from '../trends/series'

const PAD = { l: 40, r: 10, t: 12, b: 22 }

/**
 * The alert window as glowing bars (plan §4.4): one bar per reading, the personal band with dashed edges and a
 * dashed baseline, bars outside their band in the alert's colour and a trigger label on the crossing.
 * Plain SVG sized to its box, so the Alerts chunk does not need Recharts.
 */
export function AlertChart({ series, status, highlightTs }: { series: TrendSeries; status: Status; highlightTs?: number }) {
  const box = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ w: 0, h: 0 })
  useLayoutEffect(() => {
    const el = box.current
    if (!el) return
    const read = () => setSize({ w: el.clientWidth, h: el.clientHeight })
    read()
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(read)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const pts = series.points
  const def = METRICS[series.metric]
  const d = decimalsFor(series.metric)
  const { w, h } = size
  const draw = w > 80 && h > 60 && pts.length > 1

  let body = null
  if (draw) {
    const vals = pts.flatMap((p) => (p.band ? [p.value, p.band[0], p.band[1]] : [p.value]))
    let lo = Math.min(...vals)
    let hi = Math.max(...vals)
    const pad = (hi - lo || Math.abs(hi) || 1) * 0.1
    lo -= pad
    hi += pad
    const iw = w - PAD.l - PAD.r
    const ih = h - PAD.t - PAD.b
    const slot = iw / pts.length
    const cx = (i: number) => PAD.l + (i + 0.5) * slot
    const Y = (v: number) => PAD.t + (1 - (v - lo) / (hi - lo)) * ih
    const bw = Math.max(1, Math.min(24, slot * 0.6))
    const floor = PAD.t + ih
    const line = (pick: (b: [number, number]) => number) =>
      pts.map((p, i) => (p.band ? `${cx(i).toFixed(1)},${Y(pick(p.band)).toFixed(1)}` : '')).filter(Boolean).join(' ')
    const yTicks = Array.from({ length: 5 }, (_, k) => lo + ((hi - lo) * k) / 4)
    const xEvery = Math.max(1, Math.ceil(pts.length / 7))
    const rangeMs = pts[pts.length - 1].ts - pts[0].ts
    const hit = highlightTs === undefined ? -1 : pts.findIndex((p) => p.ts === highlightTs)
    // The baseline the alert was judged against: the band at the crossing, else the latest one.
    const refBand = pts[hit]?.band ?? [...pts].reverse().find((p) => p.band)?.band
    const baseline = refBand ? (refBand[0] + refBand[1]) / 2 : null
    body = (
      <svg width={w} height={h} aria-hidden="true">
        <defs>
          {/* CSS variables only resolve in style, not in presentation attributes */}
          <linearGradient id="ac-in" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style={{ stopColor: 'var(--cy)', stopOpacity: 0.8 }} /><stop offset="1" style={{ stopColor: 'var(--cy)', stopOpacity: 0.06 }} /></linearGradient>
          <linearGradient id="ac-out" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style={{ stopColor: 'var(--st)', stopOpacity: 0.95 }} /><stop offset="1" style={{ stopColor: 'var(--st)', stopOpacity: 0.08 }} /></linearGradient>
        </defs>
        {yTicks.map((v) => (
          <g key={v}>
            <line x1={PAD.l} x2={w - PAD.r} y1={Y(v)} y2={Y(v)} className="ac-grid" />
            <text x={PAD.l - 6} y={Y(v) + 4} textAnchor="end" className="ac-axis">{v.toFixed(d)}</text>
          </g>
        ))}
        {pts.map((p, i) => p.band && <rect key={p.ts} x={cx(i) - slot / 2} width={slot + 0.5} y={Y(p.band[1])} height={Math.max(0, Y(p.band[0]) - Y(p.band[1]))} className="ac-band" />)}
        <polyline points={line((b) => b[1])} className="ac-edge" />
        <polyline points={line((b) => b[0])} className="ac-edge" />
        <polyline points={line((b) => (b[0] + b[1]) / 2)} className="ac-edge" />
        <g className="ac-bars">
          {pts.map((p, i) => {
            const out = !!p.band && (p.value < p.band[0] || p.value > p.band[1])
            const y = Y(p.value)
            return <rect key={p.ts} x={cx(i) - bw / 2} width={bw} y={y} height={Math.max(1, floor - y)} fill={`url(#${out ? 'ac-out' : 'ac-in'})`} className={out ? 'out' : undefined} />
          })}
        </g>
        {pts.map((p, i) => (i % xEvery === 0 || i === pts.length - 1) && (pts.length - 1 - i >= xEvery / 2 || i === pts.length - 1)
          ? <text key={p.ts} x={cx(i)} y={h - 5} textAnchor="middle" className="ac-axis">{tickLabel(p.ts, rangeMs, MISSION_START)}</text>
          : null)}
        {baseline !== null && <text x={PAD.l + 6} y={Y(baseline) - 6} className="ac-base">BASELINE {baseline.toFixed(d)} {def.unit}</text>}
        {hit >= 0 && (
          <text x={cx(hit) + (hit > pts.length / 2 ? bw / 2 : -bw / 2)} y={Math.max(PAD.t + 10, Y(pts[hit].value) - 10)} textAnchor={hit > pts.length / 2 ? 'end' : 'start'} className="ac-trig">
            {pts[hit].value.toFixed(d)} {def.unit} · TRIGGER
          </text>
        )}
      </svg>
    )
  }
  return (
    <div ref={box} className={`ac st-${status}`} role="img" aria-label={trendSummary(series)}>
      {body}
    </div>
  )
}
