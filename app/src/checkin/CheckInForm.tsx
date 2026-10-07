import { useState } from 'react'
import { CrewTabs } from '../board/CrewTabs'
import type { CrewMember } from '../data/types'
import type { PvtSummary } from './pvt'
import { ReactionTest } from './ReactionTest'
import { SYMPTOMS, type CheckInInput, type CheckInResult } from './submit'

const SCALE_MOOD = ['Very low', 'Low', 'Okay', 'Good', 'Great']
const SCALE_SLEEP = ['Very poor', 'Poor', 'Fair', 'Good', 'Very good']

function Scale({ name, legend, labels, value, onChange }: { name: string; legend: string; labels: string[]; value: number | null; onChange: (n: number) => void }) {
  return (
    <fieldset className="scale">
      <legend>{legend}</legend>
      <div className="scale-row">
        {labels.map((l, i) => (
          <label key={l} className={value === i + 1 ? 'on' : ''}>
            <input type="radio" name={name} value={i + 1} checked={value === i + 1} onChange={() => onChange(i + 1)} />
            <b className="mono">{i + 1}</b>
            <span>{l}</span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}

interface Props {
  crew: CrewMember[]
  crewId: string
  now: number
  onSelectCrew: (id: string) => void
  onSubmit: (input: CheckInInput) => Promise<CheckInResult>
  /** Test seam to stub the reaction pad. */
  reactionTest?: typeof ReactionTest
}

export function CheckInForm({ crew, crewId, now, onSelectCrew, onSubmit, reactionTest: Reaction = ReactionTest }: Props) {
  const [mood, setMood] = useState<number | null>(null)
  const [sleepQuality, setSleepQuality] = useState<number | null>(null)
  const [hours, setHours] = useState('')
  const [symptoms, setSymptoms] = useState<string[]>([])
  const [pvt, setPvt] = useState<PvtSummary | null>(null)
  const [result, setResult] = useState<CheckInResult | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const who = crew.find((c) => c.id === crewId)

  const reset = () => { setMood(null); setSleepQuality(null); setHours(''); setSymptoms([]); setPvt(null); setError('') }
  const toggle = (s: string) => setSymptoms((cur) => (cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s]))

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
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
    <div className="board">
      <div className="board-head"><CrewTabs crew={crew} crewId={crewId} onSelect={(id) => { setResult(null); reset(); onSelectCrew(id) }} /></div>
      <section className="glass">
        <h1 style={{ margin: 0 }}>Daily check-in · {who?.name}</h1>
        <p className="muted" style={{ marginBottom: 0 }}>
          Two minutes. Your answers join your own baseline, so the console can spot drift in how you feel and react before it becomes a problem.
        </p>
      </section>

      {result && (
        <section className="glass checkin-done" role="status" aria-label="Check-in saved">
          <h2>Check-in saved and logged</h2>
          {result.raised.length === 0 && result.resolved.length === 0 && <p className="muted">Nothing new for the engine to flag.</p>}
          {result.raised.map((a) => <p key={a.id}><b className="mono">{a.status.toUpperCase()}</b> {a.explanation} See the Alerts tab.</p>)}
          {result.resolved.map((a) => <p key={a.id} className="muted">An earlier alert cleared: {a.metric}.</p>)}
        </section>
      )}

      <form className="glass checkin" onSubmit={submit} aria-label="Daily check-in form" noValidate>
        <Scale name="mood" legend="How is your mood?" labels={SCALE_MOOD} value={mood} onChange={setMood} />
        <Scale name="sleepQuality" legend="How well did you sleep?" labels={SCALE_SLEEP} value={sleepQuality} onChange={setSleepQuality} />
        <label className="field">
          <span>Hours slept (optional)</span>
          <input type="number" inputMode="decimal" min={0} max={16} step={0.1} value={hours} onChange={(e) => setHours(e.target.value)} placeholder="blank = use wearable" />
        </label>
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
          <p className="muted note">Symptoms go to the on-board log for review; they do not trigger alerts yet.</p>
        </fieldset>
        <Reaction onResult={setPvt} />
        {error && <p role="alert" className="form-error">{error}</p>}
        <button type="submit" className="btn" disabled={busy}>{busy ? 'Saving…' : 'Save check-in'}</button>
      </form>
    </div>
  )
}
