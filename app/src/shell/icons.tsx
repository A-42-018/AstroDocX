import { Brain, Dumbbell, Radiation, Satellite, Wind, type LucideIcon } from 'lucide-react'
import type { Hazard, Status } from '../data/types'
import { StatusTag } from '../ui/StatusTag'

const HAZARD_ICON: Record<Hazard, LucideIcon> = { R: Radiation, I: Brain, D: Satellite, G: Dumbbell, E: Wind }

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

/** v2 name for the status tag; every screen still imports it from here until Phase 10. */
export const StatusPill = StatusTag
