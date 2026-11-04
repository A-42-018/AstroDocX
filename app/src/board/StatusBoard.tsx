import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import type { Hazard, Status } from '../data/types'
import { CO2_LIMIT_MMHG } from '../engine/limits'
import { HAZARD_BASIS, hazardTag } from '../engine/nasa'
import { NasaRef } from '../ui/NasaRef'
import { useHidden, useReducedMotion } from '../live/usePaused'
import { LiveVitals } from '../live/LiveVitals'
import { useLiveTelemetry } from '../live/useLiveTelemetry'
import { HudPanel } from '../ui/HudPanel'
import { KpiCell, KpiGrid } from '../ui/Readout'
import { STATUS_SHORT, STATUS_WORD } from '../ui/status'
import { StatusTag } from '../ui/StatusTag'
import { ReadinessRing } from './Dial'
import { AreaMini, BacklogBar, BarsMini, LineLimitMini, SleepBars } from './MiniCharts'
import type { MiniData } from './mini'
import { NextAction } from './NextAction'
import type { HazardTile, Snapshot } from './snapshot'
import { useBoard } from './store'
import { initials } from '../shell/format'
import { Twin } from './Twin'

export { ReadinessRing }

/** What each module's chart shows, after the metric's own label. */
function caption(t: HazardTile): string {
  switch (t.hazard) {
    case 'R': return `${t.label} · cumulative 7 d`
    case 'I': return `${t.label} · 14 nights`
    case 'D': return 'Since ground sync · Watch 24 h, Act 72 h'
    case 'G': return `${t.label} · 7 days`
    case 'E': return `${t.label} · 48 h vs ${CO2_LIMIT_MMHG.toFixed(1)} limit`
  }
}

