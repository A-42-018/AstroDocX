import { useId } from 'react'
import { Area, ComposedChart, Line, ReferenceDot, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { METRICS } from '../data/types'
import { DAY, HOUR, MISSION_START } from '../data/synthetic'
import { met } from '../engine/actions'
import { WATCH_Z } from '../engine/baseline'
import { CO2_LIMIT_MMHG } from '../engine/limits'
import { decimalsFor, tickLabel, trendSummary, type TrendPoint, type TrendSeries } from './series'

const COLOR = { watch: 'var(--watch)', act: 'var(--act)' } as const
const AXIS = { fill: 'var(--t3)', fontSize: 11, fontFamily: 'var(--mono)' }

interface PlotProps {
  series: TrendSeries
  rangeMs: number
  /** Fixed height in px; omit to fill the parent's height. */
  height?: number
  /** Draw the line in on load. */
  animate?: boolean
  /** Crew median to overlay as a dashed periwinkle line. */
  median?: { ts: number; value: number }[]
  /** "NOW" label and a pulsing dot on the newest point. */
  liveEdge?: boolean
}

/** Axis ticks on whole mission hours or days, so a label never repeats: 3 h steps for 24 h, days for 7, 5 days for 30. */
function ticksFor(from: number, to: number, rangeMs: number) {
  const step = rangeMs <= DAY ? 3 * HOUR : rangeMs <= 7 * DAY ? DAY : 5 * DAY
  const out: number[] = []
  for (let t = MISSION_START + Math.ceil((from - MISSION_START) / step) * step; t <= to; t += step) out.push(t)
  return out
}

/** σ of a value against the band it was judged by (band = mean ± WATCH_Z·sd). */
const sigmaAt = (p: TrendPoint) => {
  if (!p.band) return null
  const sd = (p.band[1] - p.band[0]) / 2 / WATCH_Z
  return sd ? (p.value - (p.band[0] + p.band[1]) / 2) / sd : null
}

/** Chamfered tooltip: value + unit + σ against the band, then the mission time. */
function Tip({ active, payload, metric, median }: { active?: boolean; payload?: { payload: TrendPoint & { median?: number } }[]; metric: TrendSeries['metric']; median: boolean }) {
  const p = active ? payload?.[0]?.payload : undefined
  if (!p) return null
  const d = decimalsFor(metric)
  const s = sigmaAt(p)
  return (
    <div className="tc-tip">
      <p><b>{p.value.toFixed(d)}</b> <span className="tc-unit">{METRICS[metric].unit}</span>{s !== null && <span className="tc-sig">{s < 0 ? '−' : '+'}{Math.abs(s).toFixed(1)}σ</span>}</p>
      {median && p.median !== undefined && <p className="tc-med">Crew median {p.median.toFixed(d)}</p>}
      <p className="tc-met">{met(p.ts)}</p>
    </div>
  )
}

/**
 * The focus chart (plan §4.3): personal band with dashed edges, a glowing linear line over a gradient area
 * (linear, so spikes stay honest), alert rings, optional crew median, a crosshair with a chamfered tooltip and NOW.
 */
export function TrendPlot({ series, rangeMs, height, animate = false, median, liveEdge = false }: PlotProps) {
  const uid = useId().replace(/:/g, '')
  const d = decimalsFor(series.metric)
  const medByTs = median ? new Map(median.map((m) => [m.ts, m.value])) : null
  const data = medByTs ? series.points.map((p) => ({ ...p, median: medByTs.get(p.ts) })) : series.points
  const last = series.points[series.points.length - 1]
  const ticks = last ? ticksFor(series.points[0].ts, last.ts, rangeMs) : undefined
  return (
    <div className="chart-box tc" style={height ? { height } : undefined} role="img" aria-label={trendSummary(series)}>
      <ResponsiveContainer width="100%" height={height ?? '100%'} minWidth={0} minHeight={0}>
        <ComposedChart data={data} margin={{ top: 10, right: liveEdge ? 60 : 10, bottom: 0, left: -8 }}>
          <defs>
            <linearGradient id={`area-${uid}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#36e2f5" stopOpacity={0.22} />
              <stop offset="100%" stopColor="#36e2f5" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis dataKey="ts" type="number" scale="time" domain={['dataMin', 'dataMax']} tickFormatter={(t: number) => tickLabel(t, rangeMs, MISSION_START)} ticks={ticks} tick={AXIS} stroke="rgba(70, 225, 245, 0.18)" tickLine={false} minTickGap={24} />
          <YAxis domain={['auto', 'auto']} tick={AXIS} stroke="transparent" tickLine={false} width={48} tickFormatter={(v: number) => v.toFixed(d)} />
          <Tooltip content={<Tip metric={series.metric} median={!!medByTs} />} cursor={{ stroke: 'var(--cy)', strokeOpacity: 0.55, strokeWidth: 1 }} isAnimationActive={false} />
          <Area dataKey="band" stroke="#36e2f5" strokeOpacity={0.5} strokeDasharray="5 4" strokeWidth={1} fill="#36e2f5" fillOpacity={0.08} isAnimationActive={false} connectNulls={false} activeDot={false} />
          <Area dataKey="value" stroke="none" fill={`url(#area-${uid})`} isAnimationActive={false} activeDot={false} />
          {medByTs && <Line dataKey="median" name="median" stroke="var(--data-2)" strokeWidth={1.5} strokeDasharray="5 4" dot={false} connectNulls isAnimationActive={false} activeDot={false} />}
          <Line dataKey="value" className="tc-line" stroke="var(--cy)" strokeWidth={1.8} dot={false} isAnimationActive={animate} animationDuration={800}
            activeDot={{ r: 5, fill: '#fff', stroke: 'var(--cy)', strokeWidth: 2 }} />
          {series.metric === 'co2' && <ReferenceLine y={CO2_LIMIT_MMHG} stroke="var(--act)" strokeDasharray="4 3" label={{ value: 'LIMIT 3.0', fill: 'var(--act)', fontSize: 11, fontFamily: 'var(--mono)', position: 'insideTopRight' }} />}
          {series.markers.map((m, i) => (
            <ReferenceDot key={i} x={m.ts} y={m.value} r={7} fill="none" stroke={COLOR[m.status]} strokeWidth={2} className="tc-ring" ifOverflow="visible" />
          ))}
          {liveEdge && last && (
            <ReferenceDot x={last.ts} y={last.value} r={4} ifOverflow="visible" shape={({ cx, cy }: { cx?: number; cy?: number }) => (
              <g>
                <circle cx={cx} cy={cy} r={4} className="now-pulse" />
                <circle cx={cx} cy={cy} r={3.5} fill="var(--cy-hi)" />
                <text x={(cx ?? 0) + 8} y={(cy ?? 0) + 4} className="tc-now">{last.value.toFixed(d)} NOW</text>
              </g>
            )} />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
