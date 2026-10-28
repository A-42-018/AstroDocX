import { useState, type ReactNode } from 'react'
import { alertTitle, met } from '../engine/actions'
import { evidenceFor } from '../engine/evidence'
import { METRICS, type Alert } from '../data/types'
import { HAZARDS } from '../board/snapshot'
import { HazardIcon } from '../shell/icons'
import { Button, HudPanel, PanelHeader, StatusTag } from '../ui'
import { AlertChart } from './AlertChart'
import type { AlertDetailData } from './detail'
import { buildTimeline, type TimelineItem } from './timeline'

const LABEL = { watch: 'WATCH', act: 'ACT' } as const

interface Props {
  alert: Alert
  detail?: AlertDetailData | null
  onStep: (alertId: number, index: number, done: boolean) => void
  onDone: (alertId: number) => void
  onBack?: () => void
}

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const UNITS = [...new Set(Object.values(METRICS).map((m) => m.unit))].sort((a, b) => b.length - a.length).map(esc).join('|')
// The numbers in an explanation: σ distances, values with their unit and the bracketed baseline.
const KEY = new RegExp(`(\\d+(?:\\.\\d+)?σ (?:below|above|slower)|\\([^)]*\\d[^)]*\\)|\\d+(?:\\.\\d+)? (?:${UNITS})(?![\\w:]))`, 'g')

/** Bold the figures in an engine explanation, the σ distance in the alert's colour. */
function emphasize(text: string): ReactNode[] {
  return text.split(KEY).map((part, i) => (i % 2 ? <b key={i} className={part.includes('σ ') && !part.startsWith('(') ? 'em-st' : undefined}>{part}</b> : part))
}

/** Timeline colour: the level an entry names, green for steps and recovery, cyan for what is still pending. */
function tone(t: TimelineItem | { kind: 'pending' }) {
  if (t.kind === 'pending') return 'tl-pending'
  if (t.kind === 'step' || t.kind === 'done' || t.kind === 'resolved') return 'st-nominal'
  return /Act$/.test(t.label) ? 'st-act' : 'st-watch'
}

/**
 * Alert detail (plan §4.4, mockup 3): the hero panel with why it fired, the alert-window chart and evidence,
 * then the action card and timeline beside it. One article, so the steps, Done and the timeline stay together.
 */
