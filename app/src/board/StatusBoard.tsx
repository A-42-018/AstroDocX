import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import type { Hazard, Status } from '../data/types'
import { CO2_LIMIT_MMHG } from '../engine/limits'
import { useHidden, useReducedMotion } from '../live/usePaused'
import { LiveVitals } from '../live/LiveVitals'
import { useLiveTelemetry } from '../live/useLiveTelemetry'
import { HazardIcon, StatusPill } from '../shell/icons'
import { ReadinessRing } from './Dial'
import { AreaMini, BacklogBar, BarsMini, LineLimitMini, StepMini } from './MiniCharts'
import type { MiniData } from './mini'
import { NextAction } from './NextAction'
import type { Snapshot } from './snapshot'
import { useBoard } from './store'
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

/**
 * While the top alert is at Act, a spark runs from its hotspot on the twin to the Next Action card every few seconds.
 * Reduced motion and background tabs get no spark; the hotspot's own halo still marks it.
 */
function useAlertPulse(host: React.RefObject<HTMLDivElement | null>, hazard: Hazard | null) {
  const reduced = useReducedMotion()
  const hidden = useHidden()
  useEffect(() => {
    const root = host.current
    if (!hazard || reduced || hidden || !root) return
    const fire = () => {
      const from = root.querySelector(`[data-spot="${hazard}"]`)?.getBoundingClientRect()
      const to = root.querySelector('.next')?.getBoundingClientRect()
      if (!from || !to || !root.animate) return
      const box = root.getBoundingClientRect()
      const x0 = from.left + from.width / 2 - box.left, y0 = from.top + from.height / 2 - box.top
      const x1 = Math.min(Math.max(x0 + box.left, to.left), to.right) - box.left
      const y1 = Math.min(Math.max(y0 + box.top, to.top), to.bottom) - box.top
      const dot = document.createElement('span')
      dot.className = 'pulse-spark'
      dot.setAttribute('aria-hidden', 'true')
      root.appendChild(dot)
      const run = dot.animate(
        [{ transform: `translate(${x0}px, ${y0}px) scale(0.6)`, opacity: 0 }, { opacity: 1, offset: 0.15 }, { opacity: 1, offset: 0.85 }, { transform: `translate(${x1}px, ${y1}px) scale(1.2)`, opacity: 0 }],
        { duration: 1400, easing: 'ease-in-out' },
      )
      run.onfinish = () => dot.remove()
      run.oncancel = () => dot.remove()
    }
    const first = setTimeout(fire, 600)
    const id = setInterval(fire, 4000)
    return () => { clearTimeout(first); clearInterval(id); root.querySelectorAll('.pulse-spark').forEach((n) => n.remove()) }
  }, [host, hazard, reduced, hidden])
}

const CHECKIN_DUE_H = 12

/** 7-day readiness sparkline and a prompt to check in when the last one is old. */
function ReadinessTrend({ values, lastCheckIn, now }: { values: number[]; lastCheckIn: number | null; now: number }) {
  const ago = lastCheckIn === null ? null : Math.max(0, (now - lastCheckIn) / 3_600_000)
  const due = ago === null || ago >= CHECKIN_DUE_H
  return (
    <div className="rd-trend">
      <div className="mini-box"><StepMini values={values} mean={null} /><span className="mini-cap">Readiness, last 7 days · {Math.min(...values)}–{Math.max(...values)}%</span></div>
      <Link to="/checkin" className="rd-checkin">
        {ago === null ? 'No check-in yet' : `Last check-in ${ago.toFixed(0)} h ago`}{due && <b> · due</b>}
      </Link>
    </div>
  )
}

const sigmaText = (s: number) => `${s < 0 ? '−' : '+'}${Math.abs(s).toFixed(1)}σ`

interface Props {
  snap: Snapshot
  /** Chart data for the hazard cards; the cards render without charts until it arrives. */
  mini?: MiniData
}

/** The hazard dragging readiness down the most (lowest score among Watch/Act tiles), or null when all are nominal. */
function heldBy(tiles: Props['snap']['tiles']) {
  const bad = tiles.filter((t) => t.status !== 'nominal').sort((a, b) => a.score - b.score)[0]
  return bad ? { name: bad.name, status: bad.status } : null
}

export function StatusBoard({ snap, mini }: Props) {
  const who = snap.crew.find((c) => c.id === snap.crewId)
  // One telemetry stream feeds both the vitals strip and the twin's heartbeat.
  const telemetry = useLiveTelemetry(snap.crewId)
  const top = useRef<HTMLDivElement>(null)
  const focus = useBoard((s) => s.focusHazard)
  const setFocus = useBoard((s) => s.setFocusHazard)
  useAlertPulse(top, snap.alerts[0]?.status === 'act' ? snap.alerts[0].hazard : null)
  return (
    <div className="board board-home">
      <div className="board-top" ref={top}>
        <section className="glass readiness" aria-label={`Readiness for ${who?.name ?? 'crew member'}`}>
          <ReadinessRing value={snap.readiness} status={snap.overall} heldBy={heldBy(snap.tiles)} />
          <div>
            <h1 className="sr-only">{who?.name}</h1>
            <p className="muted">{who?.role} · readiness combines all five RIDGE hazards against this person’s own baseline.</p>
            <p className="mono muted" aria-live="polite">
              {snap.alerts.length === 0 ? 'No active alerts' : `${snap.alerts.length} active alert${snap.alerts.length > 1 ? 's' : ''}`}
            </p>
            {mini && <ReadinessTrend values={mini.readiness} lastCheckIn={mini.lastCheckIn} now={snap.now} />}
          </div>
        </section>
        <section className={`glass twin-card st-${snap.overall}`} aria-label="Health twin">
          <Twin tiles={snap.tiles} overall={snap.overall} hr={telemetry.targets.hr} />
        </section>
        <NextAction snap={snap} />
      </div>

      <LiveVitals crewId={snap.crewId} telemetry={telemetry} />

      <ul className="tiles" aria-label="Hazard status">
        {snap.tiles.map((t) => (
          <li key={t.hazard} id={`hz-${t.hazard}`} className={`glass tile st-${t.status}${focus === t.hazard ? ' is-linked' : ''}`} tabIndex={0}
            onMouseEnter={() => setFocus(t.hazard)} onMouseLeave={() => setFocus(null)} onFocus={() => setFocus(t.hazard)} onBlur={() => setFocus(null)}
            aria-label={`${t.name}: ${LABEL[t.status]}. ${t.label} ${t.value} ${t.unit}`}>
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

    </div>
  )
}
