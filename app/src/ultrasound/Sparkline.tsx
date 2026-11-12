/** Small trend of one measurement across scans, with the crew member's preflight value as a dashed line. */
export function Sparkline({ values, baseline, label, unit }: { values: number[]; baseline: number; label: string; unit: string }) {
  const W = 140, H = 34
  const all = [...values, baseline]
  const lo = Math.min(...all), hi = Math.max(...all)
  const span = hi - lo || Math.max(Math.abs(hi) * 0.1, 1)
  const y = (v: number) => H - 4 - ((v - lo) / span) * (H - 8)
  const x = (i: number) => (values.length < 2 ? W / 2 : 4 + (i / (values.length - 1)) * (W - 8))
  const pts = values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')
  const text = values.length ? `${label}: ${values.slice(-6).join(', ')}${unit ? ' ' + unit : ''}; preflight ${baseline}` : `${label}: no scans yet`
  return (
    <svg className="us-spark" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={text}>
      <line x1="0" x2={W} y1={y(baseline)} y2={y(baseline)} className="us-spark-base" />
      {values.length > 1 && <polyline points={pts} className="us-spark-line" />}
      {values.map((v, i) => <circle key={i} cx={x(i)} cy={y(v)} r={i === values.length - 1 ? 3 : 1.8} className="us-spark-dot" />)}
    </svg>
  )
}
