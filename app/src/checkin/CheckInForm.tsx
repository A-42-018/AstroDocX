import { ArrowLeft, ArrowRight, BatteryCharging, BatteryFull, BatteryLow, BatteryMedium, BatteryWarning, Frown, Annoyed, Laugh, Meh, Smile, type LucideIcon } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { alertTitle } from '../engine/actions'
import type { CrewMember } from '../data/types'
import type { PvtSummary } from './pvt'
import { ReactionTest } from './ReactionTest'
import { SYMPTOMS, type CheckInInput, type CheckInResult } from './submit'

const MOOD: { label: string; icon: LucideIcon }[] = [
  { label: 'Very low', icon: Frown }, { label: 'Low', icon: Annoyed }, { label: 'Okay', icon: Meh }, { label: 'Good', icon: Smile }, { label: 'Great', icon: Laugh },
]
const SLEEP: { label: string; icon: LucideIcon }[] = [
  { label: 'Very poor', icon: BatteryLow }, { label: 'Poor', icon: BatteryWarning }, { label: 'Fair', icon: BatteryMedium }, { label: 'Good', icon: BatteryFull }, { label: 'Very good', icon: BatteryCharging },
]
const STEPS = ['Mood', 'Sleep', 'Symptoms', 'Reaction test'] as const

