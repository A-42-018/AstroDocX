import { Area, ComposedChart, Line, ReferenceDot, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { METRICS } from '../data/types'
import { MISSION_START } from '../data/synthetic'
import { CO2_LIMIT_MMHG } from '../engine/limits'
import { HazardIcon } from '../shell/icons'
import { decimalsFor, tickLabel, type TrendSeries } from './series'

const COLOR = { watch: 'var(--watch)', act: 'var(--act)' } as const

export function TrendChart({ series, rangeMs }: { series: TrendSeries; rangeMs: number }) {
  const def = METRICS[series.metric]
  const d = decimalsFor(series.metric)
  const latest = series.latest === null ? 'no data' : `${series.latest.toFixed(d)} ${def.unit}`
  const summary = `${def.label}: latest ${latest}, ${series.outsideBand ? 'outside' : 'inside'} personal band, ${series.markers.length} alert${series.markers.length === 1 ? '' : 's'} in range.`
  return (
    <li className="glass trend" aria-label={def.label}>
      <header>
        <HazardIcon hazard={def.hazard} />
        <h2>{def.label}</h2>
        <span className="mono val-now">{latest}</span>
      </header>
      <p className="muted band-note">{summary}</p>
      <div className="chart-box" role="img" aria-label={summary}>
        <ResponsiveContainer width="100%" height={150} minWidth={0}>
          <ComposedChart data={series.points} margin={{ top: 6, right: 8, bottom: 0, left: -12 }}>
            <XAxis dataKey="ts" type="number" scale="time" domain={['dataMin', 'dataMax']} tickFormatter={(t: number) => tickLabel(t, rangeMs, MISSION_START)} tick={{ fill: 'var(--text-mid)', fontSize: 11 }} stroke="var(--glass-border)" minTickGap={28} />
            <YAxis domain={['auto', 'auto']} tick={{ fill: 'var(--text-mid)', fontSize: 11 }} stroke="var(--glass-border)" width={44} tickFormatter={(v: number) => v.toFixed(d)} />
            <Tooltip
              contentStyle={{ background: 'rgba(14, 15, 19, 0.92)', border: '1px solid rgba(255, 255, 255, 0.14)', borderRadius: 12, fontFamily: 'var(--font-mono)', fontSize: 12, boxShadow: '0 8px 24px rgba(0, 0, 0, 0.45)' }}
              labelStyle={{ color: 'var(--text-hi)' }}
              cursor={{ stroke: 'rgba(255, 255, 255, 0.3)', strokeDasharray: '3 3' }}
              labelFormatter={(t) => tickLabel(Number(t), 0, MISSION_START)}
              formatter={(v) => (Array.isArray(v) ? `${Number(v[0]).toFixed(d)} to ${Number(v[1]).toFixed(d)} (band)` : `${Number(v).toFixed(d)} ${def.unit}`)}
            />
            <defs>
              <linearGradient id={`band-${series.metric}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--violet)" stopOpacity={0.32} />
                <stop offset="100%" stopColor="var(--violet)" stopOpacity={0.08} />
              </linearGradient>
            </defs>
            <Area dataKey="band" stroke="var(--violet)" strokeOpacity={0.35} strokeWidth={0.8} fill={`url(#band-${series.metric})`} fillOpacity={1} isAnimationActive={false} connectNulls={false} />
            <Line dataKey="value" stroke="var(--holo)" strokeWidth={2} dot={false} isAnimationActive={false} />
            {series.metric === 'co2' && <ReferenceLine y={CO2_LIMIT_MMHG} stroke="var(--act)" strokeDasharray="4 3" label={{ value: 'NASA limit 3.0', fill: 'var(--act)', fontSize: 10, position: 'insideTopRight' }} />}
            {series.markers.map((m, i) => (
              <ReferenceDot key={i} x={m.ts} y={m.value} r={5} fill={COLOR[m.status]} stroke="var(--void)" ifOverflow="visible" />
            ))}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </li>
  )
}