/** The small chart that fits each hazard's metric. */
function Mini({ hazard, mini, oldestPendingH }: { hazard: Hazard; mini: MiniData; oldestPendingH: number | null | undefined }) {
  switch (hazard) {
    case 'R': return <AreaMini values={mini.dose} />
    case 'I': return <SleepBars values={mini.sleep} mean={mini.sleepMean} sd={mini.sleepSd} />
    case 'D': return <BacklogBar hours={oldestPendingH} />
    case 'G': return <BarsMini values={mini.exercise} mean={mini.exerciseMean} />
    case 'E': return <LineLimitMini values={mini.co2} limit={CO2_LIMIT_MMHG} />
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
const sigmaText = (s: number) => `${s < 0 ? '−' : '+'}${Math.abs(s).toFixed(1)}σ`

/** The hazard dragging readiness down the most (lowest score among Watch/Act tiles), or null when all are nominal. */
function heldBy(tiles: HazardTile[]) {
  const bad = tiles.filter((t) => t.status !== 'nominal').sort((a, b) => a.score - b.score)[0]
  return bad ? { name: bad.name, status: bad.status } : null
}

/** Hexagon portrait outlined in the status colour, with the initials. */
function Portrait({ initials, status }: { initials: string; status: Status }) {
  return (
    <span className={`portrait st-${status}`} aria-hidden="true">
      <svg viewBox="0 0 74 74">
        <polygon points="37,2 70,20 70,54 37,72 4,54 4,20" className="pt-hex" />
        <polygon points="37,9 64,24 64,50 37,65 10,50 10,24" className="pt-inner" />
      </svg>
      <b>{initials}</b>
    </span>
  )
}

interface Props {
  snap: Snapshot
  /** Chart data for the hazard modules and readiness; they render without charts until it arrives. */
  mini?: MiniData
}

/**
 * Status Board (plan §4.2, mockups 1 and 4). Desktop: crew ID and readiness on the left, the twin bay in the
 * middle, live vitals and Next Action on the right, five hazard modules along the bottom, all in one screen.
 */
export function StatusBoard({ snap, mini }: Props) {
  const index = snap.crew.findIndex((c) => c.id === snap.crewId)
  const who = snap.crew[index]
  // One telemetry stream feeds both the vitals and the twin's heartbeat.
  const telemetry = useLiveTelemetry(snap.crewId)
  const host = useRef<HTMLDivElement>(null)
  const focus = useBoard((s) => s.focusHazard)
  const setFocus = useBoard((s) => s.setFocusHazard)
  const top = snap.alerts[0]
  useAlertPulse(host, top?.status === 'act' ? top.hazard : null)
  const held = heldBy(snap.tiles)
  const worstTile = held ? snap.tiles.find((t) => t.name === held.name) : null
  const n = snap.alerts.length
  const ago = mini?.lastCheckIn == null ? null : Math.max(0, (snap.now - mini.lastCheckIn) / 3_600_000)
  const due = mini !== undefined && (ago === null || ago >= CHECKIN_DUE_H)
  const name = who?.name ?? 'Crew member'

  return (
    <div className="board" ref={host}>
      <div className="bd-left">
        <section className="hp bd-id" aria-label="Crew member">
          <Portrait initials={initials(name)} status={snap.overall} />
          <div>
            <p className="bd-eb">Crew {String(index + 1).padStart(2, '0')} · {who?.role}</p>
            <h1>{name}</h1>
            <StatusTag status={snap.overall} label={`${STATUS_WORD[snap.overall]} · ${n ? `${n} alert${n > 1 ? 's' : ''}` : 'no alerts'}`} />
          </div>
        </section>
        <HudPanel className="bd-ready" data-tour="readiness" title="Readiness" meta={<Link to="/nasa" className="bd-ridge" title="NASA’s five hazards of human spaceflight: the NASA basis">RIDGE · 5 hazards</Link>} aria-label={`Readiness for ${name}`}>
          <ReadinessRing value={snap.readiness} status={snap.overall} />
          <p className="bd-held">
            {held ? <>Held back by <b className={`st-${held.status}`}>{held.name}</b></> : 'All five hazards nominal'}
          </p>
          <p className="sr-only" aria-live="polite">{n === 0 ? 'No active alerts' : `${n} active alert${n > 1 ? 's' : ''}`}</p>
          <div className="bd-kpis">
            <KpiGrid>
              <KpiCell label="7-day range" value={mini ? `${Math.min(...mini.readiness)}–${Math.max(...mini.readiness)}%` : '—'} />
              <KpiCell label="Active alerts" value={n} status={n ? snap.overall : undefined} />
              <KpiCell label="Last check-in" value={<Link to="/checkin">{ago === null ? 'None' : `${ago.toFixed(0)} h ago`}{due && ' · due'}</Link>} status={due ? 'watch' : undefined} />
              <KpiCell label="Worst hazard" value={worstTile ? worstTile.name : 'None'} />
            </KpiGrid>
          </div>
          {mini && (
            <div className="bd-bars" role="img" aria-label={`Readiness, last 7 days: ${mini.readiness.join(', ')} percent`}>
              {mini.readiness.map((v, i) => <i key={i} style={{ height: `${Math.max(4, v)}%` }} />)}
            </div>
          )}
          {/* Phones: the two facts that sit beside the gauge in mockup 4 */}
          <dl className="bd-ph-facts">
            <div><dt>Held back by</dt><dd className={held ? `st-${held.status}` : undefined}>{held ? held.name : 'Nothing'}</dd></div>
            <div><dt>Check-in</dt><dd className={due ? 'st-watch' : undefined}>{mini === undefined ? '—' : due ? 'Due' : `${ago!.toFixed(0)} h ago`}</dd></div>
          </dl>
        </HudPanel>
      </div>

      <Twin tiles={snap.tiles} overall={snap.overall} hr={telemetry.targets.hr} name={name}
        top={top ? { name: snap.tiles.find((t) => t.hazard === top.hazard)?.name ?? top.hazard, status: top.status } : null} />

      <div className="bd-right">
        <LiveVitals crewId={snap.crewId} telemetry={telemetry} />
        <NextAction snap={snap} />
      </div>

      <ul className="hz-row" aria-label="Hazard status" data-tour="hazards">
        {snap.tiles.map((t) => (
          <li key={t.hazard} id={`hz-${t.hazard}`} tabIndex={0}
            className={`hp hz-mod st-${t.status}${t.status !== 'nominal' ? ` tone-${t.status}` : ''}${focus === t.hazard ? ' is-linked' : ''}`}
            onMouseEnter={() => setFocus(t.hazard)} onMouseLeave={() => setFocus(null)} onFocus={() => setFocus(t.hazard)} onBlur={() => setFocus(null)}
            aria-label={`${t.name}: ${STATUS_WORD[t.status]}. ${t.label} ${t.value} ${t.unit}`}>
            <header className="hz-head">
              <span className="hz-code" aria-hidden="true">{t.hazard}</span>
              <h2 className="hz-name">{t.name}</h2>
              <StatusTag status={t.status} short />
            </header>
            <p className="hz-val">
              <b>{t.value}</b><span className="hz-unit">{t.unit}</span>
              {t.hazard === 'D'
                ? <span className="hz-sig">{snap.pendingSync} pending</span>
                : t.sigma !== undefined && <span className="hz-sig" title="Against this person’s own baseline">{sigmaText(t.sigma)}</span>}
            </p>
            <p className="hz-lbl">
              <span>{caption(t)}</span>
              <NasaRef to={`/nasa#nasa-${t.hazard}`} label={hazardTag(t.hazard)} title={`${HAZARD_BASIS.find((h) => h.id === t.hazard)?.nasaName}: the NASA basis`} />
            </p>
            {mini && <div className="hz-chart"><Mini hazard={t.hazard} mini={mini} oldestPendingH={snap.oldestPendingH} /></div>}
            <p className="hz-ph" aria-hidden="true">{STATUS_SHORT[t.status]}</p>
            <p className="sr-only">{t.alerts.length > 0 ? t.alerts[0].explanation : t.tracks}</p>
          </li>
        ))}
      </ul>
    </div>
  )
}
