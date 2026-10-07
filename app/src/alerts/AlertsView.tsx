import { alertTitle, met } from '../engine/actions'
import type { Alert, CrewMember } from '../data/types'
import { AlertCard } from './AlertCard'

interface Props {
  crew: CrewMember[]
  crewId: string
  active: Alert[]
  resolved: Alert[]
  onStep: (alertId: number, index: number, done: boolean) => void
  onDone: (alertId: number) => void
}

export function AlertsView({ crew, crewId, active, resolved, onStep, onDone }: Props) {
  const who = crew.find((c) => c.id === crewId)
  return (
    <div className="board">
      <section className="glass" aria-label="Alert summary">
        <h1 style={{ margin: 0 }}>Alerts · {who?.name}</h1>
        <p className="muted" style={{ marginBottom: 0 }}>
          {active.length === 0 ? 'No active alerts. Everything is within this person’s own baseline.' : `${active.length} active alert${active.length > 1 ? 's' : ''}, most urgent first. Tick the steps you carry out, then press Done.`}
        </p>
      </section>

      {active.length > 0 && (
        <ul className="alert-list" aria-label="Active alerts">
          {active.map((a) => <AlertCard key={a.id} alert={a} onStep={onStep} onDone={onDone} />)}
        </ul>
      )}

      <section aria-label="Resolved alerts">
        <h2 className="sec-title">Recently resolved</h2>
        {resolved.length === 0 ? (
          <p className="muted">Nothing resolved yet.</p>
        ) : (
          <ul className="resolved-list">
            {resolved.map((a) => (
              <li key={a.id} className="glass">
                <b>{alertTitle(a)}</b>
                <span className="mono muted"> · peak {a.peakStatus.toUpperCase()} · {met(a.openedAt)} to {a.resolvedAt ? met(a.resolvedAt) : '?'}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
