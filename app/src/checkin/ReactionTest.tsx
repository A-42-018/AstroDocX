import { useEffect, useRef, useState } from 'react'
import { lampGo, tapEarly, tapTick } from '../audio/sfx'
import { KpiCell } from '../ui'
import { LAPSE_MS, MIN_VALID_TRIALS, TRIALS, WAIT_MS, summarize, type PvtSummary } from './pvt'

type Phase = 'idle' | 'wait' | 'go' | 'done'

interface Props {
  onResult: (s: PvtSummary | null) => void
  /** Test seam: random wait in ms. */
  waitMs?: () => number
  /** The person's own median reaction time (ms), for the comparison on the result. */
  baselineMs?: number | null
}

const randomWait = () => WAIT_MS[0] + Math.random() * (WAIT_MS[1] - WAIT_MS[0])

/** 72 ticks around the lamp, a major one every 6. Decorative. */
const TICKS = Array.from({ length: 72 }, (_, k) => {
  const a = (k / 72) * Math.PI * 2, r2 = k % 6 ? 140 : 134
  return { k, x1: 150 + Math.sin(a) * 146, y1: 150 - Math.cos(a) * 146, x2: 150 + Math.sin(a) * r2, y2: 150 - Math.cos(a) * r2, major: k % 6 === 0 }
})

/** Tap-the-lamp reaction test: wait for the lamp to turn green, then tap as fast as you can. */
export function ReactionTest({ onResult, waitMs = randomWait, baselineMs }: Props) {
  const [phase, setPhase] = useState<Phase>('idle')
  const [trials, setTrials] = useState<(number | 'early')[]>([])
  const [note, setNote] = useState('')
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const shownAt = useRef(0)
  useEffect(() => () => clearTimeout(timer.current), [])

  const arm = (done: (number | 'early')[]) => {
    setPhase('wait')
    timer.current = setTimeout(() => {
      shownAt.current = performance.now()
      setPhase('go')
      lampGo()
    }, waitMs())
    setTrials(done)
  }
  const finish = (all: (number | 'early')[]) => {
    setTrials(all)
    setPhase('done')
    const s = summarize(all)
    onResult(s.medianMs === null ? null : s)
  }
  const record = (t: number | 'early') => {
    const all = [...trials, t]
    if (t === 'early') tapEarly(); else tapTick()
    setNote(t === 'early' ? 'Too early, that attempt does not count.' : `${Math.round(t)} ms`)
    if (all.length >= TRIALS) finish(all)
    else arm(all)
  }
  const press = () => {
    if (phase === 'idle' || phase === 'done') {
      setNote('')
      onResult(null)
      arm([])
    } else if (phase === 'wait') {
      clearTimeout(timer.current)
      record('early')
    } else if (phase === 'go') {
      record(performance.now() - shownAt.current)
    }
  }
  const s = summarize(trials)
  const shown = phase === 'done' && s.medianMs !== null
  const base = baselineMs != null ? Math.round(baselineMs) : null
  const label = { idle: 'Start reaction test', wait: 'Wait for green…', go: 'TAP NOW', done: 'Run again' }[phase]
  return (
    <fieldset className="ci-q ci-rt" aria-label="Reaction-time test">
      <legend className="ci-legend">Reaction-time test · {TRIALS} taps</legend>
      <div className="ci-rt-grid">
        <div className={`ci-lamp ${phase}${shown ? ' shown' : ''}`}>
          <svg viewBox="0 0 300 300" aria-hidden="true">
            <circle cx="150" cy="150" r="124" className="ci-lamp-ring" />
            {TICKS.map((t) => <line key={t.k} x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2} className={t.major ? 'major' : undefined} />)}
          </svg>
          <button type="button" className={`ci-pad ${phase}`} onClick={press}>{label}</button>
          {shown && <p className="ci-lamp-ro" aria-hidden="true"><b>{s.medianMs}</b>ms · median</p>}
        </div>
        <div className="ci-rt-info">
          <p className="ci-rt-help">
            When the lamp turns <b className="ok">green</b>, tap it as fast as you can. Tapping early does not count. Responses over {LAPSE_MS} ms are lapses (PVT convention).
          </p>
          <dl className="kpis ci-trials">
            {Array.from({ length: TRIALS }, (_, i) => {
              const v = trials[i]
              const cur = (phase === 'wait' || phase === 'go') && i === trials.length
              return (
                <KpiCell key={i} className={`${v === 'early' ? 'early' : ''}${cur ? ' cur' : ''}`.trim() || undefined} label={`Tap ${i + 1}`}
                  value={v === undefined ? '—' : v === 'early' ? 'Early' : Math.round(v)} sub={typeof v === 'number' ? 'ms' : undefined} />
              )
            })}
          </dl>
          {shown && (
            <dl className="kpis ci-rt-stats">
              {base !== null && <KpiCell label="Your baseline" value={base} sub="ms" />}
              {base !== null && <KpiCell label="vs baseline" value={`${s.medianMs! - base >= 0 ? '+' : '−'}${Math.abs(s.medianMs! - base)}`} sub="ms" />}
              <KpiCell label={`Lapses >${LAPSE_MS}`} value={s.lapses} />
            </dl>
          )}
          <p className="ci-rt-status" role="status" aria-live="polite">
            {phase === 'done'
              ? s.medianMs === null
                ? `Only ${s.valid} valid taps (need ${MIN_VALID_TRIALS}). Run again.`
                : `Median ${s.medianMs} ms · ${s.lapses} lapse${s.lapses === 1 ? '' : 's'} · ${s.falseStarts} early`
              : phase === 'idle' ? 'Not taken yet (optional).' : `Tap ${Math.min(trials.length + 1, TRIALS)} of ${TRIALS}${note ? ` · last: ${note}` : ''}`}
          </p>
        </div>
      </div>
    </fieldset>
  )
}
