import { liveQuery } from 'dexie'
import { useEffect, useMemo, useState } from 'react'
import { useSnapshot } from '../board/hooks'
import { useBoard } from '../board/store'
import type { MetricId } from '../data/types'
import { loadCrewMetric, loadTrendData, type TrendData } from './data'
import { RANGES, buildSeries, crewMedian, CHART_METRICS, type RangeId } from './series'
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

  if (boot.state === 'error') return <p role="alert" className="glass">Could not open the local database: {boot.error}</p>
  if (boot.state !== 'ready' || snap === undefined) return <p className="glass muted" role="status">Initializing demo mission data…</p>
  if (snap === null) return <p className="glass muted">No crew data yet.</p>
  if (!series) return <p className="glass muted" role="status">Loading trends…</p>
  return (
    <TrendsView
      crew={snap.crew} crewId={snap.crewId} range={range} series={series} onRange={setRange}
      focus={focus} onFocus={setFocus} compare={compare} onCompare={setCompare} median={compare ? median : undefined}
    />
  )
}
