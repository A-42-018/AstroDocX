import { ArrowRight, CircleCheck } from 'lucide-react'
import { Link } from 'react-router-dom'
import { METRICS } from '../data/types'
import { setStepDone } from '../engine/pipeline'
import { StatusPill } from '../shell/icons'
import type { Snapshot } from './snapshot'

/** The single most useful thing to do now: the most urgent alert and its first open step. */
export function NextAction({ snap }: { snap: Snapshot }) {
  const alert = snap.alerts[0]
  if (!alert) {
    return (
      <section className="glass next st-nominal" aria-label="Next action">
        <h2 className="sec-title">Next action</h2>
        <p className="next-title"><CircleCheck size={20} aria-hidden="true" /> Nothing needs doing</p>
        <p className="muted">Every hazard is within this person’s own baseline. A daily check-in keeps the baseline honest.</p>
        <Link to="/checkin" className="btn ghost">Daily check-in <ArrowRight size={16} aria-hidden="true" /></Link>
      </section>
    )
  }
  const index = alert.steps.findIndex((s) => !s.done)
  const step = alert.steps[index]
  const done = alert.steps.filter((s) => s.done).length
  return (
    <section className={`glass next st-${alert.status}`} aria-label="Next action">
      <h2 className="sec-title">Next action</h2>
      <p className="next-title">{METRICS[alert.metric].label} <StatusPill status={alert.status} /></p>
      {step && alert.id !== undefined ? (
        // Same store as the Alerts page: ticking here saves the step and logs it, and the card there shows it ticked.
        <label className="step next-step">
          <input type="checkbox" checked={false} onChange={() => void setStepDone(alert.id!, index, true, snap.now)} />
          <span>{step.text}</span>
        </label>
      ) : (
        <p className="next-step">{step ? step.text : 'All steps ticked. Press Done on the alert to log it.'}</p>
      )}
      <p className="muted next-meta">{done} of {alert.steps.length} steps done{snap.alerts.length > 1 ? ` · ${snap.alerts.length - 1} more alert${snap.alerts.length > 2 ? 's' : ''}` : ''}</p>
      <Link to="/alerts" className="btn">Open action card <ArrowRight size={16} aria-hidden="true" /></Link>
    </section>
  )
}
