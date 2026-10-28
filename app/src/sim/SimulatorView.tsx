import { ChevronDown, Dumbbell, FastForward, Moon, Sun, Wind, type LucideIcon } from 'lucide-react'
import { useState } from 'react'
import { alertTitle, met } from '../engine/actions'
import { SCENARIOS, type ScenarioId } from '../data/synthetic'
import { METRICS, type Alert, type CrewMember, type Status } from '../data/types'
import { Brackets, HudPanel, PanelHeader, buttonClass } from '../ui'
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
const FEED: Record<FeedKind, { word: string; short: string; st: Status }> = {
  opened: { word: 'OPENED', short: 'Opened', st: 'watch' },
  escalated: { word: 'ESCALATED', short: 'Escal.', st: 'act' },
  eased: { word: 'EASED', short: 'Eased', st: 'watch' },
  resolved: { word: 'RESOLVED', short: 'Resolved', st: 'nominal' },
}
const KINDS = Object.keys(FEED) as FeedKind[]

const title = (a: Alert, crew: CrewMember[]) =>
  `${crew.find((c) => c.id === a.crewId)?.name ?? a.crewId}: ${alertTitle(a)} (${a.status.toUpperCase()})`
const shortMet = (ts: number) => met(ts).replace(' MET', '')

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