/** One big question: five large illustrated choices. The radios stay real inputs, so keyboard and screen readers work. */
function Scale({ name, legend, options, value, onChange }: { name: string; legend: string; options: { label: string; icon: LucideIcon }[]; value: number | null; onChange: (n: number) => void }) {
  return (
    <fieldset className="scale">
      <legend>{legend}</legend>
      <div className="scale-row big">
        {options.map((o, i) => {
          const Icon = o.icon
          return (
            <label key={o.label} className={value === i + 1 ? 'on' : ''}>
              <input type="radio" name={name} value={i + 1} checked={value === i + 1} onChange={() => onChange(i + 1)} />
              <Icon size={34} strokeWidth={1.6} aria-hidden="true" />
              <b className="mono">{i + 1}</b>
              <span>{o.label}</span>
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}

interface Props {
  crew: CrewMember[]
  crewId: string
  now: number
  onSubmit: (input: CheckInInput) => Promise<CheckInResult>
  /** The person's own reaction-time baseline (ms), shown next to the test result. */
  baselineMs?: number | null
  /** Test seam to stub the reaction pad. */
  reactionTest?: typeof ReactionTest
}

export function CheckInForm({ crew, crewId, now, onSubmit, baselineMs, reactionTest: Reaction = ReactionTest }: Props) {
  const [step, setStep] = useState(0)
  const [mood, setMood] = useState<number | null>(null)
  const [sleepQuality, setSleepQuality] = useState<number | null>(null)
  const [hours, setHours] = useState('')
  const [symptoms, setSymptoms] = useState<string[]>([])
  const [pvt, setPvt] = useState<PvtSummary | null>(null)
  const [result, setResult] = useState<CheckInResult | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const who = crew.find((c) => c.id === crewId)
  const last = step === STEPS.length - 1

  const reset = () => { setStep(0); setMood(null); setSleepQuality(null); setHours(''); setSymptoms([]); setPvt(null); setError('') }
  const toggle = (s: string) => setSymptoms((cur) => (cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s]))
  const canNext = step === 0 ? mood !== null : step === 1 ? sleepQuality !== null : true

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!last) return
    if (mood === null || sleepQuality === null) return setError('Pick a mood and a sleep quality first.')
    setBusy(true)
    setError('')
    try {
      const h = hours.trim() === '' ? undefined : Number(hours)
      setResult(await onSubmit({ crewId, ts: now, mood, sleepQuality, sleepHours: h, symptoms, reactionMs: pvt?.medianMs ?? undefined }))
      reset()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="board board-form">
      <section className="glass">
        <h1 style={{ margin: 0 }}>Daily check-in · {who?.name}</h1>
        <p className="muted" style={{ marginBottom: 0 }}>
          Two minutes. Your answers join your own baseline, so the console can spot drift in how you feel and react before it becomes a problem.
        </p>
      </section>

      {result ? (
        <section className="glass checkin-done" role="status" aria-label="Check-in saved">
          <h2>Check-in saved and logged</h2>
          {result.raised.length === 0 && result.resolved.length === 0 && <p className="muted">Nothing new for the engine to flag.</p>}
          {result.raised.map((a) => <p key={a.id}><b className="mono">{a.status.toUpperCase()}</b> {a.explanation} See the Alerts tab.</p>)}
          {result.resolved.map((a) => <p key={a.id} className="muted">An earlier alert cleared: {alertTitle(a)}.</p>)}
          <h3 className="sec-title">What happens next</h3>
          <ul className="next-list">
            <li>Your mood{result.checkIn.reactionMs !== undefined ? ', reaction time' : ''}{' '}joins your own baseline; the board and trends update at once.</li>
            <li>Low sleep together with a slow reaction time raises a fatigue alert. A symptom three days in a row, or three at once, raises one too.</li>
            <li>The entry waits in the on-board log until the next ground-link window.</li>
          </ul>
          <div className="sim-steps">
            <Link to="/board" className="btn">View the board</Link>
            {result.raised.length > 0 && <Link to="/alerts" className="btn ghost">Open Alerts</Link>}
            <button type="button" className="btn ghost" onClick={() => setResult(null)}>Add another check-in</button>
          </div>
        </section>
      ) : (
        <form className="glass checkin wizard" onSubmit={submit} aria-label="Daily check-in form" noValidate>
          <div className="wiz-progress" role="progressbar" aria-label="Check-in progress" aria-valuemin={1} aria-valuemax={STEPS.length} aria-valuenow={step + 1} aria-valuetext={`Step ${step + 1} of ${STEPS.length}: ${STEPS[step]}`}>
            <span style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} />
          </div>
          <ol className="wiz-steps" aria-hidden="true">
            {STEPS.map((s, i) => <li key={s} className={i === step ? 'on' : i < step ? 'done' : ''}><b className="mono">{i + 1}</b> {s}</li>)}
          </ol>

          {step === 0 && <Scale name="mood" legend="How is your mood?" options={MOOD} value={mood} onChange={setMood} />}
          {step === 1 && (
            <>
              <Scale name="sleepQuality" legend="How well did you sleep?" options={SLEEP} value={sleepQuality} onChange={setSleepQuality} />
              <label className="field">
                <span>Hours slept (optional)</span>
                <input type="number" inputMode="decimal" min={0} max={16} step={0.1} value={hours} onChange={(e) => setHours(e.target.value)} placeholder="blank = use wearable" />
              </label>
            </>
          )}
          {step === 2 && (
            <fieldset className="symptoms">
              <legend>Any symptoms today?</legend>
              <div className="chips">
                {SYMPTOMS.map((s) => (
                  <label key={s} className={symptoms.includes(s) ? 'chip on' : 'chip'}>
                    <input type="checkbox" checked={symptoms.includes(s)} onChange={() => toggle(s)} />
                    {s}
                  </label>
                ))}
              </div>
              <p className="muted note">A symptom on three daily check-ins in a row, three or more symptoms at once, or blurred vision two days in a row raises an alert (illustrative rules). One check-in per mission day counts; a later one the same day replaces it.</p>
            </fieldset>
          )}
          {step === 3 && <Reaction onResult={setPvt} baselineMs={baselineMs} />}

          {error && <p role="alert" className="form-error">{error}</p>}
          <div className="wiz-nav">
            <button type="button" className="btn ghost" disabled={step === 0} onClick={() => { setError(''); setStep(step - 1) }}><ArrowLeft size={16} aria-hidden="true" />Back</button>
            {last
              ? <button type="submit" className="btn" disabled={busy}>{busy ? 'Saving…' : 'Save check-in'}</button>
              : <button type="button" className="btn" disabled={!canNext} onClick={() => { setError(''); setStep(step + 1) }}>Next<ArrowRight size={16} aria-hidden="true" /></button>}
          </div>
        </form>
      )}
    </div>
  )
}
