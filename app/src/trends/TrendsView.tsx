import { HAZARDS } from '../board/snapshot'
import { met } from '../engine/actions'
import { METRICS, type CrewMember, type MetricId, type Status } from '../data/types'
import { Gauge, HudPanel, KpiCell, KpiGrid, Readout, Segmented, StatusTag } from '../ui'
import { TrendPlot } from './TrendChart'
import { BodyRegion, Spark } from './parts'
import { levelOf, pickMultiples, REGION, type Level } from './levels'
import { CHART_METRICS, RANGES, decimalsFor, seriesStats, trendSummary, type RangeId, type TrendSeries } from './series'

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
  /** Level of each metric's open alert, if it has one. */
  alertStatus?: Partial<Record<MetricId, Status>>
}

const sig = (s: number) => `${s < 0 ? '−' : '+'}${Math.abs(s).toFixed(1)}σ`

/**
 * Trends (plan §4.3, mockup 2): the biometric channel list, the focus chart, the latest value as a ring gauge
 * with its band word, the body region it belongs to, and small multiples of the metrics that most need a look.
 */
export function TrendsView({ crew, crewId, range, series, onRange, focus, onFocus = () => {}, compare = false, onCompare, median, alertStatus = {} }: Props) {
  const who = crew.find((c) => c.id === crewId)
  const ms = RANGES.find((r) => r.id === range)!.ms
  const big = series.find((s) => s.metric === focus) ?? series[0]
  const levels = new Map(series.map((s) => [s.metric, levelOf(s, alertStatus[s.metric])] as [MetricId, Level]))
  if (!big) return null
  const def = METRICS[big.metric]
  const hz = HAZARDS.find((h) => h.id === def.hazard)!
  const lv = levels.get(big.metric)!
  const st = seriesStats(big)
  const d = decimalsFor(big.metric)
  const fmt = (v: number | null) => (v === null ? '--' : v.toFixed(d))
  const lastPt = big.points[big.points.length - 1]
  const band = [...big.points].reverse().find((p) => p.band)?.band
  const word = st.latest === null || !band ? 'No band yet' : st.latest > band[1] ? 'Above band' : st.latest < band[0] ? 'Below band' : 'In band'
  // Ring fill: where the latest value sits in the baseline ± 3σ span (the band edges at 20% and 80%).
  const fill = st.latest !== null && st.baseline !== null && st.sd ? ((st.latest - (st.baseline - 3 * st.sd)) / (6 * st.sd)) * 100 : 0
  const multiples = pickMultiples(series, levels, def.hazard)

  return (
    <div className="trends">
      <HudPanel className="tr-ch" title="Biometric channels" meta={who?.name}>
        <div role="group" aria-label="Metric" className="ch-groups">
          {HAZARDS.map((h) => {
            const list = series.filter((s) => METRICS[s.metric].hazard === h.id && CHART_METRICS.includes(s.metric))
            if (!list.length) return null
            return (
              <div key={h.id} className="ch-group">
                <p className="ch-hz"><span className="ch-code" aria-hidden="true">{h.id}</span>{h.name}</p>
                {list.map((s) => {
                  const m = METRICS[s.metric]
                  const l = levels.get(s.metric)!
                  const on = s.metric === big.metric
                  const value = s.latest === null ? '--' : s.latest.toFixed(decimalsFor(s.metric))
                  return (
                    <button key={s.metric} type="button" className={`ch-row st-${l.status}${on ? ' on' : ''}${l.status !== 'nominal' ? ' lit' : ''}`} aria-pressed={on} onClick={() => onFocus(s.metric)}>
                      <span className="ch-name">{m.label}</span>
                      <Spark s={s} w={64} h={18} className="ch-spark" />
                      <span className="ch-val"><span className="sr-only">: </span>{value}<span className="sr-only"> {m.unit}{l.status !== 'nominal' ? `, ${l.word}` : ''}</span></span>
                    </button>
                  )
                })}
              </div>
            )
          })}
        </div>
      </HudPanel>

      <HudPanel hero className="tr-focus" aria-label={`${def.label} focus chart`}
        title={<>Trend focus // {hz.id} · {hz.name}</>} meta="Own baseline ± 1.8σ = watch band">
        <div className="tf-head">
          <h1>{def.label} <small>{def.unit}</small></h1>
          <Segmented label="Time range" options={RANGES.map((r) => ({ id: r.id, label: r.label }))} value={range} onChange={onRange} />
        </div>
        <ul className="tf-legend">
          <li><span className="lg-line" aria-hidden="true" />{who?.name}</li>
          {onCompare && (
            <li>
              <label className={`lg-toggle${compare ? ' on' : ''}`}>
                <input type="checkbox" checked={compare} onChange={(e) => onCompare(e.target.checked)} aria-label="Compare with crew median" />
                <span className="lg-dash" aria-hidden="true" />Crew median
              </label>
            </li>
          )}
          <li><span className="lg-band" aria-hidden="true" />Band</li>
          <li><span className="lg-ring" aria-hidden="true" />Alert</li>
        </ul>
        <div className="tf-chart">
          <TrendPlot series={big} rangeMs={ms} animate liveEdge median={compare ? median : undefined} />
        </div>
      </HudPanel>

      <HudPanel className="tr-latest" title="Latest" meta={lastPt ? met(lastPt.ts).replace(' MET', '') : undefined}>
        <Gauge kind="ring" value={fill} display={fmt(st.latest)} unit={def.unit} status={lv.status} word={word}
          label={`${def.label} latest ${fmt(st.latest)} ${def.unit}, ${word.toLowerCase()}`} />
        <div role="group" aria-label={`${def.label} statistics`}>
          <KpiGrid>
            <KpiCell label="Mean" value={fmt(st.mean)} />
            <KpiCell label="Baseline" value={fmt(st.baseline)} sub={st.sd !== null ? `sd ${st.sd.toFixed(d + 1)}` : 'learning'} />
            <KpiCell label="From base" value={st.sigma === null ? '--' : sig(st.sigma)} status={lv.status === 'nominal' ? undefined : lv.status} />
            <KpiCell label="Outside band" value={`${st.outsidePct}%`} />
          </KpiGrid>
        </div>
      </HudPanel>

      <HudPanel className="tr-body" title="Body region" meta={`${hz.id} · ${REGION[hz.id]}`}>
        <BodyRegion hazard={hz.id} status={lv.status} />
      </HudPanel>

      <ul className="tr-multi" aria-label="Metric trends">
        {multiples.map((s) => {
          const m = METRICS[s.metric]
          const l = levels.get(s.metric)!
          return (
            <li key={s.metric}>
              <button type="button" className={`hp sm-tile st-${l.status}${l.status === 'act' ? ' tone-act' : ''}${s.metric === big.metric ? ' on' : ''}`} aria-label={`Focus ${m.label}`} aria-pressed={s.metric === big.metric} onClick={() => onFocus(s.metric)}>
                <span className="sm-head"><span className="sm-name">{m.label}</span><StatusTag status={l.status} label={l.word} /></span>
                <Readout size="l" value={s.latest === null ? '--' : s.latest.toFixed(decimalsFor(s.metric))} unit={m.unit} status={l.word === 'OUT' || l.status === 'nominal' ? undefined : l.status} />
                <Spark s={s} w={240} h={40} band className="sm-spark" />
                <span className="sr-only">{trendSummary(s)}</span>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
