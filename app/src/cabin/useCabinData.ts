import { liveQuery } from 'dexie'
import { useEffect, useMemo, useState } from 'react'
import { DEFAULT_TARGETS, hashSeed, liveValues, stillValues, watchTargets, type LiveTargets } from '../live/telemetry'
import { useHidden, useReducedMotion } from '../live/usePaused'
import { useShellContext } from '../shell/useShellData'
import { loadCabinAlerts, loadCabinTrend, pickFocus, type CabinAlert, type CabinData, type CabinTrend } from './data'

/**
 * Everything the cabin shows, for the whole crew at once: the shell's statuses, live signals that follow
 * each member's latest readings (like the board's live vitals), the alert list and the focus member's trend.
 * Null until the shell has data.
 */
export function useCabinData(): CabinData | null {
  const shell = useShellContext()
  const reduced = useReducedMotion()
  const hidden = useHidden()
  const [targets, setTargets] = useState<Record<string, LiveTargets>>({})
  const [alerts, setAlerts] = useState<CabinAlert[]>([])
  const [trend, setTrend] = useState<CabinTrend | null>(null)
  const [tick, setTick] = useState(0)

  const crew = shell?.crew
  const ids = crew?.map((c) => c.id).join(',') ?? ''
  const names = useMemo(() => new Map((crew ?? []).map((c) => [c.id, c.name])), [crew])
  const focusId = crew && shell ? pickFocus(crew, shell.crewId) : null
  const now = shell?.now ?? 0

  useEffect(() => {
    if (!ids) return
    const subs = ids.split(',').map((id) => watchTargets(id, (t) => setTargets((m) => ({ ...m, [id]: t })), () => undefined))
    return () => subs.forEach((s) => s.unsubscribe())
  }, [ids])

  useEffect(() => {
    if (!ids) return
    const sub = liveQuery(() => loadCabinAlerts(names)).subscribe({ next: setAlerts, error: () => setAlerts([]) })
    return () => sub.unsubscribe()
  }, [ids, names])

  useEffect(() => {
    if (!focusId || !now) return
    const sub = liveQuery(() => loadCabinTrend(focusId, now)).subscribe({ next: setTrend, error: () => setTrend(null) })
    return () => sub.unsubscribe()
  }, [focusId, now])

  const paused = reduced || hidden
  useEffect(() => {
    if (paused) return
    const id = setInterval(() => setTick((n) => n + 1), 1000)
    return () => clearInterval(id)
  }, [paused])

  return useMemo(() => {
    if (!shell || !crew || !focusId) return null
    const t = Date.now() / 1000
    return {
      crew: crew.map((c) => {
        const tg = targets[c.id] ?? DEFAULT_TARGETS
        return { id: c.id, name: c.name, role: c.role, status: c.status, alerts: c.alerts, live: reduced ? stillValues(tg) : liveValues(tg, t, hashSeed(c.id)) }
      }),
      focusId,
      selfId: shell.crewId,
      alerts,
      trend,
    }
    // `tick` re-evaluates the wobble once a second.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shell, crew, focusId, targets, alerts, trend, reduced, tick])
}