export function AlertDetail({ alert: a, detail, onStep, onDone, onBack }: Props) {
  const id = a.id!
  const resolved = a.state === 'resolved'
  const acknowledged = a.state === 'acknowledged'
  // A tick shows at once; the database write and the snapshot reload that confirms it can take a moment.
  // Any newer alert from the database is the truth again, so the override only lives until then.
  const [ticked, setTicked] = useState<{ of: Alert; done: Record<number, boolean> }>({ of: a, done: {} })
  if (ticked.of !== a) setTicked({ of: a, done: {} })
  const over = ticked.of === a ? ticked.done : {}
  const steps = a.steps.map((s, i) => (i in over ? { ...s, done: over[i] } : s))
  const tick = (i: number, done: boolean) => {
    setTicked((t) => ({ of: a, done: { ...(t.of === a ? t.done : {}), [i]: done } }))
    onStep(id, i, done)
  }
  const doneCount = steps.filter((s) => s.done).length
  const total = steps.length
  const title = alertTitle(a)
  const sigma = a.z
  const timeline = buildTimeline(a, detail?.alertId === id ? detail.log : [])
  const evidence = evidenceFor(a.metric)
  const hz = HAZARDS.find((h) => h.id === a.hazard)
  const series = detail && detail.alertId === id && detail.series.points.length > 1 ? detail.series : null
  const current = steps.findIndex((s) => !s.done)
  const pct = total ? (doneCount / total) * 100 : 0
  return (
    <article className={`al-detail st-${a.status}`} aria-label={`${title}: ${LABEL[a.status]}`}>
      <HudPanel as="div" hero tone={resolved ? 'data' : a.status} className="al-main">
        {onBack && <Button variant="ghost" size="sm" className="back-btn" onClick={onBack}>← All alerts</Button>}
        <header className="al-dh">
          <HazardIcon hazard={a.hazard} status={resolved ? undefined : a.status} />
          <div className="al-dh-text">
            <p className="al-eb">
              {a.hazard} · {hz?.name} · opened {met(a.openedAt)}
              {a.peakStatus !== a.status && ` · peaked at ${LABEL[a.peakStatus]}`}
              {acknowledged && ' · acknowledged'}
              {resolved && a.resolvedAt !== undefined && ` · resolved ${met(a.resolvedAt)}`}
            </p>
            <h1>{title}</h1>
          </div>
          {resolved ? <StatusTag status="nominal" label="RESOLVED" /> : <StatusTag status={a.status} />}
        </header>

        <section className="al-why" aria-label="Why this fired">
          {a.kind !== 'checkin' && sigma > 0 && (
            <p className="al-sig">
              <span className="al-sig-eb">From baseline</span>
              <b>{sigma.toFixed(1)}σ</b>
              <span className="al-sig-sub">when it opened</span>
            </p>
          )}
          <p className="why">{emphasize(a.explanation)}</p>
        </section>

        <div className="al-chart">
          {series ? <AlertChart series={series} status={a.status} highlightTs={series.markers[0]?.ts} /> : <div className="ac ac-wait" aria-hidden="true" />}
        </div>

        {evidence.length > 0 && (
          <section className="al-ev" aria-label="Evidence">
            <PanelHeader level={3} title="Evidence" meta="Context, not a diagnosis" />
            <ul>
              {evidence.map((e) => (
                <li key={e.url} className="ev">
                  <span className="ev-src">{e.source}</span>
                  <a href={e.url} target="_blank" rel="noopener noreferrer">{e.title}<span className="sr-only"> (opens in a new tab)</span></a>
                  <span className="ev-why">{e.id} · {e.why}</span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </HudPanel>

      <div className="al-side">
        <HudPanel title="Action card" meta={`${doneCount} / ${total}`} className="al-act">
          <div className="al-prog" aria-hidden="true">
            <svg viewBox="0 0 120 120">
              <circle cx="60" cy="60" r="52" className="pr-track" />
              <circle cx="60" cy="60" r="52" className="pr-fill" pathLength={100} strokeDasharray={`${pct} 100`} transform="rotate(-90 60 60)" />
              <circle cx="60" cy="60" r="52" className="pr-dots" />
              <circle cx="60" cy="60" r="40" className="pr-inner" />
            </svg>
            <div><b>{doneCount}<small>/{total}</small></b><span>Steps done</span></div>
          </div>
          <fieldset className="al-steps" disabled={acknowledged || resolved}>
            <legend className="sr-only">Action card · {doneCount} of {total} steps done</legend>
            {steps.map((s, i) => (
              <label key={i} className={`al-step${s.done ? ' done' : ''}${i === current && !resolved ? ' cur' : ''}`}>
                {/* the number is drawn by CSS (data-n), so the checkbox's name is the step text alone */}
                <span className="al-n" data-n={i + 1}><input type="checkbox" checked={s.done} onChange={(e) => tick(i, e.target.checked)} /></span>
                <span>{s.text}</span>
              </label>
            ))}
          </fieldset>
          {!resolved && (
            <>
              <Button className="al-done" disabled={acknowledged} onClick={() => onDone(id)}>{acknowledged ? 'Done · logged' : 'Mark done'}</Button>
              <p className="al-note">The engine keeps watching and clears this alert when values recover.</p>
            </>
          )}
        </HudPanel>

        <HudPanel title="Timeline" meta="MET" aria-label="Alert timeline" className="al-tl">
          <ol className="timeline">
            {timeline.map((t, i) => (
              <li key={i} className={tone(t)}><span>{t.label}</span><span className="mono">{met(t.ts).replace(' MET', '')}</span></li>
            ))}
            {a.state === 'open' && <li className={tone({ kind: 'pending' })}><span>Waiting for steps</span><span className="mono">Now</span></li>}
          </ol>
        </HudPanel>
      </div>
    </article>
  )
}
