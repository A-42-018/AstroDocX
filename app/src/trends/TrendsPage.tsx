import { liveQuery } from 'dexie'
import { useEffect, useMemo, useState } from 'react'
import { useSnapshot } from '../board/hooks'
import { useBoard } from '../board/store'
import { loadTrendData, type TrendData } from './data'
import { RANGES, buildSeries, CHART_METRICS, type RangeId } from './series'
import { TrendsView } from './TrendsView'

export default function TrendsPage() {
  const snap = useSnapshot()
  const boot = useBoard((s) => s.boot)
  const select = useBoard((s) => s.selectCrew)
  const [range, setRange] = useState<RangeId>('7d')
  const [data, setData] = useState<TrendData | null>(null)
  const crewId = snap?.crewId
  useEffect(() => {
    if (!crewId) return
    const sub = liveQuery(() => loadTrendData(crewId)).subscribe({ next: setData, error: () => setData(null) })
    return () => sub.unsubscribe()
  }, [crewId])
  const series = useMemo(() => {
    if (!data || data.crewId !== crewId) return null
    const ms = RANGES.find((r) => r.id === range)!.ms
    return CHART_METRICS.map((m) => buildSeries(data.readings[m] ?? [], data.alerts, m, data.now, ms))
  }, [data, crewId, range])

  if (boot.state === 'error') return <p role="alert" className="glass">Could not open the local database: {boot.error}</p>
  if (boot.state !== 'ready' || snap === undefined) return <p className="glass muted" role="status">Initializing demo mission data…</p>
  if (snap === null) return <p className="glass muted">No crew data yet.</p>
  if (!series) return <p className="glass muted" role="status">Loading trends…</p>
  return <TrendsView crew={snap.crew} crewId={snap.crewId} range={range} series={series} onSelectCrew={select} onRange={setRange} />
}
