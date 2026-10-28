import { met } from '../engine/actions'
import { ONE_WAY_DELAY_MIN } from '../sync/link'
import type { GroundAlert, GroundCrew } from './derive'
import { Brackets, KpiCell, KpiGrid, PanelHeader, StatusTag, buttonClass } from '../ui'
import { RefreshCw } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { BODY_D } from '../board/Twin'
import { drawMiniBody, loadBody, type Body3D } from '../board/body3d'
import { duration } from '../shell/format'
import type { Status } from '../data/types'

/** Small body figure whose colour is the worst status the ground knows about: the 3D twin's points seen from the
    front, or the SVG outline until (or unless) the body loads. */
function MiniTwin({ status }: { status: Status }) {
  const [body, setBody] = useState<Body3D | null>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  useEffect(() => { let on = true; void loadBody().then((b) => { if (on) setBody(b) }); return () => { on = false } }, [])
  useEffect(() => {
    const el = canvas.current
    if (!body || !el) return
    const paint = () => drawMiniBody(el, body, getComputedStyle(el).getPropertyValue('--st').trim() || '#2dd4e8')
    paint()
    const ro = new ResizeObserver(paint)
    ro.observe(el)
    return () => ro.disconnect()
  }, [body, status])
  if (body) return <canvas ref={canvas} className={`mini-body st-${status}`} aria-hidden="true" />
  return (
    <svg className={`mini-twin st-${status}`} viewBox="0 0 300 660" aria-hidden="true">
      <path d={BODY_D} className="twin-aura" />
      <path d={BODY_D} className="twin-body" fillRule="evenodd" fill="rgba(45, 212, 232, 0.12)" />
    </svg>
  )
}


function AlertRow({ a }: { a: GroundAlert }) {
  return (
    <li className={`gd-alert st-${a.level}`}>
      <p className="gd-alert-t"><StatusTag status={a.level} /><span>{a.text.replace(/^(WATCH|ACT):\s*/, '')}</span></p>
      <span className="gd-alert-m">opened {met(a.openedAt)} · {a.stepsDone} step{a.stepsDone === 1 ? '' : 's'} reported done</span>
    </li>
  )
}

interface Props {
  now: number
  lastSyncedAt: number | null
  /** Entries still on the crew's device; null when reading from a server, which cannot know. */
  pending: number | null
  crew: GroundCrew[]
  /** Where this view's data comes from. */
  source?: string
  sourceError?: string
  onRefresh?: () => void
  refreshing?: boolean
}

const shortMet = (ts: number) => met(ts).replace(' MET', '')
/** CO, FE, MO, PI: two letters, as on the crew avatars. */
const initials = (name: string) => { const w = name.split(/\s+/); return (w.length > 1 ? w[0][0] + w[1][0] : name.slice(0, 2)).toUpperCase() }

