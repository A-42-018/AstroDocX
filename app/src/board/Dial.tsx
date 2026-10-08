import type { Status } from '../data/types'
import { StatusPill } from '../shell/icons'

const LABEL: Record<Status, string> = { nominal: 'NOMINAL', watch: 'WATCH', act: 'ACT' }
const CX = 60
const CY = 62
const R = 46
const START = 150 // degrees clockwise from +x; the dial sweeps 240° up and over to 30°
const pt = (deg: number, r = R) => [CX + r * Math.cos((deg * Math.PI) / 180), CY + r * Math.sin((deg * Math.PI) / 180)]

/** Readiness speed-dial: a 240° arc, tick marks, an animated needle and the value. */
export function ReadinessRing({ value, status, heldBy }: { value: number; status: Status; heldBy?: { name: string; status: Status } | null }) {
  const [x0, y0] = pt(START)
  const [x1, y1] = pt(START + 240)
  const arc = `M${x0.toFixed(2)} ${y0.toFixed(2)}A${R} ${R} 0 1 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`
  const angle = START + 2.4 * Math.max(0, Math.min(100, value))
  return (
    <figure className={`ring dial st-${status}`} aria-label={`Crew readiness ${value} percent, ${LABEL[status]}`}>
      <svg viewBox="0 0 120 100" role="img" aria-hidden="true">
        <path d={arc} pathLength={100} className="ring-track" />
        <path d={arc} pathLength={100} className="ring-fill" strokeDasharray={`${value} 100`} />
        {[0, 25, 50, 75, 100].map((v) => {
          const [ax, ay] = pt(START + 2.4 * v, R + 8)
          const [bx, by] = pt(START + 2.4 * v, R + 3)
          return <line key={v} x1={ax} y1={ay} x2={bx} y2={by} className="dial-tick" />
        })}
        <g className="dial-needle" style={{ transform: `rotate(${angle}deg)`, transformOrigin: `${CX}px ${CY}px` }}>
          <line x1={CX} y1={CY} x2={CX + R - 8} y2={CY} />
        </g>
        <circle cx={CX} cy={CY} r="4.5" className="dial-hub" />
      </svg>
      <figcaption>
        <b className="mono">{value}%</b>
        <StatusPill status={status} />
      </figcaption>
      {heldBy && (
        <p className={`dial-held mono st-${heldBy.status}`}>
          Held back by: {heldBy.name} (<b>{heldBy.status === 'act' ? 'Act' : 'Watch'}</b>)
        </p>
      )}
    </figure>
  )
}
