import { useState } from 'react'
import { CartesianGrid, ComposedChart, Line, ReferenceArea, ReferenceLine, ResponsiveContainer, XAxis, YAxis } from 'recharts'
import { HudPanel } from '../ui/HudPanel'
import { Segmented } from '../ui/Segmented'
import {
  CREW, EXCLUDED, FETCHED, I4_PAPER, MARKERS, NOTABLE_PCT, TIMEPOINTS, changeAt, inRange, landingSentence, osdUrl,
  preflightBaseline, preflightSpan, type CrewCode, type Marker,
} from './i4'

const ext = { target: '_blank', rel: 'noopener noreferrer' } as const
const NewTab = () => <span className="sr-only"> (opens in a new tab)</span>
const AXIS = { fill: 'var(--t3)', fontSize: 11, fontFamily: 'var(--mono)' }

/** Compact number: keeps 3 significant figures so a 4,000 cells/µL axis and a 0.3 mg/L one both read cleanly. */
const num = (v: number) => (Math.abs(v) >= 100 ? Math.round(v).toLocaleString('en-US') : +v.toPrecision(3)).toString()
const pct = (v: number) => `${v < 0 ? '−' : '+'}${Math.abs(v).toFixed(0)} %`

/** One y-scale for all four crew so the panels can be compared by eye. */
function domainOf(m: Marker): [number, number] {
  const all = CREW.flatMap((c) => TIMEPOINTS.map((t) => m.values[c][t.id])).filter((v): v is number => v !== null)
  const lo = Math.min(...all, m.refMin ?? Infinity), hi = Math.max(...all, m.refMax ?? -Infinity)
  const pad = (hi - lo) * 0.08 || 1
  // a concentration or count cannot be negative: do not let the padding draw below zero
  return [lo >= 0 ? Math.max(0, lo - pad) : lo - pad, hi + pad]
}

function CrewChart({ marker, crew, domain }: { marker: Marker; crew: CrewCode; domain: [number, number] }) {
  const data = TIMEPOINTS.map((t) => ({ tp: t.id, value: marker.values[crew][t.id], pre: t.pre }))
  const base = preflightBaseline(marker, crew), span = preflightSpan(marker, crew)
  const landing = changeAt(marker, crew, 'R+1')
  const landed = marker.values[crew]['R+1']
  const outside = inRange(marker, landed) === false
  const label = `${crew} ${marker.label}: ${data.map((d) => `${d.tp} ${d.value === null ? 'not usable' : `${num(d.value)} ${marker.unit}`}`).join(', ')}.`
  return (
    <figure className="i4-crew">
      <figcaption className="i4-cap">
        <b>{crew}</b>
        {landing !== null && (
          <span className={`i4-d ${Math.abs(landing) >= NOTABLE_PCT ? 'notable' : ''}`}>
            R+1 {pct(landing)}<span className="i4-d-sub"> vs own baseline</span>
          </span>
        )}
      </figcaption>
      <div className="chart-box i4-plot" role="img" aria-label={label}>
        <ResponsiveContainer width="100%" height={150} minWidth={0} minHeight={0}>
          <ComposedChart data={data} margin={{ top: 8, right: 22, bottom: 0, left: 4 }}>
            <CartesianGrid vertical={false} stroke="rgba(70, 225, 245, 0.08)" />
            <XAxis dataKey="tp" tick={{ ...AXIS, fontSize: 10 }} stroke="rgba(70, 225, 245, 0.18)" tickLine={false} interval={0} />
            <YAxis type="number" domain={domain} tick={AXIS} stroke="transparent" tickLine={false} width={46} tickCount={4} tickFormatter={num} allowDataOverflow />
            {marker.refMin !== undefined && marker.refMax !== undefined && (
              <ReferenceArea y1={marker.refMin} y2={marker.refMax} fill="#7cf0a0" fillOpacity={0.07} stroke="#7cf0a0" strokeOpacity={0.25} strokeDasharray="3 4" ifOverflow="hidden" />
            )}
            {span && <ReferenceArea x1="L-92" x2="L-3" y1={span[0]} y2={span[1]} fill="#36e2f5" fillOpacity={0.12} stroke="none" ifOverflow="hidden" />}
            {base !== null && <ReferenceLine y={base} stroke="#36e2f5" strokeOpacity={0.7} strokeDasharray="5 4" />}
            <Line dataKey="value" stroke="var(--cy)" strokeWidth={1.8} isAnimationActive={false} connectNulls={false}
              dot={({ cx, cy, payload, index }: { cx?: number; cy?: number; payload?: { tp: string; value: number | null; pre: boolean }; index?: number }) => {
                if (payload?.value == null || cx === undefined || cy === undefined) return <g key={index} />
                const first = payload.tp === 'R+1'
                return (
                  <circle key={index} cx={cx} cy={cy} r={first ? 5 : 3.5}
                    fill={payload.pre ? 'rgba(5, 14, 22, 1)' : first ? (outside ? 'var(--watch)' : '#fff') : 'var(--cy)'}
                    stroke={first && outside ? 'var(--watch)' : 'var(--cy)'} strokeWidth={payload.pre ? 1.8 : 2} />
                )
              }} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </figure>
  )
}

