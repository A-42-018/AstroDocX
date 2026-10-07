import { HAZARDS } from '../board/snapshot'
import { METRICS, type CrewMember, type MetricId } from '../data/types'
import { HazardIcon } from '../shell/icons'
import { TrendChart, TrendPlot } from './TrendChart'
import { CHART_METRICS, RANGES, decimalsFor, seriesStats, type RangeId, type TrendSeries } from './series'

interface Props {
  crew: CrewMember[]
  crewId: string
  range: RangeId
  series: TrendSeries[]
  onRange: (r: RangeId) => void
  /** Metric shown in the large chart (defaults to the first series). */
  focus?: MetricId
  onFocus?: (m: MetricId) => void
  compare?: boolean
  onCompare?: (on: boolean) => void
  median?: { ts: number; value: number }[]
}

function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  return <div className="stat"><dt>{label}</dt><dd className="mono">{value}</dd>{note && <small>{note}</small>}</div>
}

export function TrendsView({ crew, crewId, range, series, onRange, focus, onFocus = () => {}, compare = false, onCompare, median }: Props) {
  const who = crew.find((c) => c.id === crewId)
  const ms = RANGES.find((r) => r.id === range)!.ms
  const big = series.find((s) => s.metric === focus) ?? series[0]
  const def = big && METRICS[big.metric]
  const st = big ? seriesStats(big) : null
  const d = big ? decimalsFor(big.metric) : 0
  const fmt = (v: number | null) => (v === null ? '--' : v.toFixed(d))
  return (
    <div className="board">
      <section className="glass" aria-label="Trend summary">
        <div className="trend-top">
          <div>
            <h1 style={{ margin: 0 }}>Trends · {who?.name}</h1>
            <p className="muted" style={{ marginBottom: 0 }}>
              Each line is measured against {who?.name}’s own baseline. The shaded band is the baseline ± 1.8σ (the Watch threshold); dots mark alerts (amber Watch, red Act).
            </p>
          </div>
          <div role="group" aria-label="Time range" className="crew-tabs">
            {RANGES.map((r) => (
              <button key={r.id} aria-pressed={r.id === range} className={r.id === range ? 'on' : ''} onClick={() => onRange(r.id)}>{r.label}</button>
            ))}
          </div>
        </div>
        <div className="metric-groups" role="group" aria-label="Metric">
          {HAZARDS.map((h) => {
            const ms2 = CHART_METRICS.filter((m) => METRICS[m].hazard === h.id)
            if (!ms2.length) return null
            return (
              <div key={h.id} className="metric-group">
                <span className="metric-group-name"><HazardIcon hazard={h.id} /><span>{h.name}</span></span>
                <div className="chips">
                  {ms2.map((m) => (
                    <button key={m} type="button" className={`chip${big?.metric === m ? ' on' : ''}`} aria-pressed={big?.metric === m} onClick={() => onFocus(m)}>{METRICS[m].label}</button>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {big && def && st && (
        <section className="glass focus" aria-label={`${def.label} focus chart`}>
          <header className="focus-head">
            <h2>{def.label} <small>{def.unit}</small></h2>
            {onCompare && (
              <label className="check">
                <input type="checkbox" checked={compare} onChange={(e) => onCompare(e.target.checked)} />
                Compare with crew median
              </label>
            )}
          </header>
          <TrendPlot series={big} rangeMs={ms} height={320} animate liveEdge median={compare ? median : undefined} />
          <dl className="stats" aria-label={`${def.label} statistics`}>
            <Stat label="Latest" value={`${fmt(st.latest)} ${def.unit}`} />
            <Stat label="Mean in range" value={fmt(st.mean)} />
            <Stat label="Baseline" value={fmt(st.baseline)} note={st.sd !== null ? `sd ${st.sd.toFixed(d + 1)}` : 'still learning'} />
            <Stat label="Distance from baseline" value={st.sigma === null ? '--' : `${st.sigma < 0 ? '−' : '+'}${Math.abs(st.sigma).toFixed(1)}σ`} />
            <Stat label="Outside band" value={`${st.outsidePct}%`} note="of readings in range" />
          </dl>
        </section>
      )}

      <section aria-label="All metrics">
        <h2 className="sec-title">All metrics</h2>
        <ul className="trend-grid" aria-label="Metric trends">
          {series.map((s) => <TrendChart key={s.metric} series={s} rangeMs={ms} onFocus={onFocus} />)}
        </ul>
      </section>
    </div>
  )
}
