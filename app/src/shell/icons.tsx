import { Brain, CircleCheck, Dumbbell, OctagonAlert, Radiation, Satellite, TriangleAlert, Wind, type LucideIcon } from 'lucide-react'
import type { Hazard, Status } from '../data/types'

const HAZARD_ICON: Record<Hazard, LucideIcon> = { R: Radiation, I: Brain, D: Satellite, G: Dumbbell, E: Wind }
const STATUS_ICON: Record<Status, LucideIcon> = { nominal: CircleCheck, watch: TriangleAlert, act: OctagonAlert }
const STATUS_LABEL: Record<Status, string> = { nominal: 'NOMINAL', watch: 'WATCH', act: 'ACT' }

/** Hazard chip: the RIDGE icon, with the letter kept for screen readers and as a tooltip. */
export function HazardIcon({ hazard, status }: { hazard: Hazard; status?: Status }) {
  const Icon = HAZARD_ICON[hazard]
  return (
    <span className={status ? `hz st-${status}` : 'hz hz-data'} title={`RIDGE ${hazard}`}>
      <Icon size={16} strokeWidth={2} aria-hidden="true" />
      <span className="sr-only">{hazard}</span>
    </span>
  )
}

/** Status pill: never colour alone, always an icon plus the word. */
export function StatusPill({ status, label = STATUS_LABEL[status] }: { status: Status; label?: string }) {
  const Icon = STATUS_ICON[status]
  return (
    <span className={`badge st-${status}`}>
      <Icon size={12} strokeWidth={2.5} aria-hidden="true" />
      {label}
    </span>
  )
}
