import { expect, it } from 'vitest'
import { levelOf, pickMultiples, type Level } from './levels'
import type { MetricId } from '../data/types'
import type { TrendSeries } from './series'

const s = (metric: MetricId, outsideBand = false): TrendSeries => ({ metric, points: [], markers: [], latest: 1, outsideBand })

it('takes an open alert first, then OUT when the latest value left its band, else nominal', () => {
  expect(levelOf(s('sleep', true), 'act')).toEqual({ status: 'act', word: 'ACT' })
  expect(levelOf(s('dose', true))).toEqual({ status: 'watch', word: 'OUT' })
  expect(levelOf(s('hr'))).toEqual({ status: 'nominal', word: 'NOM' })
})

it('puts Act, Watch and out-of-band metrics before the focused hazard and keeps metric order otherwise', () => {
  const series = [s('dose', true), s('sleep'), s('reaction'), s('mood'), s('exercise'), s('hr'), s('hrv'), s('co2')]
  const levels = new Map<MetricId, Level>(series.map((x) => [x.metric, levelOf(x, x.metric === 'reaction' ? 'act' : x.metric === 'mood' ? 'watch' : undefined)]))
  expect(pickMultiples(series, levels, 'G').map((x) => x.metric)).toEqual(['reaction', 'mood', 'dose', 'exercise', 'hr', 'hrv'])
})
