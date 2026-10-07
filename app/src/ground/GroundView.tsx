import { met } from '../engine/actions'
import { ONE_WAY_DELAY_MIN } from '../sync/link'
import type { GroundAlert, GroundCrew } from './derive'
import { StatusPill } from '../shell/icons'
import { BODY_D } from '../board/Twin'
import { duration } from '../shell/format'
import type { Status } from '../data/types'

/** Small body silhouette whose glow is the worst status the ground knows about. */
function MiniTwin({ status }: { status: Status }) {
  return (
    <svg className={`mini-twin st-${status}`} viewBox="0 0 300 660" aria-hidden="true">
      <path d={BODY_D} className="twin-aura" />
      <path d={BODY_D} className="twin-body" fillRule="evenodd" fill="rgba(45, 212, 232, 0.12)" />
    </svg>
  )
}


function AlertRow({ a }: { a: GroundAlert }) {
  return (
    <li className={`ground-alert st-${a.level}`}>
      <StatusPill status={a.level} />
      <span>{a.text.replace(/^(WATCH|ACT):\s*/, '')}</span>
      <span className="mono muted">opened {met(a.openedAt)} · {a.stepsDone} step{a.stepsDone === 1 ? '' : 's'} reported done</span>
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

export function GroundView({ now, lastSyncedAt, pending, crew, source, sourceError, onRefresh, refreshing }: Props) {
  const open = crew.reduce((n, c) => n + c.open.length, 0)
  return (
    <div className="board">
      <section className="glass" aria-label="Ground view status">
        <h1 style={{ margin: 0 }}>Ground view · flight surgeon</h1>
        <p className="muted">
          What Earth can see. Everything here is rebuilt from log entries the crew has already synced, about {ONE_WAY_DELAY_MIN} min after each contact. The crew's own console is always ahead of this page.
        </p>
        <p className="behind" role="status">
          {lastSyncedAt === null
            ? 'Earth has heard nothing from the crew yet.'
            : <>Earth is <b>{duration(Math.max(0, now - lastSyncedAt) + ONE_WAY_DELAY_MIN * 60_000)}</b> behind the crew.</>}
        </p>
        <p className="mono">
          Mission {met(now)} · data current to {lastSyncedAt === null ? 'nothing yet' : met(lastSyncedAt)} {pending !== null && `· ${pending} entr${pending === 1 ? 'y' : 'ies'} still on board`}
        </p>
        {source && <p className="mono muted">Source: {source}</p>}
        {sourceError && <p role="alert" className="form-error">Could not reach the ground server ({sourceError}). Showing this device's synced entries instead.</p>}
        {onRefresh && <button type="button" className="btn ghost" onClick={onRefresh} disabled={refreshing}>{refreshing ? 'Refreshing…' : 'Refresh from server'}</button>}
        <p className="mono muted">{open === 0 ? 'No open alerts known to the ground.' : `${open} open alert${open === 1 ? '' : 's'} known to the ground.`}</p>
      </section>

      <ul className="ground-grid" aria-label="Crew as known on the ground">
        {crew.map((g) => {
          const worst = g.open.some((a) => a.level === 'act') ? 'act' : g.open.length ? 'watch' : 'nominal'
          return (
            <li key={g.crew.id} className={`glass ground-card st-${worst}`} aria-label={`${g.crew.name}: ${worst === 'nominal' ? 'no open alerts' : `${g.open.length} open`}`}>
              <header>
                <h2>{g.crew.name}</h2>
                <StatusPill status={worst} />
              </header>
              <MiniTwin status={worst} />
              <p className="muted ground-role">{g.crew.role}</p>
              {g.open.length > 0 ? <ul className="ground-alerts">{g.open.map((a) => <AlertRow key={a.alertId} a={a} />)}</ul> : <p className="muted">No open alerts reported.</p>}
              {g.resolved.length > 0 && (
                <p className="mono muted">Recently resolved: {g.resolved.map((a) => met(a.resolvedAt!)).join(', ')}</p>
              )}
              <p className="mono muted">{g.lastCheckIn ? `Last check-in received ${met(g.lastCheckIn.ts)}` : 'No check-in received yet'}</p>
              {g.awaiting > 0 && <p className="mono await">{g.awaiting} on board, not yet downlinked</p>}
            </li>
          )
        })}
      </ul>
      <p className="muted note">Concept prototype, not a medical device. Simulated link; the ground sees only what the Ground Sync tab has sent.</p>
    </div>
  )
}
