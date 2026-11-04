import { ArrowLeft, ArrowRight, BatteryCharging, BatteryFull, BatteryLow, BatteryMedium, BatteryWarning, Check, Frown, Annoyed, Info, Laugh, Meh, Smile, type LucideIcon } from 'lucide-react'
import { useState } from 'react'
import { confirmChime } from '../audio/sfx'
import { announce } from '../audio/voice'
import { Link } from 'react-router-dom'
import { alertTitle, met } from '../engine/actions'
import type { CrewMember } from '../data/types'
import { Brackets, HudPanel, KpiCell, KpiGrid, PanelHeader, StatusTag, buttonClass } from '../ui'
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
const META = ['Scale 1–5 · required', 'Scale 1–5 · required', 'Any number · optional', '5 taps · optional']
const EYEBROW = ['Q1 · Mood', 'Q2 · Sleep quality', 'Q3 · Symptoms', 'Q4 · Psychomotor vigilance']

/** One big question: five large illustrated choices. The radios stay real inputs, so keyboard and screen readers work. */
function Scale({ name, legend, sub, options, value, onChange }: { name: string; legend: string; sub: string; options: { label: string; icon: LucideIcon }[]; value: number | null; onChange: (n: number) => void }) {
  return (
    <fieldset className="ci-q">
      <legend className="ci-legend">{legend}</legend>
      <p className="ci-sub">{sub}</p>
      <div className="ci-tiles">
        {options.map((o, i) => {
          const Icon = o.icon
          return (
            <label key={o.label} className={value === i + 1 ? 'ci-tile on' : 'ci-tile'}>
              <input type="radio" name={name} value={i + 1} checked={value === i + 1} onChange={() => onChange(i + 1)} />
              <Icon size={34} strokeWidth={1.6} aria-hidden="true" />
              <b>{i + 1}</b>
              <span>{o.label}</span>
            </label>
          )
        })}
      </div>
      <p className="ci-axis" aria-hidden="true"><span>◂ Worse</span><span>Better ▸</span></p>
    </fieldset>
  )
}

interface Answers { mood: number | null; sleepQuality: number | null; hours?: number; symptoms: string[]; reactionMs?: number }

