import { useEffect, useRef, useState } from 'react'
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

/** Tap-the-pad reaction test: wait for the pad to turn green, then tap as fast as you can. */
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
  const label = { idle: 'Start reaction test', wait: 'Wait for green…', go: 'TAP NOW', done: 'Run again' }[phase]
  return (
    <fieldset className="rt" aria-label="Reaction-time test">
      <legend>Reaction-time test · {TRIALS} taps</legend>
      <p className="muted rt-help">
        When the pad turns green, tap it as fast as you can. Tapping early does not count. Responses over {LAPSE_MS} ms are lapses (PVT convention).
      </p>
      <button type="button" className={`rt-pad ${phase}`} onClick={press}>{label}</button>
      {phase === 'done' && s.medianMs !== null && (
        <div className="rt-result" aria-hidden="true">
          <b className="mono">{s.medianMs}<small> ms</small></b>
          <span>median of {s.valid} taps</span>
          {baselineMs != null && <span className="mono">{Math.round(baselineMs)} ms is your baseline ({s.medianMs - Math.round(baselineMs) >= 0 ? '+' : '−'}{Math.abs(s.medianMs - Math.round(baselineMs))} ms)</span>}
          <span>{s.lapses === 0 ? 'No lapses' : `${s.lapses} lapse${s.lapses === 1 ? '' : 's'} over ${LAPSE_MS} ms`}</span>
        </div>
      )}
      <p className="mono rt-status" role="status" aria-live="polite">
        {phase === 'done'
          ? s.medianMs === null
            ? `Only ${s.valid} valid taps (need ${MIN_VALID_TRIALS}). Run again.`
            : `Median ${s.medianMs} ms · ${s.lapses} lapse${s.lapses === 1 ? '' : 's'} · ${s.falseStarts} early`
          : phase === 'idle' ? 'Not taken yet (optional).' : `Tap ${Math.min(trials.length + 1, TRIALS)} of ${TRIALS}${note ? ` · last: ${note}` : ''}`}
      </p>
    </fieldset>
  )
}
