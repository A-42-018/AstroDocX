import { METRICS, type Hazard, type MetricId, type Status } from '../data/types'
import { STATUS_SHORT } from '../ui/status'
import type { TrendSeries } from './series'

/** A metric's state on this screen: its open alert's level, else OUT when the latest value left its band, else nominal. */
export interface Level { status: Status; word: string }
export function levelOf(s: TrendSeries, alert?: Status): Level {
  if (alert && alert !== 'nominal') return { status: alert, word: STATUS_SHORT[alert] }
  return s.outsideBand ? { status: 'watch', word: 'OUT' } : { status: 'nominal', word: STATUS_SHORT.nominal }
}

/** What each hazard lights on the body (the twin shader's regions). */
export const REGION: Record<Hazard, string> = { R: 'Skin', I: 'Brain', D: 'Transmitter arm', G: 'Legs + heart', E: 'Lungs' }

/** Bottom-row picks: metrics with an open alert first (Act before Watch), then out of band, then the focus's siblings. */
export function pickMultiples(series: TrendSeries[], levels: Map<MetricId, Level>, focusHazard: Hazard, n = 6): TrendSeries[] {
  const rank = (s: TrendSeries) => {
    const w = levels.get(s.metric)?.word
    return w === 'ACT' ? 0 : w === 'WATCH' ? 1 : w === 'OUT' ? 2 : METRICS[s.metric].hazard === focusHazard ? 3 : 4
  }
  return series.map((s, i) => ({ s, i, r: rank(s) })).sort((a, b) => a.r - b.r || a.i - b.i).slice(0, n).map((x) => x.s)
}