/** The left procedure panel: one row per step, with what was answered so far. */
function Procedure({ step, a, now, baselineMs }: { step: number; a: Answers; now: number; baselineMs?: number | null }) {
  const answer = [
    a.mood !== null ? `${a.mood} · ${MOOD[a.mood - 1].label}` : '',
    a.sleepQuality !== null ? `${a.sleepQuality} · ${SLEEP[a.sleepQuality - 1].label}${a.hours !== undefined ? ` · ${a.hours} h` : ''}` : '',
    a.symptoms.length === 0 ? 'None' : `${a.symptoms.length} selected`,
    a.reactionMs !== undefined ? `${a.reactionMs} ms median` : 'Skipped',
  ]
  return (
    <HudPanel title="Procedure" meta={step < STEPS.length ? `Step ${step + 1} / ${STEPS.length}` : 'Complete'} className="ci-proc-panel">
      <ol className="ci-proc" aria-hidden="true">
        {STEPS.map((s, i) => (
          <li key={s} className={i < step ? 'done' : i === step ? 'cur' : ''}>
            <span className="ci-d"><b>{i + 1}</b></span>
            <span className="ci-nm">{s}</span>
            <span className="ci-an">{i < step ? answer[i] : i === step ? 'In progress' : i === 3 ? 'Optional' : 'Waiting'}</span>
            {i < step && <span className="ci-st"><StatusTag status="nominal" label="Done" /></span>}
          </li>
        ))}
      </ol>
      <KpiGrid>
        <KpiCell label="Mission time" value={<span className="ci-met">{met(now).replace(' MET', '')}</span>} />
        <KpiCell label="Reaction base" value={baselineMs != null ? Math.round(baselineMs) : '—'} sub={baselineMs != null ? 'ms' : 'after 5 tests'} />
      </KpiGrid>
      <p className="ci-note">One check-in per mission day counts; a later one the same day replaces it. Entries wait in the on-board log until the next ground-link window.</p>
    </HudPanel>
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
  const index = crew.findIndex((c) => c.id === crewId)
  const who = crew[index]
  const last = step === STEPS.length - 1

  const reset = () => { setStep(0); setMood(null); setSleepQuality(null); setHours(''); setSymptoms([]); setPvt(null); setError('') }
  const toggle = (s: string) => setSymptoms((cur) => (cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s]))
  const canNext = step === 0 ? mood !== null : step === 1 ? sleepQuality !== null : true
  const h = hours.trim() === '' || Number.isNaN(Number(hours)) ? undefined : Number(hours)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!last) return
    if (mood === null || sleepQuality === null) return setError('Pick a mood and a sleep quality first.')
    setBusy(true)
    setError('')
    try {
      setResult(await onSubmit({ crewId, ts: now, mood, sleepQuality, sleepHours: hours.trim() === '' ? undefined : Number(hours), symptoms, reactionMs: pvt?.medianMs ?? undefined }))
      reset()
      confirmChime()
      window.setTimeout(() => announce('Check in saved and logged.'), 500)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  // After saving, the procedure shows what was logged.
  const answers: Answers = result
    ? { mood: result.checkIn.mood, sleepQuality: result.checkIn.sleepQuality, symptoms: result.checkIn.symptoms, reactionMs: result.checkIn.reactionMs }
    : { mood, sleepQuality, hours: h, symptoms, reactionMs: pvt?.medianMs ?? undefined }

  return (
    <div className="ci">
      <div className="ci-side">
        <HudPanel title="Daily check-in" meta="≈ 2 min" className="ci-who">
          <p className="ci-eb">Crew {String(index + 1).padStart(2, '0')} · {who?.role}</p>
          <h1 className="ci-h1">Daily check-in · {who?.name}</h1>
          <p className="ci-intro">Two minutes. Your answers join your own baseline, so the console can spot drift in how you feel and react before it becomes a problem.</p>
        </HudPanel>
        <Procedure step={result ? STEPS.length : step} a={answers} now={now} baselineMs={baselineMs} />
      </div>

      {result ? (
        <HudPanel className="ci-bay ci-done" role="status" aria-label="Check-in saved">
          <Brackets />
          <PanelHeader title="Check-in // saved" meta={met(result.checkIn.ts)} />
          <div className="ci-body">
            <div className="ci-done-h">
              <span className="ci-ok" aria-hidden="true"><Check size={26} /></span>
              <div>
                <p className="ci-eb ok">Logged · waiting for downlink</p>
                <h2 className="ci-title">Check-in saved and logged</h2>
              </div>
              <StatusTag status="nominal" label="Saved" />
            </div>
            {result.raised.length === 0 && result.resolved.length === 0 && <p className="ci-sub">Nothing new for the engine to flag.</p>}
            {result.raised.map((a) => (
              <div key={a.id} className={`ci-raised st-${a.status}`}>
                <span className="q-code" aria-hidden="true">{a.hazard}</span>
                <p><b>{alertTitle(a)}:</b> {a.explanation} See the Alerts tab.</p>
                <StatusTag status={a.status} />
              </div>
            ))}
            {result.resolved.map((a) => <p key={a.id} className="ci-cleared">An earlier alert cleared: {alertTitle(a)}.</p>)}
            <PanelHeader title="What happens next" level={3} />
            <ul className="ci-next">
              <li>Your mood{result.checkIn.reactionMs !== undefined ? ' and reaction time join' : ' joins'} your own baseline; the board and trends update at once.</li>
              <li>Low sleep together with a slow reaction time raises a fatigue alert. A symptom three days in a row, or three at once, raises one too.</li>
              <li>The entry waits in the on-board log until the next ground-link window.</li>
            </ul>
            <div className="ci-acts">
              <Link to="/board" className={buttonClass('primary')}>View the board</Link>
              {result.raised.length > 0 && <Link to="/alerts" className={buttonClass('ghost')}>Open Alerts</Link>}
              <button type="button" className={buttonClass('ghost')} onClick={() => setResult(null)}>Add another check-in</button>
            </div>
          </div>
        </HudPanel>
      ) : (
        <form className="hp ci-bay" onSubmit={submit} aria-label="Daily check-in form" noValidate>
          <Brackets />
          <PanelHeader title={`Question ${step + 1} // ${STEPS[step]}`} meta={META[step]} />
          <div className="ci-body">
            <div className="ci-ask">
              <p className="ci-eb cy" aria-hidden="true">{EYEBROW[step]}</p>
              {step === 0 && <Scale name="mood" legend="How is your mood?" sub="Pick the one that fits right now." options={MOOD} value={mood} onChange={setMood} />}
              {step === 1 && (
                <>
                  <Scale name="sleepQuality" legend="How well did you sleep?" sub="Think of your last main sleep period." options={SLEEP} value={sleepQuality} onChange={setSleepQuality} />
                  <div className="ci-hours">
                    <label htmlFor="ci-hours">Hours slept (optional)</label>
                    <span className="ci-inp">
                      <input id="ci-hours" type="number" inputMode="decimal" min={0} max={16} step={0.1} value={hours} onChange={(e) => setHours(e.target.value)} placeholder="—" aria-describedby="ci-hours-hint" />
                      <span className="ro-unit" aria-hidden="true">h</span>
                    </span>
                    <span id="ci-hours-hint" className="ci-hint">Blank = use wearable</span>
                  </div>
                </>
              )}
              {step === 2 && (
                <fieldset className="ci-q">
                  <legend className="ci-legend">Any symptoms today?</legend>
                  <p className="ci-sub">Select all that apply. Leave them all off if you feel fine.</p>
                  <div className="ci-chips">
                    {SYMPTOMS.map((s) => (
                      <label key={s} className={symptoms.includes(s) ? 'ci-chip on' : 'ci-chip'}>
                        <input type="checkbox" checked={symptoms.includes(s)} onChange={() => toggle(s)} />
                        <span className="ci-box" aria-hidden="true" />
                        {s}
                      </label>
                    ))}
                  </div>
                  <p className="ci-rules"><Info size={18} aria-hidden="true" />A symptom on three daily check-ins in a row, three or more symptoms at once, or blurred vision two days in a row raises an alert (illustrative rules).</p>
                </fieldset>
              )}
              {step === 3 && <Reaction onResult={setPvt} baselineMs={baselineMs} />}
              {error && <p role="alert" className="form-error">{error}</p>}
            </div>
          </div>
          <div className="ci-nav">
            <button type="button" className={buttonClass('ghost')} disabled={step === 0} onClick={() => { setError(''); setStep(step - 1) }}><ArrowLeft size={16} aria-hidden="true" />Back</button>
            <div className="ci-prog" role="progressbar" aria-label="Check-in progress" aria-valuemin={1} aria-valuemax={STEPS.length} aria-valuenow={step + 1} aria-valuetext={`Step ${step + 1} of ${STEPS.length}: ${STEPS[step]}`}>
              <span className="ci-track" aria-hidden="true">{STEPS.map((s, i) => <i key={s} className={i < step ? 'done' : i === step ? 'cur' : ''} />)}</span>
              <span className="ci-prog-l" aria-hidden="true">Step {step + 1} of {STEPS.length} · {STEPS[step]}</span>
            </div>
            {last
              ? <button type="submit" className={buttonClass('primary')} disabled={busy} aria-busy={busy || undefined}>{busy ? 'Saving…' : 'Save check-in'}</button>
              : <button type="button" className={buttonClass('primary')} disabled={!canNext} onClick={() => { setError(''); setStep(step + 1) }}>Next<ArrowRight size={16} aria-hidden="true" /></button>}
          </div>
        </form>
      )}
    </div>
  )
}