/** Ground view (plan §4.7): how far behind Earth is, then one profile bay per crew member with only what was downlinked. */
export function GroundView({ now, lastSyncedAt, pending, crew, source, sourceError, onRefresh, refreshing }: Props) {
  const open = crew.reduce((n, c) => n + c.open.length, 0)
  const behind = lastSyncedAt === null ? null : duration(Math.max(0, now - lastSyncedAt) + ONE_WAY_DELAY_MIN * 60_000)
  return (
    <div className="gd">
      <section className="hp gd-head" aria-label="Ground view status">
        <Brackets />
        <div className="gd-intro">
          <PanelHeader title="Ground view // flight surgeon" meta="What Earth can see" />
          <h1 className="gd-h1">Ground view · flight surgeon</h1>
          <p className="gd-lede">
            Everything here is rebuilt from log entries the crew has already synced, about {ONE_WAY_DELAY_MIN} min after each contact. The crew's own console is always ahead of this page.
          </p>
          <p className="gd-mono">
            Mission {met(now)} · data current to {lastSyncedAt === null ? 'nothing yet' : met(lastSyncedAt)} {pending !== null && `· ${pending} entr${pending === 1 ? 'y' : 'ies'} still on board`}
          </p>
          {source && <p className="gd-mono">Source: {source}</p>}
          {sourceError && <p role="alert" className="form-error">Could not reach the ground server ({sourceError}). Showing this device's synced entries instead.</p>}
        </div>
        <p className={`gd-behind${behind === null ? ' none' : ''}`} role="status">
          {behind === null
            ? 'Earth has heard nothing from the crew yet.'
            : <><span>Earth is </span><b>{behind}</b><span> behind the crew.</span></>}
        </p>
        <div className="gd-side">
          <KpiGrid>
            <KpiCell label="Mission time" value={<span className="gd-cy">{shortMet(now)}</span>} />
            <KpiCell label="On board" value={pending === null ? '—' : pending} status={pending ? 'watch' : undefined} sub={pending === null ? 'server source' : `entr${pending === 1 ? 'y' : 'ies'}`} />
            <KpiCell label="Open alerts" value={open} status={open ? 'watch' : undefined} />
            <KpiCell label="Data current to" value={lastSyncedAt === null ? '—' : shortMet(lastSyncedAt)} />
          </KpiGrid>
          <div className="gd-acts">
            {onRefresh && <button type="button" className={buttonClass('ghost', 'sm')} onClick={onRefresh} disabled={refreshing} aria-busy={refreshing || undefined}><RefreshCw size={14} aria-hidden="true" />{refreshing ? 'Refreshing…' : 'Refresh from server'}</button>}
            <span className="gd-mono">{open === 0 ? 'No open alerts known to the ground.' : `${open} open alert${open === 1 ? '' : 's'} known to the ground.`}</span>
          </div>
        </div>
      </section>

      <ul className="gd-bays" aria-label="Crew as known on the ground">
        {crew.map((g, i) => {
          const worst: Status = g.open.some((a) => a.level === 'act') ? 'act' : g.open.length ? 'watch' : 'nominal'
          return (
            <li key={g.crew.id} className={`hp gd-bay st-${worst}${worst !== 'nominal' ? ` tone-${worst}` : ''}`} aria-label={`${g.crew.name}: ${worst === 'nominal' ? 'no open alerts' : `${g.open.length} open`}`}>
              <header className="gd-who">
                <span className="gd-hex" aria-hidden="true">{initials(g.crew.name)}</span>
                <div>
                  <p className="gd-eb">Crew {String(i + 1).padStart(2, '0')}{g.crew.role !== g.crew.name && ` · ${g.crew.role}`}</p>
                  <h2>{g.crew.name}</h2>
                </div>
                <StatusTag status={worst} />
              </header>
              <div className="gd-tw"><MiniTwin status={worst} /><span className="gd-floor" aria-hidden="true" /></div>
              <dl className="kpis gd-ci">
                <KpiCell label="Last check-in" value={g.lastCheckIn ? shortMet(g.lastCheckIn.ts) : 'None yet'} />
                <KpiCell label="Open" value={g.open.length} status={worst !== 'nominal' ? worst : undefined} />
              </dl>
              {g.open.length > 0 ? <ul className="gd-alerts">{g.open.map((a) => <AlertRow key={a.alertId} a={a} />)}</ul> : <p className="gd-none">No open alerts reported.</p>}
              <div className="gd-foot">
                {g.awaiting > 0 && <span className="gd-await">{g.awaiting} on board, not yet downlinked</span>}
                <p className="gd-mono">{g.resolved.length > 0 ? `Recently resolved: ${g.resolved.map((a) => shortMet(a.resolvedAt!)).join(', ')}` : 'Nothing resolved recently'}</p>
              </div>
            </li>
          )
        })}
      </ul>
      <p className="gd-note">Prototype, not a medical device. Simulated link; the ground sees only what the Ground Sync tab has sent.</p>
    </div>
  )
}
