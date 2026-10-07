import type { MetricId, Status } from '../data/types'

/**
 * Absolute limits. Only values with a citation are treated as standards; the rest are labelled illustrative.
 *
 * - CO2: NASA-STD-3001 Vol. 2 [V2 6004] limits the average 1-hour habitat ppCO2 to 3 mmHg
 *   (https://www.nasa.gov/wp-content/uploads/2023/12/ochmo-tb-004-carbon-dioxide.pdf).
 * - Radiation: NASA-STD-3001 Vol. 1 career effective dose 600 mSv; solar particle event effective dose 250 mSv per event
 *   (https://www.nasa.gov/wp-content/uploads/2023/03/radiation-protection-technical-brief-ochmo.pdf).
 */
export const CO2_LIMIT_MMHG = 3.0
/** Illustrative: an instantaneous reading this high is treated as an emergency regardless of duration. */
export const CO2_EMERGENCY_MMHG = 4.5
/** Hourly readings above the limit needed before alerting (single noisy hours are ignored). */
export const CO2_WATCH_HOURS = 3
export const CO2_ACT_HOURS = 6
export const CAREER_DOSE_MSV = 600
export const SPE_DOSE_MSV = 250

export interface LimitResult {
  status: Status
  reason: string
}

const NONE: LimitResult = { status: 'nominal', reason: '' }

/** `run` = consecutive hourly readings (including this one) above the CO2 limit. */
export function co2Limit(value: number, run: number): LimitResult {
  if (value >= CO2_EMERGENCY_MMHG)
    return { status: 'act', reason: `CO₂ ${value.toFixed(2)} mmHg is above the ${CO2_EMERGENCY_MMHG} mmHg emergency level (illustrative).` }
  const over = `exceeded the ${CO2_LIMIT_MMHG} mmHg habitat limit (NASA-STD-3001 Vol. 2, V2 6004)`
  if (run >= CO2_ACT_HOURS) return { status: 'act', reason: `CO₂ has ${over} for ${run} consecutive hours (latest ${value.toFixed(2)} mmHg).` }
  if (run >= CO2_WATCH_HOURS) return { status: 'watch', reason: `CO₂ has ${over} for ${run} consecutive hours (latest ${value.toFixed(2)} mmHg).` }
  return NONE
}

/** Rolling 24-hour dose in mSv versus the 250 mSv per-event limit: Watch at half, Act at the limit. */
export function eventDoseLimit(doseMsv24h: number): LimitResult {
  const txt = `Dose over the last 24 h is ${doseMsv24h.toFixed(1)} mSv against the ${SPE_DOSE_MSV} mSv per-event limit (NASA-STD-3001 Vol. 1).`
  if (doseMsv24h >= SPE_DOSE_MSV) return { status: 'act', reason: txt }
  if (doseMsv24h >= SPE_DOSE_MSV / 2) return { status: 'watch', reason: txt }
  return NONE
}

export const hasAbsoluteLimit = (m: MetricId) => m === 'co2' || m === 'dose'
