import { alertTitle, met } from '../engine/actions'
import { evidenceFor } from '../engine/evidence'
import type { Alert } from '../data/types'
import { HazardIcon, StatusPill } from '../shell/icons'
import { TrendPlot } from '../trends/TrendChart'
import type { AlertDetailData } from './detail'
import { buildTimeline } from './timeline'

const LABEL = { watch: 'WATCH', act: 'ACT' } as const

interface Props {
  alert: Alert
  detail?: AlertDetailData | null
  onStep: (alertId: number, index: number, done: boolean) => void
  onDone: (alertId: number) => void
  onBack?: () => void
}

/** Small progress ring for the action card. */
function Progress({ done, total }: { done: number; total: number }) {
  const pct = total ? (done / total) * 100 : 0
  return (
    <span className="prog" aria-hidden="true">
      <svg viewBox="0 0 36 36"><circle cx="18" cy="18" r="15" className="ring-track" /><circle cx="18" cy="18" r="15" className="ring-fill" pathLength={100} strokeDasharray={`${pct} 100`} transform="rotate(-90 18 18)" /></svg>
      <b>{done}/{total}</b>
    </span>
  )
}

/** Detail pane: why it fired (chart + σ), the action card, and the alert's life story. */
export function AlertDetail({ alert: a, detail, onStep, onDone, onBack }: Props) {
  const id = a.id!
  const resolved = a.state === 'resolved'
  const acknowledged = a.state === 'acknowledged'
  const doneCount = a.steps.filter((s) => s.done).length
  const title = alertTitle(a)
  const sigma = a.z
  const timeline = buildTimeline(a, detail?.alertId === id ? detail.log : [])
  const evidence = evidenceFor(a.metric)
  return (
    <article className={`glass alert detail st-${a.status}`} aria-label={`${title}: ${LABEL[a.status]}`}>
      {onBack && <button type="button" className="btn ghost back-btn" onClick={onBack}>← All alerts</button>}
      <header>
        <HazardIcon hazard={a.hazard} status={a.status} />
        <h2>{title}</h2>
        {resolved ? <span className="badge st-nominal">RESOLVED</span> : <StatusPill status={a.status} />}
      </header>
      <p className="mono muted since">
        Opened {met(a.openedAt)}
        {a.peakStatus !== a.status && ` · peaked at ${LABEL[a.peakStatus]}`}
        {acknowledged && ' · acknowledged'}
        {resolved && a.resolvedAt !== undefined && ` · resolved ${met(a.resolvedAt)}`}
      </p>

      <section className="why-panel" aria-label="Why this fired">
        <h3 className="sec-title">Why this fired</h3>
        <p className="why">{a.explanation}</p>
        {a.kind !== 'checkin' && sigma > 0 && <p className="sigma-chip mono">{sigma.toFixed(1)}σ from baseline when it opened</p>}
        {detail && detail.alertId === id && detail.series.points.length > 1 && (
          <TrendPlot series={detail.series} rangeMs={detail.series.points[detail.series.points.length - 1].ts - detail.series.points[0].ts} height={190} highlightTs={detail.series.markers[0]?.ts} />
        )}
        {evidence.length > 0 && (
          <div className="evidence">
            <h4 className="evidence-title">Evidence <span className="muted">· context for what this change can mean, not a diagnosis</span></h4>
            <ul>
              {evidence.map((e) => (
                <li key={e.url}>
                  <a href={e.url} target="_blank" rel="noopener noreferrer">{e.title}<span className="sr-only"> (opens in a new tab)</span></a>
                  <span className="mono muted ev-id">{e.source} · {e.id}</span>
                  <span className="muted">{e.why}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <fieldset className="steps" disabled={acknowledged || resolved}>
        <legend>Action card · {doneCount} of {a.steps.length} steps done</legend>
        <div className="steps-head"><Progress done={doneCount} total={a.steps.length} /></div>
        {a.steps.map((s, i) => (
          <label key={i} className={s.done ? 'step done' : 'step'}>
            <input type="checkbox" checked={s.done} onChange={(e) => onStep(id, i, e.target.checked)} />
            <span>{s.text}</span>
          </label>
        ))}
      </fieldset>
      {!resolved && (
        <div className="alert-foot">
          <button type="button" className="btn" disabled={acknowledged} onClick={() => onDone(id)}>
            {acknowledged ? 'Done · logged' : 'Done'}
          </button>
          <span className="muted">The engine keeps watching and clears this alert when values recover.</span>
        </div>
      )}

      <section aria-label="Alert timeline">
        <h3 className="sec-title">Timeline</h3>
        <ol className="timeline">
          {timeline.map((t, i) => (
            <li key={i} className={`tl-${t.kind}`}><span className="tl-dot" aria-hidden="true" /><span>{t.label}</span><span className="mono muted">{met(t.ts)}</span></li>
          ))}
        </ol>
      </section>
    </article>
  )
}
