import { useId, type ReactNode } from 'react'
import type { Status } from '../data/types'
import { STATUS_WORD } from './status'
import { StatusTag } from './StatusTag'

const clamp = (v: number) => Math.max(0, Math.min(100, v))
const f = (n: number) => n.toFixed(2)

// Dial (mockup board.html): a 250° arc from -215° to 35°, 41 ticks just outside it.
const D = { cx: 140, cy: 118, r: 104, start: -215, sweep: 250, ticks: 40 }
const dpt = (deg: number, r: number) => [D.cx + r * Math.cos((deg * Math.PI) / 180), D.cy + r * Math.sin((deg * Math.PI) / 180)]
const [dx0, dy0] = dpt(D.start, D.r)
const [dx1, dy1] = dpt(D.start + D.sweep, D.r)
const DIAL_ARC = `M${f(dx0)} ${f(dy0)}A${D.r} ${D.r} 0 1 1 ${f(dx1)} ${f(dy1)}`
const [ox0, oy0] = dpt(D.start, D.r + 22)
const [ox1, oy1] = dpt(D.start + D.sweep, D.r + 22)
const DIAL_OUTER = `M${f(ox0)} ${f(oy0)}A${D.r + 22} ${D.r + 22} 0 1 1 ${f(ox1)} ${f(oy1)}`

// Ring (mockup trends.html): a full circle with 60 minor/major ticks.
const R = { cx: 130, cy: 105, r: 84, ticks: 60 }

type GaugeProps = {
  kind: 'dial' | 'ring'
  /** Fill, 0–100. */
  value: number
  /** What the centre shows; defaults to the rounded value. */
  display?: ReactNode
  unit?: ReactNode
  status?: Status
  /** Ring only: the word under the value (IN BAND, ABOVE BAND…). Defaults to the status word. */
  word?: string
  /** The gauge is one image to assistive tech; this is its name, so include the value and status in words. */
  label: string
}

/**
 * Gauge (plan §3.5): `dial` for readiness (value + status tag in the centre), `ring` for a latest value with a
 * status word. Drawn in SVG; the glow is a drop-shadow on the arc, so it is not clipped by a panel's chamfer.
 */
export function Gauge({ kind, value, display, unit, status, word, label }: GaugeProps) {
  const gid = useId()
  const v = clamp(value)
  const centre = (
    <div className="gauge-in" aria-hidden="true">
      <b className="gauge-val">{display ?? Math.round(v)}{unit !== undefined && <small>{unit}</small>}</b>
      {kind === 'dial' && status && <StatusTag status={status} />}
      {kind === 'ring' && (word || status) && <span className={`gauge-word${status ? ` st-${status}` : ''}`}>{word ?? STATUS_WORD[status!]}</span>}
    </div>
  )
  if (kind === 'dial') {
    const lit = Math.round((v / 100) * D.ticks)
    return (
      <figure className={`gauge gauge-dial${status ? ` st-${status}` : ''}`} role="img" aria-label={label}>
        <svg viewBox="0 0 280 220" aria-hidden="true">
          <defs><linearGradient id={gid} x1="0" x2="1"><stop offset="0" stopColor="#1a8fb0" /><stop offset="1" stopColor="#7ff2ff" /></linearGradient></defs>
          {Array.from({ length: D.ticks + 1 }, (_, i) => {
            const a = D.start + (i * D.sweep) / D.ticks
            const [x1, y1] = dpt(a, i % 5 ? 116 : 112)
            const [x2, y2] = dpt(a, 122)
            return <line key={i} x1={f(x1)} y1={f(y1)} x2={f(x2)} y2={f(y2)} className={`gauge-tick${i % 5 ? '' : ' major'}${i <= lit ? ' lit' : ''}`} />
          })}
          <path d={DIAL_ARC} className="gauge-track" />
          <path d={DIAL_ARC} className="gauge-arc" pathLength={100} strokeDasharray={`${v} 100`} stroke={`url(#${gid})`} />
          <path d={DIAL_OUTER} className="gauge-dots" />
          <circle cx={D.cx} cy={D.cy} r="70" className="gauge-inner" />
        </svg>
        {centre}
      </figure>
    )
  }
  return (
    <figure className={`gauge gauge-ring${status ? ` st-${status}` : ''}`} role="img" aria-label={label}>
      <svg viewBox="0 0 260 210" aria-hidden="true">
        {Array.from({ length: R.ticks }, (_, i) => {
          const a = (i / R.ticks) * Math.PI * 2
          const r1 = i % 5 ? 96 : 92
          return <line key={i} x1={f(R.cx + Math.cos(a) * r1)} y1={f(R.cy + Math.sin(a) * r1)} x2={f(R.cx + Math.cos(a) * 101)} y2={f(R.cy + Math.sin(a) * 101)} className={`gauge-tick${i % 5 ? '' : ' major'}`} />
        })}
        <circle cx={R.cx} cy={R.cy} r={R.r} className="gauge-track" />
        <circle cx={R.cx} cy={R.cy} r={R.r} className="gauge-arc" pathLength={100} strokeDasharray={`${v} 100`} transform={`rotate(-90 ${R.cx} ${R.cy})`} />
        <circle cx={R.cx} cy={R.cy} r="66" className="gauge-inner" />
      </svg>
      {centre}
    </figure>
  )
}
