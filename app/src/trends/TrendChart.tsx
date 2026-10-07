import { Area, ComposedChart, Line, ReferenceDot, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { METRICS } from '../data/types'
import { MISSION_START } from '../data/synthetic'
import { CO2_LIMIT_MMHG } from '../engine/limits'
import { HazardIcon } from '../shell/icons'
import { decimalsFor, tickLabel, trendSummary, type TrendSeries } from './series'

const COLOR = { watch: 'var(--watch)', act: 'var(--act)' } as const

interface PlotProps {
  series: TrendSeries
  rangeMs: number
  height?: number
  /** Draw the line in on load (the big charts); small multiples stay still. */
  animate?: boolean
  /** Crew median to overlay as a dashed line. */
  median?: { ts: number; value: number }[]
  /** Pulsing dot on the newest point. */
  liveEdge?: boolean
  /** Make the alert marker at this time large, with a ring, and draw a vertical rule there. */
  highlightTs?: number
}

/** The chart itself: personal band, value line, alert dots, optional crew median, live edge and highlighted crossing. */
export function TrendPlot({ series, rangeMs, height = 150, animate = false, median, liveEdge = false, highlightTs }: PlotProps) {
  const def = METRICS[series.metric]
  const d = decimalsFor(series.metric)
  const medByTs = median ? new Map(median.map((m) => [m.ts, m.value])) : null
  const data = medByTs ? series.points.map((p) => ({ ...p, median: medByTs.get(p.ts) })) : series.points
  const last = series.points[series.points.length - 1]
  return (
    <div className="chart-box" style={{ height }} role="img" aria-label={trendSummary(series)}>
      <ResponsiveContainer width="100%" height={height} minWidth={0}>
        <ComposedChart data={data} margin={{ top: 8, right: liveEdge ? 14 : 8, bottom: 0, left: -12 }}>
          <XAxis dataKey="ts" type="number" scale="time" domain={['dataMin', 'dataMax']} tickFormatter={(t: number) => tickLabel(t, rangeMs, MISSION_START)} tick={{ fill: 'var(--text-mid)', fontSize: 11 }} stroke="var(--glass-border)" minTickGap={28} />
          <YAxis domain={['auto', 'auto']} tick={{ fill: 'var(--text-mid)', fontSize: 11 }} stroke="var(--glass-border)" width={44} tickFormatter={(v: number) => v.toFixed(d)} />
          <Tooltip
            contentStyle={{ background: 'rgba(14, 15, 19, 0.92)', border: '1px solid rgba(255, 255, 255, 0.14)', borderRadius: 12, fontFamily: 'var(--font-mono)', fontSize: 12, boxShadow: '0 8px 24px rgba(0, 0, 0, 0.45)' }}
            labelStyle={{ color: 'var(--text-hi)' }}
            cursor={{ stroke: 'rgba(255, 255, 255, 0.3)', strokeDasharray: '3 3' }}
            labelFormatter={(t) => tickLabel(Number(t), 0, MISSION_START)}
            formatter={(v, name) => (Array.isArray(v) ? `${Number(v[0]).toFixed(d)} to ${Number(v[1]).toFixed(d)} (band)` : `${Number(v).toFixed(d)} ${def.unit}${name === 'median' ? ' (crew median)' : ''}`)}
          />
          <defs>
            <linearGradient id={`band-${series.metric}-${height}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--violet)" stopOpacity={0.32} />
              <stop offset="100%" stopColor="var(--violet)" stopOpacity={0.08} />
            </linearGradient>
          </defs>
          <Area dataKey="band" stroke="var(--violet)" strokeOpacity={0.35} strokeWidth={0.8} fill={`url(#band-${series.metric}-${height})`} fillOpacity={1} isAnimationActive={false} connectNulls={false} />
          {medByTs && <Line dataKey="median" name="median" stroke="var(--text-mid)" strokeWidth={1.5} strokeDasharray="5 4" dot={false} connectNulls isAnimationActive={false} />}
          <Line dataKey="value" stroke="var(--holo)" strokeWidth={2} dot={false} isAnimationActive={animate} animationDuration={800} />
          {series.metric === 'co2' && <ReferenceLine y={CO2_LIMIT_MMHG} stroke="var(--act)" strokeDasharray="4 3" label={{ value: 'Limit 3.0', fill: 'var(--act)', fontSize: 10, position: 'insideTopRight' }} />}
          {highlightTs !== undefined && <ReferenceLine x={highlightTs} stroke="var(--text-lo)" strokeDasharray="3 3" />}
          {series.markers.map((m, i) => {
            const hot = highlightTs !== undefined && m.ts === highlightTs
            return (
              <ReferenceDot key={i} x={m.ts} y={m.value} r={hot ? 7 : 5} fill={COLOR[m.status]} stroke={hot ? 'var(--text-hi)' : 'var(--void)'} strokeWidth={hot ? 2 : 1} ifOverflow="visible" />
            )
          })}
          {liveEdge && last && (
            <ReferenceDot x={last.ts} y={last.value} r={4} ifOverflow="visible" shape={({ cx, cy }: { cx?: number; cy?: number }) => (
              <g><circle cx={cx} cy={cy} r={4} className="now-pulse" /><circle cx={cx} cy={cy} r={4} fill="var(--holo)" /></g>
            )} />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}

/** Small multiple: a card with a title, the latest value and a compact plot; the Focus button promotes it to the big chart. */
export function TrendChart({ series, rangeMs, onFocus }: { series: TrendSeries; rangeMs: number; onFocus?: (m: TrendSeries['metric']) => void }) {
  const def = METRICS[series.metric]
  const latest = series.latest === null ? 'no data' : `${series.latest.toFixed(decimalsFor(series.metric))} ${def.unit}`
  return (
    <li className="glass trend" aria-label={def.label}>
      <header>
        <HazardIcon hazard={def.hazard} />
        <h2>{def.label}</h2>
        <span className="mono val-now">{latest}</span>
        {onFocus && <button type="button" className="btn ghost mini-btn" aria-label={`Focus ${def.label}`} onClick={() => onFocus(series.metric)}>Focus</button>}
      </header>
      <p className="muted band-note">{trendSummary(series)}</p>
      <TrendPlot series={series} rangeMs={rangeMs} />
    </li>
  )
}
