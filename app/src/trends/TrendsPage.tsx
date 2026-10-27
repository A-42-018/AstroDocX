import { liveQuery } from 'dexie'
import { useEffect, useMemo, useState } from 'react'
import { useSnapshot } from '../board/hooks'
import { useBoard } from '../board/store'
import type { MetricId, Status } from '../data/types'
import { StateView } from '../ui/StateView'
import { loadCrewMetric, loadTrendData, type TrendData } from './data'
import { RANGES, alertsForMetric, buildSeries, crewMedian, CHART_METRICS, type RangeId } from './series'
import { TrendsView } from './TrendsView'

export default function TrendsPage() {
  const snap = useSnapshot()
  const boot = useBoard((s) => s.boot)
  const [range, setRange] = useState<RangeId>('7d')
  const [focus, setFocus] = useState<MetricId>('hr')
  const [compare, setCompare] = useState(false)
  const [data, setData] = useState<TrendData | null>(null)
  const [median, setMedian] = useState<{ ts: number; value: number }[] | undefined>(undefined)
  const crewId = snap?.crewId
  const now = data?.now
  useEffect(() => {
    if (!crewId) return
    const sub = liveQuery(() => loadTrendData(crewId)).subscribe({ next: setData, error: () => setData(null) })
    return () => sub.unsubscribe()
  }, [crewId])
  const ms = RANGES.find((r) => r.id === range)!.ms
  useEffect(() => {
    if (!compare || now === undefined) return
    const sub = liveQuery(() => loadCrewMetric(focus, now - ms, now)).subscribe({ next: (rows) => setMedian(crewMedian(rows)), error: () => setMedian(undefined) })
    return () => sub.unsubscribe()
  }, [compare, focus, now, ms])
  const series = useMemo(() => {
    if (!data || data.crewId !== crewId) return null
    return CHART_METRICS.map((m) => buildSeries(data.readings[m] ?? [], data.alerts, m, data.now, ms))
  }, [data, crewId, ms])
  // The level of each metric's open alert, for the channel dots, the gauge word and the small multiples.
  const alertStatus = useMemo(() => {
    const out: Partial<Record<MetricId, Status>> = {}
    const open = data?.alerts.filter((a) => a.state !== 'resolved') ?? []
    for (const m of CHART_METRICS) {
      const levels = alertsForMetric(open, m).map((a) => a.status)
      if (levels.length) out[m] = levels.includes('act') ? 'act' : 'watch'
    }
    return out
  }, [data])

  if (boot.state === 'error') return <StateView kind="error" title="Could not open the local database"><p>{boot.error}</p></StateView>
  if (boot.state !== 'ready' || snap === undefined) {
    const pct = boot.state === 'seeding' && boot.total > 0 ? (boot.done / boot.total) * 100 : undefined
    return <StateView kind="loading" label="Initializing demo mission data" progress={pct} />
  }
  if (snap === null) return <StateView kind="empty" label="No crew data yet." />
  if (!series) return <StateView kind="loading" label="Loading trends" />
  return (
    <TrendsView
      crew={snap.crew} crewId={snap.crewId} range={range} series={series} onRange={setRange}
      focus={focus} onFocus={setFocus} compare={compare} onCompare={setCompare} median={compare ? median : undefined} alertStatus={alertStatus}
    />
  )
}
