import type { Status } from '../data/types'
import { Gauge } from '../ui/Gauge'
import { STATUS_WORD } from '../ui/status'

/** Readiness dial (v3): the shared Gauge, named with the value and status in words. */
export function ReadinessRing({ value, status }: { value: number; status: Status }) {
  return <Gauge kind="dial" value={value} unit="%" status={status} label={`Crew readiness ${value} percent, ${STATUS_WORD[status]}`} />
}
