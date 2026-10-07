import type { Hazard, Status } from '../data/types'
import { CO2_LIMIT_MMHG } from '../engine/limits'
import { LiveVitals } from '../live/LiveVitals'
import type { ShellCrew } from '../shell/useShellData'
import { HazardIcon, StatusPill } from '../shell/icons'
import { CrewOverview } from './CrewOverview'
import { ReadinessRing } from './Dial'
import { AreaMini, BacklogBar, BarsMini, LineLimitMini, StepMini } from './MiniCharts'
import type { MiniData } from './mini'
import { NextAction } from './NextAction'
import type { Snapshot } from './snapshot'
import { Twin } from './Twin'

export { ReadinessRing }

const LABEL: Record<Status, string> = { nominal: 'NOMINAL', watch: 'WATCH', act: 'ACT' }

/** The small chart that fits each hazard's metric, with a one-line caption. */
function Mini({ hazard, mini, oldestPendingH }: { hazard: Hazard; mini: MiniData; oldestPendingH: number | null | undefined }) {
  switch (hazard) {
    case 'R': return <><AreaMini values={mini.dose} /><span className="mini-cap">Cumulative dose, 7 days</span></>
    case 'I': return <><StepMini values={mini.sleep} mean={mini.sleepMean} /><span className="mini-cap">Sleep per night, 14 nights</span></>
    case 'D': return <><BacklogBar hours={oldestPendingH} /><span className="mini-cap">Oldest unsynced entry (Watch 24 h, Act 72 h)</span></>
    case 'G': return <><BarsMini values={mini.exercise} mean={mini.exerciseMean} /><span className="mini-cap">Exercise per day, 7 days</span></>
    case 'E': return <><LineLimitMini values={mini.co2} limit={CO2_LIMIT_MMHG} /><span className="mini-cap">CO₂, 48 h, against the {CO2_LIMIT_MMHG.toFixed(1)} mmHg limit</span></>
  }
}

const sigmaText = (s: number) => `${s < 0 ? '−' : '+'}${Math.abs(s).toFixed(1)}σ`

interface Props {
  snap: Snapshot
  /** Chart data for the hazard cards; the cards render without charts until it arrives. */
  mini?: MiniData
  crew?: ShellCrew[]
  onSelectCrew?: (id: string) => void
}

export function StatusBoard({ snap, mini, crew, onSelectCrew }: Props) {
  const who = snap.crew.find((c) => c.id === snap.crewId)
  const linkLabel = snap.sinceSyncH === null ? 'No ground sync yet' : `Last ground sync ${snap.sinceSyncH.toFixed(1)} h ago`
  return (
    <div className="board board-home">
      <div className="board-head">
        <div className="meta mono">
          <span>{linkLabel}</span>
        </div>
      </div>

      <div className="board-top">
        <section className="glass readiness" aria-label={`Readiness for ${who?.name ?? 'crew member'}`}>
          <ReadinessRing value={snap.readiness} status={snap.overall} />
          <div>
            <h1>{who?.name}</h1>
            <p className="muted">{who?.role} · readiness combines all five RIDGE hazards against this person’s own baseline.</p>
            <p className="mono muted" aria-live="polite">
              {snap.alerts.length === 0 ? 'No active alerts' : `${snap.alerts.length} active alert${snap.alerts.length > 1 ? 's' : ''}`}
            </p>
          </div>
        </section>
        <section className={`glass twin-card st-${snap.overall}`} aria-label="Health twin">
          <Twin tiles={snap.tiles} overall={snap.overall} />
        </section>
        <NextAction snap={snap} />
      </div>

      <LiveVitals crewId={snap.crewId} />

      <ul className="tiles" aria-label="Hazard status">
        {snap.tiles.map((t) => (
          <li key={t.hazard} id={`hz-${t.hazard}`} className={`glass tile st-${t.status}`} aria-label={`${t.name}: ${LABEL[t.status]}. ${t.label} ${t.value} ${t.unit}`}>
            <header>
              <HazardIcon hazard={t.hazard} status={t.status} />
              <h2>{t.name}</h2>
              <StatusPill status={t.status} />
            </header>
            <p className="val mono">
              <b>{t.value}</b> <small>{t.unit}</small>
              {t.sigma !== undefined && <span className="delta" title="Against this person’s own baseline">{sigmaText(t.sigma)}</span>}
            </p>
            <p className="muted lbl">{t.label}</p>
            {mini && <div className="mini-box"><Mini hazard={t.hazard} mini={mini} oldestPendingH={snap.oldestPendingH} /></div>}
            {t.alerts.length > 0 ? (
              <p className="why">{t.alerts[0].explanation}</p>
            ) : (
              <p className="muted why">{t.tracks}</p>
            )}
          </li>
        ))}
      </ul>

      {crew && onSelectCrew && <CrewOverview crew={crew} crewId={snap.crewId} onSelect={onSelectCrew} />}
    </div>
  )
}
