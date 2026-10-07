import { useEffect, useState } from 'react'
import { alertTitle, met } from '../engine/actions'
import type { Alert, CrewMember } from '../data/types'
import { HazardIcon, StatusPill } from '../shell/icons'
import { AlertDetail } from './AlertCard'
import type { AlertDetailData } from './detail'

type Filter = 'all' | 'act' | 'watch' | 'resolved'

interface Props {
  crew: CrewMember[]
  crewId: string
  active: Alert[]
  resolved: Alert[]
  /** Chart and log for the alert currently shown (loaded by the page). */
  detail?: AlertDetailData | null
  /** Reports which alert the detail pane is showing so the page can load its chart. */
  onSelect?: (alert: Alert | null) => void
  onStep: (alertId: number, index: number, done: boolean) => void
  onDone: (alertId: number) => void
}

/** Master/detail: urgent-first list with filter chips on the left, the chosen alert on the right. On phones the list and the detail take turns. */
export function AlertsView({ crew, crewId, active, resolved, detail, onSelect, onStep, onDone }: Props) {
  const who = crew.find((c) => c.id === crewId)
  const [filter, setFilter] = useState<Filter>('all')
  const [picked, setPicked] = useState<number | null>(null)
  const [open, setOpen] = useState(false)

  const visible = filter === 'resolved' ? resolved : filter === 'all' ? active : active.filter((a) => a.status === filter)
  const shown = visible.find((a) => a.id === picked) ?? visible[0] ?? null
  const shownId = shown?.id
  useEffect(() => { onSelect?.(shown) }, [shownId, shown?.state, shown?.openedAt]) // eslint-disable-line react-hooks/exhaustive-deps

  const count = (f: Filter) => (f === 'resolved' ? resolved.length : f === 'all' ? active.length : active.filter((a) => a.status === f).length)
  const FILTERS: { id: Filter; label: string }[] = [{ id: 'all', label: 'All active' }, { id: 'act', label: 'Act' }, { id: 'watch', label: 'Watch' }, { id: 'resolved', label: 'Resolved' }]

  return (
    <div className="board">
      <section className="glass" aria-label="Alert summary">
        <h1 style={{ margin: 0 }}>Alerts · {who?.name}</h1>
        <p className="muted" style={{ marginBottom: 0 }}>
          {active.length === 0 ? 'No active alerts. Everything is within this person’s own baseline.' : `${active.length} active alert${active.length > 1 ? 's' : ''}, most urgent first. Pick one to see why it fired, tick the steps you carry out, then press Done.`}
        </p>
      </section>

      <div className={`md${open && shown ? ' show-detail' : ''}`}>
        <div className="md-list">
          <div role="group" aria-label="Filter alerts" className="chips">
            {FILTERS.map((f) => (
              <button key={f.id} type="button" className={`chip${filter === f.id ? ' on' : ''}`} aria-pressed={filter === f.id} onClick={() => { setFilter(f.id); setPicked(null) }}>
                {f.label} <span className="mono">{count(f.id)}</span>
              </button>
            ))}
          </div>
          {visible.length === 0 ? (
            <p className="muted md-empty">{filter === 'resolved' ? 'Nothing resolved yet.' : 'No alerts match this filter.'}</p>
          ) : (
            <ul className="alert-list" aria-label={filter === 'resolved' ? 'Resolved alerts' : 'Active alerts'}>
              {visible.map((a) => (
                <li key={a.id}>
                  <button type="button" className={`glass md-item st-${a.status}${a.id === shown?.id ? ' on' : ''}`} aria-current={a.id === shown?.id ? 'true' : undefined} onClick={() => { setPicked(a.id!); setOpen(true) }}>
                    <HazardIcon hazard={a.hazard} status={a.status} />
                    <span className="md-text">
                      <b>{alertTitle(a)}</b>
                      <span className="mono muted">{filter === 'resolved' ? `peak ${a.peakStatus.toUpperCase()} · ${met(a.openedAt)}` : `opened ${met(a.openedAt)}`}</span>
                    </span>
                    {filter === 'resolved' ? <span className="badge st-nominal">RESOLVED</span> : <StatusPill status={a.status} />}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="md-detail">
          {shown ? (
            <AlertDetail key={shown.id} alert={shown} detail={detail} onStep={onStep} onDone={onDone} onBack={() => setOpen(false)} />
          ) : (
            <p className="glass muted">Select an alert to see why it fired.</p>
          )}
        </div>
      </div>
    </div>
  )
}
