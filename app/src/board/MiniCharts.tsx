const W = 160
const H = 44
const PAD = 3

function bounds(values: number[], extra: number[] = []) {
  const all = [...values, ...extra]
  let lo = Math.min(...all)
  let hi = Math.max(...all)
  if (!isFinite(lo) || hi - lo < 1e-9) { lo = (isFinite(lo) ? lo : 0) - 1; hi = lo + 2 }
  const pad = (hi - lo) * 0.12
  return { lo: lo - pad, hi: hi + pad }
}
const sx = (i: number, n: number) => (n <= 1 ? W / 2 : PAD + (i / (n - 1)) * (W - 2 * PAD))
const sy = (v: number, lo: number, hi: number) => H - PAD - ((v - lo) / (hi - lo)) * (H - 2 * PAD)

function Svg({ children }: { children: React.ReactNode }) {
  return <svg className="mini" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">{children}</svg>
}
const line = (pts: [number, number][]) => pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join('')

/** Cumulative area (dose). */
export function AreaMini({ values }: { values: number[] }) {
  if (values.length < 2) return <Svg>{null}</Svg>
  const { lo, hi } = bounds(values, [0])
  const pts = values.map((v, i): [number, number] => [sx(i, values.length), sy(v, lo, hi)])
  return (
    <Svg>
      <path d={`${line(pts)}L${pts[pts.length - 1][0]} ${H}L${pts[0][0]} ${H}Z`} className="mini-area" />
      <path d={line(pts)} className="mini-line" />
    </Svg>
  )
}

/** Step line (sleep per night) with the personal mean as a dashed rule. */
export function StepMini({ values, mean }: { values: number[]; mean: number | null }) {
  if (values.length < 2) return <Svg>{null}</Svg>
  const { lo, hi } = bounds(values, mean === null ? [] : [mean])
  let d = ''
  values.forEach((v, i) => {
    const x0 = i === 0 ? PAD : (sx(i - 1, values.length) + sx(i, values.length)) / 2
    const x1 = i === values.length - 1 ? W - PAD : (sx(i, values.length) + sx(i + 1, values.length)) / 2
    const y = sy(v, lo, hi)
    d += `${i ? 'L' : 'M'}${x0.toFixed(1)} ${y.toFixed(1)}L${x1.toFixed(1)} ${y.toFixed(1)}`
  })
  return <Svg>{mean !== null && <line x1="0" x2={W} y1={sy(mean, lo, hi)} y2={sy(mean, lo, hi)} className="mini-rule" />}<path d={d} className="mini-line" /></Svg>
}

/** Bars by day (exercise) with the personal mean. */
export function BarsMini({ values, mean }: { values: number[]; mean: number | null }) {
  if (values.length === 0) return <Svg>{null}</Svg>
  const { hi } = bounds(values, [0, ...(mean === null ? [] : [mean])])
  const bw = (W - 2 * PAD) / values.length
  const y = (v: number) => H - PAD - (Math.max(0, v) / hi) * (H - 2 * PAD)
  return (
    <Svg>
      {values.map((v, i) => <rect key={i} x={PAD + i * bw + bw * 0.14} width={bw * 0.72} y={y(v)} height={H - PAD - y(v)} rx="2" className="mini-bar" />)}
      {mean !== null && <line x1="0" x2={W} y1={y(mean)} y2={y(mean)} className="mini-rule" />}
    </Svg>
  )
}

/** Line against a limit (cabin CO₂). */
export function LineLimitMini({ values, limit }: { values: number[]; limit: number }) {
  if (values.length < 2) return <Svg>{null}</Svg>
  const { lo, hi } = bounds(values, [limit])
  const pts = values.map((v, i): [number, number] => [sx(i, values.length), sy(v, lo, hi)])
  return <Svg><line x1="0" x2={W} y1={sy(limit, lo, hi)} y2={sy(limit, lo, hi)} className="mini-limit" /><path d={line(pts)} className="mini-line" /></Svg>
}

/** How long the oldest log entry has waited, on a 0-96 h scale with the Watch (24 h) and Act (72 h) marks. */
export function BacklogBar({ hours }: { hours: number | null | undefined }) {
  const pct = Math.min(100, ((hours ?? 0) / 96) * 100)
  return (
    <div className="backlog" aria-hidden="true">
      <span className="backlog-fill" style={{ width: `${pct}%` }} />
      <i style={{ left: '25%' }} />
      <i style={{ left: '75%' }} />
    </div>
  )
}
