import { useEffect, useState } from 'react'
import { ChevronRight } from 'lucide-react'
import { alertTitle, met } from '../engine/actions'
import type { Alert, CrewMember } from '../data/types'
import { HudPanel, PanelHeader, Segmented, StateView, StatusTag, type SegOption } from '../ui'
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

const short = (ts: number) => met(ts).replace(' MET', '')

/**
 * Alerts (plan §4.4, mockup 3): the urgent-first queue with counted filters on the left, the chosen alert's
 * detail, action card and timeline beside it. Below 1024 px the queue and the detail take turns.
 */
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
  const FILTERS: SegOption<Filter>[] = [
    { id: 'all', label: 'Active', count: count('all') },
    { id: 'act', label: 'Act', count: count('act'), status: 'act' },
    { id: 'watch', label: 'Watch', count: count('watch'), status: 'watch' },
    { id: 'resolved', label: 'Resolved', count: count('resolved') },
  ]
  const pick = (a: Alert) => { setPicked(a.id!); setOpen(true) }

  return (
    <div className={`alerts${open && shown ? ' show-detail' : ''}`}>
      <HudPanel className="al-queue" title={<>Alert queue // {who?.name}</>} meta="Most urgent first">
        <Segmented label="Filter alerts" options={FILTERS} value={filter} onChange={(f) => { setFilter(f); setPicked(null) }} />
        {visible.length === 0 ? (
          <p className="al-empty">
            {filter === 'resolved' ? 'Nothing resolved yet.' : active.length === 0 ? 'No active alerts. Everything is within this person’s own baseline.' : 'No alerts match this filter.'}
          </p>
        ) : (
          <ul className="al-list" aria-label={filter === 'resolved' ? 'Resolved alerts' : 'Active alerts'}>
            {visible.map((a) => (
              <li key={a.id}>
                <button type="button" className={`qrow st-${filter === 'resolved' ? 'nominal' : a.status}${a.id === shown?.id ? ' on' : ''}`} aria-current={a.id === shown?.id ? 'true' : undefined} onClick={() => pick(a)}>
                  <span className="q-code" aria-hidden="true">{a.hazard}</span>
                  <b>{alertTitle(a)}</b>
                  {filter === 'resolved' ? <StatusTag status="nominal" label="RESOLVED" /> : <StatusTag status={a.status} />}
                  <span className="q-meta">{filter === 'resolved' ? `peak ${a.peakStatus.toUpperCase()} · ${met(a.openedAt)}` : `opened ${met(a.openedAt)}`}</span>
                  <ChevronRight className="q-chev" size={18} aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )}
        {filter !== 'resolved' && resolved.length > 0 && (
          <div className="al-res">
            <PanelHeader level={3} title="Resolved" meta={resolved.length} />
            <ul aria-label="Recently resolved">
              {resolved.slice(0, 6).map((a) => (
                <li key={a.id}>
                  <button type="button" onClick={() => { setFilter('resolved'); pick(a) }}>
                    <span>{a.hazard} · {alertTitle(a)}</span>
                    <span className="q-meta">peak {a.peakStatus.toUpperCase()} · {short(a.openedAt)}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </HudPanel>

      {shown ? (
        <AlertDetail key={shown.id} alert={shown} detail={detail} onStep={onStep} onDone={onDone} onBack={() => setOpen(false)} />
      ) : (
        <div className="al-none">
          <h1 className="sr-only">Alerts · {who?.name}</h1>
          <StateView kind="empty" label={filter === 'resolved' ? 'Nothing resolved to look back on yet.' : 'Nothing needs doing. New alerts open here, most urgent first.'} />
        </div>
      )}
    </div>
  )
}
