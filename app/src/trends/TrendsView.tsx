import { CrewTabs } from '../board/CrewTabs'
import type { CrewMember } from '../data/types'
import { TrendChart } from './TrendChart'
import { RANGES, type RangeId, type TrendSeries } from './series'

interface Props {
  crew: CrewMember[]
  crewId: string
  range: RangeId
  series: TrendSeries[]
  onSelectCrew: (id: string) => void
  onRange: (r: RangeId) => void
}

export function TrendsView({ crew, crewId, range, series, onSelectCrew, onRange }: Props) {
  const who = crew.find((c) => c.id === crewId)
  const ms = RANGES.find((r) => r.id === range)!.ms
  return (
    <div className="board">
      <div className="board-head">
        <CrewTabs crew={crew} crewId={crewId} onSelect={onSelectCrew} />
        <div role="group" aria-label="Time range" className="crew-tabs">
          {RANGES.map((r) => (
            <button key={r.id} aria-pressed={r.id === range} className={r.id === range ? 'on' : ''} onClick={() => onRange(r.id)}>{r.label}</button>
          ))}
        </div>
      </div>
      <section className="glass" aria-label="Trend summary">
        <h1 style={{ margin: 0 }}>Trends · {who?.name}</h1>
        <p className="muted" style={{ marginBottom: 0 }}>
          Each line is measured against {who?.name}’s own baseline. The shaded band is the baseline ± 1.8σ (the Watch threshold); dots mark alerts (amber Watch, red Act).
        </p>
      </section>
      <ul className="trend-grid" aria-label="Metric trends">
        {series.map((s) => <TrendChart key={s.metric} series={s} rangeMs={ms} />)}
      </ul>
    </div>
  )
}