/**
 * Real crew data: measured blood and serum values from the four SpaceX Inspiration4 crew (NASA OSDR OSD-569 and OSD-575),
 * each drawn against that person's own pre-flight baseline and the lab's reference range. The point it makes is the one
 * AstroDocX is built on: a value can sit inside the population range and still be a big move for that person.
 */
export function RealCrewData() {
  const [id, setId] = useState(MARKERS.find((m) => m.id === 'lymph')?.id ?? MARKERS[0].id)
  const marker = MARKERS.find((m) => m.id === id) ?? MARKERS[0]
  const domain = domainOf(marker)
  const excludedHere = EXCLUDED.filter((e) => marker.values[e.crew][e.tp] === null)
  const hasRange = marker.refMin !== undefined

  return (
    <HudPanel className="i4" title="Real crew data · SpaceX Inspiration4" meta="NASA OSDR · 4 crew · 2021" id="nasa-real-data">
      <p className="i4-lede">
        Measured blood values from the four Inspiration4 crew (an all-civilian three-day orbital flight, September 2021), published by NASA’s
        Open Science Data Repository. Each chart is one person against <em>their own</em> pre-flight baseline, not a population average.
        Everything else in the console runs on synthetic data; this is the one panel that does not.
      </p>

      <Segmented label="Lab marker" className="i4-seg" value={id} onChange={setId}
        options={MARKERS.map((m) => ({ id: m.id, label: m.label }))} />

      <p className="i4-take" aria-live="polite">{landingSentence(marker)}</p>

      <div className="i4-grid">
        {CREW.map((c) => <CrewChart key={c} marker={marker} crew={c} domain={domain} />)}
      </div>

      <ul className="i4-legend" aria-label="Chart key">
        <li><span className="i4-k i4-k-base" />Pre-flight range and mean (L-92, L-44, L-3)</li>
        {hasRange && <li><span className="i4-k i4-k-ref" />Lab reference range</li>}
        <li><span className="i4-k i4-k-pre" />Before launch</li>
        <li><span className="i4-k i4-k-post" />After landing (R+n = days)</li>
      </ul>

      {excludedHere.length > 0 && (
        <p className="i4-warn">
          {excludedHere.map((e) => `${e.crew} ${e.tp}`).join(', ')} is left out: the source table’s whole blood-count row for that draw is not a plausible measurement
          (e.g. a mean platelet volume of 330 fL), so the baseline for that person uses the other pre-flight draws.
        </p>
      )}

      <p className="i4-src">
        {marker.unit} · {hasRange ? 'clinical lab reference range from the table.' : 'research multiplex immunoassay: no clinical reference range, and absolute levels are only comparable within this study.'}{' '}
        Source: <a href={osdUrl(marker.osd)} {...ext}>NASA OSDR {marker.osd}<NewTab /></a> (<code>{marker.source}</code>), fetched {FETCHED}.
        Study: <a href={I4_PAPER.url} {...ext}>Overview of the SpaceX Inspiration4 human spaceflight mission, Nature (2024)<NewTab /></a>.
      </p>
      <p className="i4-note">
        Crew are anonymised (C001–C004) in the dataset. Four people on a three-day flight is a case series, not a norm: it shows what a personal baseline can see,
        and is context, never a diagnosis. An independent Space Apps project; not affiliated with or endorsed by NASA.
      </p>
    </HudPanel>
  )
}
