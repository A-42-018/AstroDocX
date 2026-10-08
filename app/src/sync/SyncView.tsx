import { Clock, Radio, WifiOff } from 'lucide-react'
import { useState } from 'react'
import { met } from '../engine/actions'
import type { ActionLogEntry, CrewMember } from '../data/types'
import { HOUR } from '../data/synthetic'
import { ONE_WAY_DELAY_MIN, WINDOW_LEN, type LinkInfo } from './link'
import { LinkDiagram } from './LinkDiagram'
import { LogTable } from './LogTable'

const STATE = {
  open: { Icon: Radio, text: 'LINK OPEN', cls: 'st-nominal' },
  closed: { Icon: Clock, text: 'WAITING FOR WINDOW', cls: 'st-watch' },
  blackout: { Icon: WifiOff, text: 'BLACKOUT', cls: 'st-act' },
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
  /** The whole on-board log and the crew, for the filterable table (omitted: no table). */
  log?: ActionLogEntry[]
  crew?: CrewMember[]
}

const hoursUntil = (t: number, now: number) => Math.max(0, (t - now) / HOUR)

function Entry({ e, sent }: { e: ActionLogEntry; sent?: boolean }) {
  return (
    <li className={`glass log-entry${sent ? '' : ' packet'}`}>
      <span className="mono muted">{met(e.ts)}{sent && e.syncedAt !== undefined ? ` → sent ${met(e.syncedAt)}` : ''}</span>
      <span className="badge mono kind">{e.kind}</span>
      <span>{e.text}</span>
    </li>
  )
}

export function SyncView({ now, link, pending, synced, lastSyncedAt, station, blackout, auto, busy, message, error, onSync, onBlackout, onAuto, onExport, log, crew }: Props) {
  const s = STATE[link.state]
  // When queued entries leave while this screen is open, a burst of packets flies to Earth.
  const [seen, setSeen] = useState(pending.length)
  const [burst, setBurst] = useState({ n: 0, key: 0 })
  if (pending.length !== seen) {
    setSeen(pending.length)
    if (pending.length < seen) setBurst((b) => ({ n: seen - pending.length, key: b.key + 1 }))
  }
  return (
    <div className="board">
      <section className={`glass link ${s.cls}`} aria-label="Ground link status">
        <h1 style={{ margin: 0 }}>Ground sync</h1>
        <LinkDiagram link={link} now={now} queued={pending.length} burst={burst} />
        <p className="link-state mono"><s.Icon size={18} strokeWidth={2.2} aria-hidden="true" /> {s.text}</p>
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
        <p className="muted note">Windows are illustrative: two 2-hour contacts per mission day (00:00 and 12:00 MET). Prototype, not a medical device.</p>
      </section>

      <section aria-label="Outbox">
        <h2 className="sec-title">Outbox · pending ({pending.length})</h2>
        {pending.length === 0 ? <p className="muted">Everything is synced.</p> : (
          <ul className="log-list packets">{pending.map((e) => <Entry key={e.id} e={e} />)}</ul>
        )}
      </section>

      <section aria-label="Recently synced">
        <h2 className="sec-title">Recently synced</h2>
        {synced.length === 0 ? <p className="muted">Nothing synced yet.</p> : (
          <ul className="log-list">{synced.map((e) => <Entry key={e.id} e={e} sent />)}</ul>
        )}
      </section>
      {log && crew && <LogTable log={log} crew={crew} />}
    </div>
  )
}
