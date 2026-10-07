import { useEffect, useMemo, useState } from 'react'
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
}

/**
 * Simulated live telemetry for one crew member. It follows the latest real readings and never writes to
 * the database or raises alerts: the engine stays the single source of truth.
 */
export function useLiveTelemetry(crewId: string): LiveTelemetry {
  const [targets, setTargets] = useState<LiveTargets>(DEFAULT_TARGETS)
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

  // The wall clock drives the wobble; `tick` re-evaluates it once a second.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const values = useMemo(() => (reduced ? stillValues(targets) : liveValues(targets, Date.now() / 1000, seed)), [targets, seed, reduced, tick])
  return { targets, values, seed, paused }
}
