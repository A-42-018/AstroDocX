import { useEffect, useMemo, useState } from 'react'
import { useWatch } from '../watch/store'
import { DEFAULT_TARGETS, hashSeed, liveValues, stillValues, watchTargets, type LiveTargets, type LiveValues } from './telemetry'
import { useHidden, useReducedMotion } from './usePaused'

export interface LiveTelemetry {
  /** Real readings from the engine; the live signals are built around these. */
  targets: LiveTargets
  /** Simulated high-rate values (about 1 per second). Equal to the real values when motion is reduced. */
  values: LiveValues
  seed: number
  /** True when animation should stop: reduced motion or a background tab. */
  paused: boolean
  /** Where each live number comes from: the simulated signal, or a connected watch that is sending it right now. */
  source: { hr: 'sim' | 'watch'; spo2: 'sim' | 'watch' }
}

/**
 * Simulated live telemetry for one crew member. It follows the latest real readings and never writes to
 * the database or raises alerts: the engine stays the single source of truth.
 * While a Bluetooth watch is connected and sending, its heart rate (and SpO₂, if it sends one) replace the
 * simulated number and drive the heart trace. They are shown, never stored.
 */
export function useLiveTelemetry(crewId: string): LiveTelemetry {
  const [engine, setTargets] = useState<LiveTargets>(DEFAULT_TARGETS)
  const watchHr = useWatch((s) => s.hr)
  const watchSpo2 = useWatch((s) => s.spo2)
  const [tick, setTick] = useState(0)
  const reduced = useReducedMotion()
  const hidden = useHidden()
  const seed = useMemo(() => hashSeed(crewId), [crewId])
  const paused = reduced || hidden

  useEffect(() => {
    const sub = watchTargets(crewId, setTargets, () => setTargets(DEFAULT_TARGETS))
    return () => sub.unsubscribe()
  }, [crewId])

  useEffect(() => {
    if (paused) return
    const id = setInterval(() => setTick((n) => n + 1), 1000)
    return () => clearInterval(id)
  }, [paused])

  const targets = useMemo<LiveTargets>(
    () => ({ ...engine, ...(watchHr !== null && { hr: watchHr }), ...(watchSpo2 !== null && { spo2: watchSpo2 }) }),
    [engine, watchHr, watchSpo2],
  )
  // The wall clock drives the wobble; `tick` re-evaluates it once a second. A watch reading is shown exactly, with no wobble.
  const values = useMemo<LiveValues>(() => {
    const v = reduced ? stillValues(targets) : liveValues(targets, Date.now() / 1000, seed)
    return { ...v, ...(watchHr !== null && { hr: watchHr }), ...(watchSpo2 !== null && { spo2: watchSpo2 }) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targets, seed, reduced, tick, watchHr, watchSpo2])
  const source = { hr: watchHr !== null ? 'watch' : 'sim', spo2: watchSpo2 !== null ? 'watch' : 'sim' } as const
  return { targets, values, seed, paused, source }
}
