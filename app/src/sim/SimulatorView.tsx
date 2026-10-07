import { Activity, CircleCheck, Dumbbell, FastForward, Moon, OctagonAlert, Sun, TrendingDown, TriangleAlert, Wind, type LucideIcon } from 'lucide-react'
import { useState } from 'react'
import { alertTitle, met } from '../engine/actions'
import { SCENARIOS, type ScenarioId } from '../data/synthetic'
import { METRICS, type Alert, type CrewMember } from '../data/types'
import type { AdvanceResult, Injection } from './advance'
import type { FeedEvent, FeedKind } from './feed'
import { MissionClock } from './MissionClock'

const STEPS = [
  { hours: 1, label: '+1 h' },
  { hours: 6, label: '+6 h' },
  { hours: 24, label: '+1 day' },
  { hours: 72, label: '+3 days' },
]
const ICON: Record<ScenarioId, LucideIcon> = { solar: Sun, co2: Wind, insomnia: Moon, deconditioning: Dumbbell }
const FEED: Record<FeedKind, { icon: LucideIcon; word: string; cls: string }> = {
  opened: { icon: TriangleAlert, word: 'OPENED', cls: 'st-watch' },
  escalated: { icon: OctagonAlert, word: 'ESCALATED', cls: 'st-act' },
  eased: { icon: TrendingDown, word: 'EASED', cls: 'st-watch' },
  resolved: { icon: CircleCheck, word: 'RESOLVED', cls: 'st-nominal' },
}

const title = (a: Alert, crew: CrewMember[]) =>
  `${crew.find((c) => c.id === a.crewId)?.name ?? a.crewId}: ${alertTitle(a)} (${a.status.toUpperCase()})`

interface Props {
  crew: CrewMember[]
  now: number
  injections: Injection[]
  last: AdvanceResult | null
  busy: boolean
  error: string
  /** What the engine did, newest first. */
  events?: FeedEvent[]
  onInject: (scenario: ScenarioId, crewIds: string[]) => void
  onAdvance: (hours: number) => void
  onCancel: (index: number) => void
  onReset: () => void
}

