import type { ReactNode } from 'react'
import type { Status } from '../data/types'

/** KPI cell: a dark well with a corner tick, a mono label and a display-face value. Use inside `<KpiGrid>` (a `<dl>`). */
export function KpiCell({ label, value, status, sub, className }: { label: ReactNode; value: ReactNode; status?: Status; sub?: ReactNode; className?: string }) {
  return (
    <div className={['kpi', status && `st-${status}`, className].filter(Boolean).join(' ')}>
      <dt>{label}</dt>
      <dd>{value}{sub !== undefined && <small>{sub}</small>}</dd>
    </div>
  )
}

export function KpiGrid({ children }: { children: ReactNode }) {
  return <dl className="kpis">{children}</dl>
}

/**
 * Instrument readout: value + unit, an optional σ delta against the person's own baseline and a meta line.
 * Sizes: hero (58–72 px), l (30 px), m (22 px).
 */
export function Readout({ value, unit, delta, meta, size = 'm', status }:
  { value: ReactNode; unit?: ReactNode; delta?: ReactNode; meta?: ReactNode; size?: 'hero' | 'l' | 'm'; status?: Status }) {
  return (
    <p className={`readout readout-${size}${status ? ` st-${status}` : ''}`}>
      <span className="ro-value">{value}</span>
      {unit !== undefined && <span className="ro-unit">{unit}</span>}
      {delta !== undefined && <span className="ro-delta">{delta}</span>}
      {meta !== undefined && <span className="ro-meta">{meta}</span>}
    </p>
  )
}
