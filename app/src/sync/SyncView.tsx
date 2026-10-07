import { met } from '../engine/actions'
import type { ActionLogEntry } from '../data/types'
import { HOUR } from '../data/synthetic'
import { ONE_WAY_DELAY_MIN, WINDOW_LEN, type LinkInfo } from './link'

const STATE = {
  open: { icon: '●', text: 'LINK OPEN', cls: 'st-nominal' },
  closed: { icon: '▲', text: 'WAITING FOR WINDOW', cls: 'st-watch' },
  blackout: { icon: '◆', text: 'BLACKOUT', cls: 'st-act' },
} as const

interface Props {
  now: number
  link: LinkInfo
  pending: ActionLogEntry[]
  synced: ActionLogEntry[]
  lastSyncedAt: number | null
  /** Where uploads go (simulated, or a real ground server). */
  station: string
  blackout: boolean
  auto: boolean
  busy: boolean
  message: string
  error: string
  onSync: () => void
  onBlackout: (b: boolean) => void
  onAuto: (b: boolean) => void
  /** Download the whole on-board log as CSV. */
  onExport?: () => void
}

const hoursUntil = (t: number, now: number) => Math.max(0, (t - now) / HOUR)

function Entry({ e, sent }: { e: ActionLogEntry; sent?: boolean }) {
  return (
    <li className="glass log-entry">
      <span className="mono muted">{met(e.ts)}{sent && e.syncedAt !== undefined ? ` → sent ${met(e.syncedAt)}` : ''}</span>
      <span className="badge mono kind">{e.kind}</span>
      <span>{e.text}</span>
    </li>
  )
}

export function SyncView({ now, link, pending, synced, lastSyncedAt, station, blackout, auto, busy, message, error, onSync, onBlackout, onAuto, onExport }: Props) {
  const s = STATE[link.state]
  return (
    <div className="board">
      <section className={`glass link ${s.cls}`} aria-label="Ground link status">
        <h1 style={{ margin: 0 }}>Ground sync</h1>
        <p className="link-state mono"><span aria-hidden="true">{s.icon}</span> {s.text}</p>
        <p className="muted">
          {link.state === 'open' && `Window closes in ${hoursUntil(link.closesAt!, now).toFixed(1)} h.`}
          {link.state === 'closed' && `Next window opens ${met(link.nextOpen)} (in ${hoursUntil(link.nextOpen, now).toFixed(1)} h) for ${WINDOW_LEN / HOUR} h.`}
          {link.state === 'blackout' && 'No uplink or downlink. Everything keeps working on board and queues here until the blackout ends.'}
        </p>
        <p className="mono muted">
          {met(now)} · {pending.length} queued · {lastSyncedAt === null ? 'never synced' : `last sync ${met(lastSyncedAt)}`} · one-way delay ~{ONE_WAY_DELAY_MIN} min
        </p>
        <p className="mono muted">Ground station: {station}</p>
        <div className="sim-steps">
          <button type="button" className="btn" disabled={busy || link.state !== 'open' || pending.length === 0} onClick={onSync}>
            Sync {pending.length} entr{pending.length === 1 ? 'y' : 'ies'} now
          </button>
          <label className="check"><input type="checkbox" checked={blackout} onChange={(e) => onBlackout(e.target.checked)} /> Simulate comms blackout</label>
          {onExport && <button type="button" className="btn ghost" onClick={onExport}>Download log (CSV)</button>}
          <label className="check"><input type="checkbox" checked={auto} onChange={(e) => onAuto(e.target.checked)} /> Auto-sync in windows (simulator)</label>
        </div>
        {message && <p role="status" className="sync-ok">{message}</p>}
        {error && <p role="alert" className="form-error">{error}</p>}
        <p className="muted note">Windows are illustrative: two 2-hour contacts per mission day (00:00 and 12:00 MET). Concept prototype, not a medical device.</p>
      </section>

      <section aria-label="Outbox">
        <h2 className="sec-title">Outbox · pending ({pending.length})</h2>
        {pending.length === 0 ? <p className="muted">Everything is synced.</p> : (
          <ul className="log-list">{pending.map((e) => <Entry key={e.id} e={e} />)}</ul>
        )}
      </section>

      <section aria-label="Recently synced">
        <h2 className="sec-title">Recently synced</h2>
        {synced.length === 0 ? <p className="muted">Nothing synced yet.</p> : (
          <ul className="log-list">{synced.map((e) => <Entry key={e.id} e={e} sent />)}</ul>
        )}
      </section>
    </div>
  )
}
