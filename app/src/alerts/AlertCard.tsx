import { alertTitle, met } from '../engine/actions'
import type { Alert } from '../data/types'

const LABEL = { watch: 'WATCH', act: 'ACT' } as const
const ICON = { watch: '▲', act: '◆' } as const

interface Props {
  alert: Alert
  onStep: (alertId: number, index: number, done: boolean) => void
  onDone: (alertId: number) => void
}

/** One explained alert with its checkable action card. */
export function AlertCard({ alert: a, onStep, onDone }: Props) {
  const id = a.id!
  const doneCount = a.steps.filter((s) => s.done).length
  const acknowledged = a.state === 'acknowledged'
  const title = alertTitle(a)
  return (
    <li className={`glass alert st-${a.status}`} aria-label={`${title}: ${LABEL[a.status]}`}>
      <header>
        <span className="hz mono">{a.hazard}</span>
        <h2>{title}</h2>
        <span className="badge mono">{ICON[a.status]} {LABEL[a.status]}</span>
      </header>
      <p className="mono muted since">
        Opened {met(a.openedAt)}
        {a.peakStatus !== a.status && ` · peaked at ${LABEL[a.peakStatus]}`}
        {acknowledged && ' · acknowledged'}
      </p>
      <p className="why">{a.explanation}</p>
      <fieldset className="steps" disabled={acknowledged}>
        <legend>Action card · {doneCount} of {a.steps.length} steps done</legend>
        {a.steps.map((s, i) => (
          <label key={i} className={s.done ? 'step done' : 'step'}>
            <input type="checkbox" checked={s.done} onChange={(e) => onStep(id, i, e.target.checked)} />
            <span>{s.text}</span>
          </label>
        ))}
      </fieldset>
      <div className="alert-foot">
        <button type="button" className="btn" disabled={acknowledged} onClick={() => onDone(id)}>
          {acknowledged ? 'Done · logged' : 'Done'}
        </button>
        <span className="muted">The engine keeps watching and clears this alert when values recover.</span>
      </div>
    </li>
  )
}