/** Mission control (plan §4.6): the clock hero with the transport strip, scenario modules, running scenarios, reset and the engine feed. */
export function SimulatorView({ crew, now, injections, last, busy, error, events = [], onInject, onAdvance, onCancel, onReset }: Props) {
  const [who, setWho] = useState<Record<string, string>>({})
  const [confirm, setConfirm] = useState(false)
  const targets = (id: ScenarioId): string[] => {
    const s = SCENARIOS.find((x) => x.id === id)!
    const pick = who[id] ?? 'default'
    return pick === 'default' ? (s.crewIds === 'all' ? crew.map((c) => c.id) : s.crewIds) : pick === 'all' ? crew.map((c) => c.id) : [pick]
  }
  const names = (ids: string[]) => (ids.length === crew.length ? 'Whole crew' : ids.map((id) => crew.find((c) => c.id === id)?.name ?? id).join(', '))
  return (
    <div className="sim-page">
      <section className="hp sm-clock" aria-labelledby="sm-h1">
        <Brackets />
        <div className="sm-intro">
          <PanelHeader title="Mission control" meta="Demo tool" />
          <h1 id="sm-h1" className="sm-h1">Mission simulator</h1>
          <p className="sm-lede">Inject a scenario, then move mission time forward and watch the board, alerts and trends respond. Everything runs through the same engine as real readings.</p>
        </div>
        <div className="sm-clk" aria-label="Time controls" role="group">
          <MissionClock now={now} />
          <p className="sm-clk-sub" aria-hidden="true">Mission elapsed time · fast-forward</p>
          <div className="sm-transport" role="group" aria-label="Advance time">
            {STEPS.map((s) => <button key={s.hours} type="button" disabled={busy} onClick={() => onAdvance(s.hours)}><FastForward size={15} aria-hidden="true" />{s.label}</button>)}
          </div>
          <div className={`sm-track${busy ? ' busy' : ''}`} aria-hidden="true"><span /></div>
          {busy && <p role="status" className="sm-run-l">Running readings through the engine…</p>}
          {error && <p role="alert" className="form-error">{error}</p>}
          {last && !busy && (
            <div role="status" aria-label="Last run" className="sm-last">
              <p className="sm-run-l">
                Last run {shortMet(last.from)} → {shortMet(last.to)} · {last.readings.toLocaleString('en')} readings
                {last.opened.length > 0 && <> · <b className="wt">{last.opened.length} new</b></>}
                {last.resolved.length > 0 && <> · <b className="okc">{last.resolved.length} cleared</b></>}
                {last.opened.length === 0 && last.resolved.length === 0 && <> · no alert changes</>}
              </p>
              {(last.opened.length > 0 || last.resolved.length > 0) && (
                <ul className="sm-last-list">
                  {last.opened.map((a) => <li key={`o${a.id}`}><b className="wt">New</b> {title(a, crew)}</li>)}
                  {last.resolved.map((a) => <li key={`r${a.id}`}><b className="okc">Cleared</b> {title(a, crew)}</li>)}
                </ul>
              )}
            </div>
          )}
        </div>
      </section>

      <HudPanel title="Scenarios" meta="Inject, then fast-forward" className="sm-scen" aria-label="Scenarios">
        <ul className="sm-scs">
          {SCENARIOS.map((s) => {
            const Icon = ICON[s.id]
            return (
              <li key={s.id} className="hp hp-flat sm-sc">
                <div className="sm-sc-h">
                  <span className="sm-ico" aria-hidden="true"><Icon size={20} /></span>
                  <div>
                    <h3>{s.label}</h3>
                    <p className="sm-dur">{s.days} day{s.days > 1 ? 's' : ''}</p>
                  </div>
                </div>
                <ul className="sm-mt" aria-label="Affected metrics">
                  {Object.keys(s.shifts).map((m) => <li key={m}>{METRICS[m as keyof typeof METRICS].label}</li>)}
                </ul>
                <label className="sm-who">
                  <span>Who</span>
                  <span className="sm-sel">
                    <select value={who[s.id] ?? 'default'} onChange={(e) => setWho({ ...who, [s.id]: e.target.value })}>
                      <option value="default">{s.crewIds === 'all' ? 'Whole crew' : crew.filter((c) => s.crewIds.includes(c.id)).map((c) => c.name).join(', ')}</option>
                      {s.crewIds !== 'all' && <option value="all">Whole crew</option>}
                      {crew.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                    <ChevronDown size={15} aria-hidden="true" />
                  </span>
                </label>
                <button type="button" className={buttonClass('primary')} disabled={busy} onClick={() => onInject(s.id, targets(s.id))}>Inject</button>
              </li>
            )
          })}
        </ul>
      </HudPanel>

      <div className="sm-lower">
        <HudPanel title="Running now" meta={`${injections.length} active`} className="sm-running" aria-label="Active scenarios">
          {injections.length === 0 ? <p className="sm-empty">No scenario running.</p> : (
            <ul className="sm-runs">
              {injections.map((i, idx) => {
                const Icon = ICON[i.scenario]
                const pct = Math.max(0, Math.min(1, (now - i.startTs) / (i.endTs - i.startTs))) * 100
                return (
                  <li key={idx} className="sm-run">
                    <span className="sm-run-ico" aria-hidden="true"><Icon size={17} /></span>
                    <b>{SCENARIOS.find((s) => s.id === i.scenario)!.label}</b>
                    <span className="sm-run-m">{names(i.crewIds)} · {shortMet(i.startTs)} → {met(i.endTs)}</span>
                    <span className="sm-bar" aria-hidden="true"><i style={{ width: `${pct}%` }} /></span>
                    <button type="button" className={buttonClass('ghost', 'sm')} onClick={() => onCancel(idx)}>End now</button>
                  </li>
                )
              })}
            </ul>
          )}
        </HudPanel>

        <HudPanel title="Reset" meta="Cannot be undone" tone="act" className="sm-reset">
          <p>Replaces all local data (readings, alerts, log, check-ins) with the starting demo mission.</p>
          {confirm ? (
            <div className="sm-acts">
              <button type="button" className={buttonClass('danger')} disabled={busy} onClick={() => { setConfirm(false); onReset() }}>Yes, erase and reset</button>
              <button type="button" className={buttonClass('ghost')} onClick={() => setConfirm(false)}>Cancel</button>
            </div>
          ) : (
            <button type="button" className={buttonClass('danger')} disabled={busy} onClick={() => setConfirm(true)}>Reset to demo mission</button>
          )}
        </HudPanel>
      </div>

      <HudPanel title="Engine event feed" meta="Newest first" className="sm-feed">
        <dl className="sm-sum">
          {KINDS.map((k) => (
            <div key={k} className={`st-${FEED[k].st}`}>
              <dt>{FEED[k].short}</dt>
              <dd>{events.filter((e) => e.kind === k).length}</dd>
            </div>
          ))}
        </dl>
        <div className="sm-term">
          <p className="sm-cursor" aria-hidden="true">&gt; {busy ? 'running' : 'awaiting next run'} <span /></p>
          {events.length === 0 ? <p className="sm-empty">No alert activity yet. Inject a scenario and move time forward.</p> : (
            <ol className="sm-feed-list">
              {events.map((ev) => {
                const f = FEED[ev.kind]
                return (
                  <li key={ev.id} className={`st-${f.st}`}>
                    <p className="sm-fh"><b>{ev.crew}</b><span className="sm-fk">{f.word}</span><span className="sm-ft">{shortMet(ev.ts)}</span></p>
                    <p className="sm-fx">{ev.text}</p>
                  </li>
                )
              })}
            </ol>
          )}
        </div>
      </HudPanel>
    </div>
  )
}
