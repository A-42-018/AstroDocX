import { ArrowRight, CircleCheck, Stethoscope } from 'lucide-react'
import { Link } from 'react-router-dom'
import { METRICS } from '../data/types'
import { setStepDone } from '../engine/pipeline'
import { buttonClass } from '../ui/buttonClass'
import { HudPanel } from '../ui/HudPanel'
import { StatusTag } from '../ui/StatusTag'
import type { Snapshot } from './snapshot'

/** The single most useful thing to do now: the most urgent alert, its steps with the current one lit, and its action card. */
export function NextAction({ snap }: { snap: Snapshot }) {
  const alert = snap.alerts[0]
  if (!alert) {
    return (
      <HudPanel className="next" data-tour="next-action" aria-label="Next action" title="Next action" meta="All clear">
        <h3 className="next-title"><CircleCheck size={20} aria-hidden="true" /> Nothing needs doing</h3>
        <p className="next-note">Every hazard is within this person’s own baseline. A daily check-in keeps the baseline honest.</p>
        <div className="next-foot">
          <Link to="/checkin" className={buttonClass('ghost', 'sm')}>Daily check-in <ArrowRight size={15} aria-hidden="true" /></Link>
          <Link to={`/doctor?crew=${snap.crewId}`} className={buttonClass('ghost', 'sm')}><Stethoscope size={15} aria-hidden="true" /> Ask VITA</Link>
        </div>
      </HudPanel>
    )
  }
  const index = alert.steps.findIndex((s) => !s.done)
  const done = alert.steps.filter((s) => s.done).length
  return (
    <HudPanel className="next" data-tour="next-action" tone={alert.status} aria-label="Next action" title="Next action" meta={`1 of ${snap.alerts.length} alert${snap.alerts.length > 1 ? 's' : ''}`}>
      <h3 className="next-title">{METRICS[alert.metric].label} <StatusTag status={alert.status} /></h3>
      {alert.steps.length > 0 ? (
        <ul className="next-steps">
          {alert.steps.map((s, i) => (
            <li key={i} className={s.done ? 'done' : i === index ? 'cur' : undefined}>
              {i === index && alert.id !== undefined ? (
                // Same store as the Alerts page: ticking here saves the step and logs it, and the card there shows it ticked.
                <label>
                  <input type="checkbox" checked={false} onChange={() => void setStepDone(alert.id!, index, true, snap.now)} />
                  <span>{s.text}</span>
                </label>
              ) : (
                <><span className="next-box" aria-hidden="true" /><span>{s.done && <span className="sr-only">Done: </span>}{s.text}</span></>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="next-note">{alert.explanation}</p>
      )}
      {index < 0 && alert.steps.length > 0 && <p className="next-note">All steps ticked. Press Done on the alert to log it.</p>}
      <div className="next-foot">
        <span className="next-count">{done} / {alert.steps.length} done</span>
        <Link to={`/doctor?crew=${snap.crewId}`} className={buttonClass('ghost', 'sm')}><Stethoscope size={15} aria-hidden="true" /> Ask VITA</Link>
        <Link to="/alerts" className={buttonClass('primary', 'sm')}>Open action card <ArrowRight size={15} aria-hidden="true" /></Link>
      </div>
    </HudPanel>
  )
}
