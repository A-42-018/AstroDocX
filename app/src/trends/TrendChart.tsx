import { Area, ComposedChart, Line, ReferenceDot, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { METRICS } from '../data/types'
import { MISSION_START } from '../data/synthetic'
import { CO2_LIMIT_MMHG } from '../engine/limits'
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
        <span className="hz mono" style={{ background: 'var(--holo)' }}>{def.hazard}</span>
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
              contentStyle={{ background: 'var(--void-mid)', border: '1px solid var(--glass-border)', borderRadius: 6 }}
              labelFormatter={(t) => tickLabel(Number(t), 0, MISSION_START)}
              formatter={(v) => (Array.isArray(v) ? `${Number(v[0]).toFixed(d)} to ${Number(v[1]).toFixed(d)} (band)` : `${Number(v).toFixed(d)} ${def.unit}`)}
            />
            <Area dataKey="band" stroke="none" fill="var(--violet)" fillOpacity={0.18} isAnimationActive={false} connectNulls={false} />
            <Line dataKey="value" stroke="var(--holo)" strokeWidth={1.8} dot={false} isAnimationActive={false} />
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