/** Mission control: scenario cards, a time scrubber with a running clock, and a live feed of what the engine decided. */
export function SimulatorView({ crew, now, injections, last, busy, error, events = [], onInject, onAdvance, onCancel, onReset }: Props) {
  const [who, setWho] = useState<Record<string, string>>({})
  const [confirm, setConfirm] = useState(false)
  const targets = (id: ScenarioId): string[] => {
    const s = SCENARIOS.find((x) => x.id === id)!
    const pick = who[id] ?? 'default'
    return pick === 'default' ? (s.crewIds === 'all' ? crew.map((c) => c.id) : s.crewIds) : pick === 'all' ? crew.map((c) => c.id) : [pick]
  }
  return (
    <div className="board">
      <section className="glass mc-head">
        <div>
          <h1 style={{ margin: 0 }}>Mission simulator</h1>
          <p className="muted" style={{ marginBottom: 0 }}>
            Demo tool. Inject a scenario, then move mission time forward and watch the board, alerts and trends respond. Everything runs through the same engine as real readings.
          </p>
        </div>
        <MissionClock now={now} />
      </section>

      <div className="mc-grid">
        <div className="mc-main">
          <section aria-label="Scenarios">
            <h2 className="sec-title">Scenarios</h2>
            <ul className="sim-grid">
              {SCENARIOS.map((s) => {
                const Icon = ICON[s.id]
                return (
                  <li key={s.id} className="glass">
                    <span className="sim-ico"><Icon size={22} aria-hidden="true" /></span>
                    <h3>{s.label}</h3>
                    <p className="sim-dur mono">{s.days} day{s.days > 1 ? 's' : ''}</p>
                    <ul className="sim-metrics" aria-label="Affected metrics">
                      {Object.keys(s.shifts).map((m) => <li key={m}>{METRICS[m as keyof typeof METRICS].label}</li>)}
                    </ul>
                    <label className="field">
                      <span>Who</span>
                      <select value={who[s.id] ?? 'default'} onChange={(e) => setWho({ ...who, [s.id]: e.target.value })}>
                        <option value="default">{s.crewIds === 'all' ? 'Whole crew' : crew.filter((c) => s.crewIds.includes(c.id)).map((c) => c.name).join(', ')}</option>
                        {s.crewIds !== 'all' && <option value="all">Whole crew</option>}
                        {crew.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </label>
                    <button type="button" className="btn" disabled={busy} onClick={() => onInject(s.id, targets(s.id))}>Inject</button>
                  </li>
                )
              })}
            </ul>
          </section>

          <section className="glass" aria-label="Active scenarios">
            <h2 className="sec-title" style={{ marginTop: 0 }}>Running now</h2>
            {injections.length === 0 ? <p className="muted">No scenario running.</p> : (
              <ul className="resolved-list">
                {injections.map((i, idx) => (
                  <li key={idx} className="sim-active">
                    <span><b>{SCENARIOS.find((s) => s.id === i.scenario)!.label}</b> <span className="mono muted">· {i.crewIds.length === crew.length ? 'whole crew' : i.crewIds.join(', ')} · until {met(i.endTs)}</span></span>
                    <button type="button" className="btn ghost" onClick={() => onCancel(idx)}>End now</button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="glass" aria-label="Time controls">
            <h2 className="sec-title" style={{ marginTop: 0 }}>Fast-forward mission time</h2>
            <div className={`scrub${busy ? ' busy' : ''}`}>
              <div className="scrub-track" aria-hidden="true"><span className="scrub-run" /></div>
              <div className="sim-steps" role="group" aria-label="Advance time">
                {STEPS.map((s) => <button key={s.hours} type="button" className="btn" disabled={busy} onClick={() => onAdvance(s.hours)}><FastForward size={15} aria-hidden="true" />{s.label}</button>)}
              </div>
            </div>
            {busy && <p role="status" className="muted">Running readings through the engine…</p>}
            {error && <p role="alert" className="form-error">{error}</p>}
            {last && !busy && (
              <div role="status" aria-label="Last run" className="sim-last">
                <p className="mono muted">{met(last.from)} to {met(last.to)} · {last.readings} readings</p>
                {last.opened.length === 0 && last.resolved.length === 0 && <p className="muted">No alert changes.</p>}
                {last.opened.map((a) => <p key={`o${a.id}`}><b className="mono">NEW</b> {title(a, crew)}</p>)}
                {last.resolved.map((a) => <p key={`r${a.id}`} className="muted"><b className="mono">CLEARED</b> {title(a, crew)}</p>)}
              </div>
            )}
          </section>
        </div>

        <section className="glass feed" aria-label="Engine event feed">
          <h2 className="sec-title" style={{ marginTop: 0 }}><Activity size={14} aria-hidden="true" /> Engine event feed</h2>
          {events.length === 0 ? <p className="muted">No alert activity yet. Inject a scenario and move time forward.</p> : (
            <ol className="feed-list">
              {events.map((ev) => {
                const f = FEED[ev.kind]
                const Icon = f.icon
                return (
                  <li key={ev.id} className={f.cls}>
                    <span className="feed-ico"><Icon size={16} aria-hidden="true" /></span>
                    <div>
                      <p className="feed-head"><b>{ev.crew}</b><span className="badge">{f.word}</span><span className="mono muted">{met(ev.ts)}</span></p>
                      <p className="feed-text">{ev.text}</p>
                    </div>
                  </li>
                )
              })}
            </ol>
          )}
        </section>
      </div>

      <section className="glass" aria-label="Reset">
        <h2 className="sec-title" style={{ marginTop: 0 }}>Reset</h2>
        <p className="muted">Replaces all local data (readings, alerts, log, check-ins) with the starting demo mission.</p>
        {confirm ? (
          <div className="sim-steps">
            <button type="button" className="btn danger" disabled={busy} onClick={() => { setConfirm(false); onReset() }}>Yes, erase and reset</button>
            <button type="button" className="btn ghost" onClick={() => setConfirm(false)}>Cancel</button>
          </div>
        ) : (
          <button type="button" className="btn ghost" disabled={busy} onClick={() => setConfirm(true)}>Reset to demo mission</button>
        )}
      </section>
    </div>
  )
}
