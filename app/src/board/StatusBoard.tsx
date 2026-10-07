import type { Snapshot } from './snapshot'
import type { Status } from '../data/types'
import { HazardIcon, StatusPill } from '../shell/icons'
import { LiveVitals } from '../live/LiveVitals'

const LABEL: Record<Status, string> = { nominal: 'NOMINAL', watch: 'WATCH', act: 'ACT' }

export function ReadinessRing({ value, status }: { value: number; status: Status }) {
  const r = 52
  const c = 2 * Math.PI * r
  return (
    <figure className={`ring st-${status}`} aria-label={`Crew readiness ${value} percent, ${LABEL[status]}`}>
      <svg viewBox="0 0 120 120" role="img" aria-hidden="true">
        <circle cx="60" cy="60" r={r + 9} className="ring-ticks" />
        <circle cx="60" cy="60" r={r} className="ring-track" />
        <circle cx="60" cy="60" r={r} className="ring-fill" strokeDasharray={c} strokeDashoffset={c * (1 - value / 100)} transform="rotate(-90 60 60)" />
      </svg>
      <figcaption>
        <b className="mono">{value}%</b>
        <StatusPill status={status} />
      </figcaption>
    </figure>
  )
}

export function StatusBoard({ snap }: { snap: Snapshot }) {
  const who = snap.crew.find((c) => c.id === snap.crewId)
  const linkLabel = snap.sinceSyncH === null ? 'No ground sync yet' : `Last ground sync ${snap.sinceSyncH.toFixed(1)} h ago`
  return (
    <div className="board board-home">
      <div className="board-head">
        <div className="meta mono">
          <span>{linkLabel}</span>
        </div>
      </div>

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

      <ul className="tiles" aria-label="Hazard status">
        {snap.tiles.map((t) => (
          <li key={t.hazard} className={`glass tile st-${t.status}`} aria-label={`${t.name}: ${LABEL[t.status]}. ${t.label} ${t.value} ${t.unit}`}>
            <header>
              <HazardIcon hazard={t.hazard} status={t.status} />
              <h2>{t.name}</h2>
              <StatusPill status={t.status} />
            </header>
            <p className="val mono">
              <b>{t.value}</b> <small>{t.unit}</small>
            </p>
            <p className="muted lbl">{t.label}</p>
            {t.alerts.length > 0 ? (
              <p className="why">{t.alerts[0].explanation}</p>
            ) : (
              <p className="muted why">{t.tracks}</p>
            )}
          </li>
        ))}
      </ul>
      <LiveVitals crewId={snap.crewId} />
    </div>
  )
}
