import type { ReactNode } from 'react'
import type { Status } from '../data/types'

export type SegOption<T extends string> = { id: T; label: ReactNode; count?: number; status?: Status }

/**
 * Segmented control: a bordered strip of toggle buttons (aria-pressed), one active.
 * With counts it becomes the stacked Alerts variant (count above the label).
 */
export function Segmented<T extends string>({ label, options, value, onChange, className }:
  { label: string; options: SegOption<T>[]; value: T; onChange: (id: T) => void; className?: string }) {
  const stacked = options.some((o) => o.count !== undefined)
  return (
    <div role="group" aria-label={label} className={['seg', stacked && 'seg-stacked', className].filter(Boolean).join(' ')}>
      {options.map((o) => (
        <button key={o.id} type="button" className={value === o.id ? 'on' : undefined} aria-pressed={value === o.id} onClick={() => onChange(o.id)}>
          {o.count !== undefined && <b className={o.status ? `st-${o.status}` : undefined}>{o.count}</b>}
          <span>{o.label}</span>
        </button>
      ))}
    </div>
  )
}
