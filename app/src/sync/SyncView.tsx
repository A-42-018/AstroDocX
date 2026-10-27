import { Download } from 'lucide-react'
import { useState } from 'react'
import { met } from '../engine/actions'
import type { ActionLogEntry, CrewMember, Status } from '../data/types'
import { HOUR } from '../data/synthetic'
import { Brackets, HudPanel, KpiCell, KpiGrid, PanelHeader, StatusTag, Switch, buttonClass } from '../ui'
import { ONE_WAY_DELAY_MIN, WINDOW_LEN, type LinkInfo } from './link'
import { LinkDiagram } from './LinkDiagram'
import { LogTable } from './LogTable'

const STATE: Record<LinkInfo['state'], { text: string; st: Status }> = {
  open: { text: 'LINK OPEN', st: 'nominal' },
  closed: { text: 'WAITING FOR WINDOW', st: 'watch' },
  blackout: { text: 'BLACKOUT', st: 'act' },
}

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
const shortMet = (ts: number) => met(ts).replace(' MET', '')

/** A queued entry is a packet waiting to leave: cyan edge, kind, time, text. */
function Packet({ e }: { e: ActionLogEntry }) {
  return (
    <li className="sy-pkt">
      <span className="sy-kind">{e.kind}</span>
      <span className="sy-pkt-t">{met(e.ts)}</span>
      <p>{e.text}</p>
    </li>
  )
}

/** Ground Sync (plan §4.7): the link hero with the window ring, KPI cells, controls, the outbox and the on-board log. */
export function SyncView({ now, link, pending, synced, lastSyncedAt, station, blackout, auto, busy, message, error, onSync, onBlackout, onAuto, onExport, log, crew }: Props) {
  const s = STATE[link.state]
  // When queued entries leave while this screen is open, a burst of packets flies to Earth.
  const [seen, setSeen] = useState(pending.length)
  const [burst, setBurst] = useState({ n: 0, key: 0 })
  if (pending.length !== seen) {
    setSeen(pending.length)
    if (pending.length < seen) setBurst((b) => ({ n: seen - pending.length, key: b.key + 1 }))
  }
  const sinceSync = lastSyncedAt === null ? null : hoursUntil(now, lastSyncedAt)
  return (
    <div className="sy">
      <section className={`hp sy-hero st-${s.st}`} aria-label="Ground link status">
        <Brackets />
        <PanelHeader title="Ground link // ship → relay → Earth" meta={`One-way delay ~${ONE_WAY_DELAY_MIN} min`} />
        <div className="sy-title">
          <h1 className="sy-h1">Ground sync</h1>
          <span className="sy-state"><StatusTag status={s.st} label={s.text} /></span>
        </div>
        <p className="sy-sub">
          {link.state === 'open' && `Window closes in ${hoursUntil(link.closesAt!, now).toFixed(1)} h.`}
          {link.state === 'closed' && `Next window opens ${met(link.nextOpen)} (in ${hoursUntil(link.nextOpen, now).toFixed(1)} h) for ${WINDOW_LEN / HOUR} h.`}
          {link.state === 'blackout' && 'No uplink or downlink. Everything keeps working on board and queues here until the blackout ends.'}
        </p>
        <LinkDiagram link={link} now={now} queued={pending.length} burst={burst} />
      </section>

      <div className="sy-kpis">
        <KpiGrid>
          <KpiCell label={link.state === 'open' ? 'Window closes' : 'Next window'} value={link.state === 'blackout' ? '—' : shortMet(link.state === 'open' ? link.closesAt! : link.nextOpen)}
            status={link.state === 'closed' ? 'watch' : undefined} sub={`${WINDOW_LEN / HOUR} h contact`} />
          <KpiCell label="Queued" value={pending.length} sub="on board" />
          <KpiCell label="Last sync" value={lastSyncedAt === null ? 'Never' : shortMet(lastSyncedAt)} sub={sinceSync === null ? undefined : `${sinceSync.toFixed(1)} h ago`} />
          <KpiCell label="Auto-sync" value={<span className={auto ? 'sy-on' : undefined}>{auto ? 'On' : 'Off'}</span>} sub="in windows" />
          <KpiCell label="Station" value={<span className="sy-station">{station}</span>} />
        </KpiGrid>
      </div>

      <HudPanel title="Controls" meta={s.text} className="sy-ctl">
        <button type="button" className={buttonClass('primary', 'lg')} disabled={busy || link.state !== 'open' || pending.length === 0} aria-busy={busy || undefined} onClick={onSync}>
          Sync {pending.length} entr{pending.length === 1 ? 'y' : 'ies'} now
        </button>
        <p className="sy-hint">
          {link.state === 'open' ? (pending.length === 0 ? 'Nothing waiting to send' : 'Link open · send the queue now')
            : link.state === 'closed' ? `Opens with the next window · ${shortMet(link.nextOpen)}` : 'No link during the blackout'}
        </p>
        {message && <p role="status" className="sy-ok">{message}</p>}
        {error && <p role="alert" className="form-error">{error}</p>}
        <div className="sy-sw">
          <Switch checked={blackout} onChange={onBlackout}>Simulate comms blackout</Switch>
          <p>No uplink or downlink until it ends.</p>
        </div>
        <div className="sy-sw">
          <Switch checked={auto} onChange={onAuto}>Auto-sync in windows (simulator)</Switch>
          <p>The simulator sends the queue when a window opens.</p>
        </div>
        {onExport && <button type="button" className={buttonClass('ghost', 'md', 'sy-csv')} onClick={onExport}><Download size={16} aria-hidden="true" />Download log (CSV)</button>}
        <p className="sy-note">Windows are illustrative: two 2-hour contacts per mission day (00:00 and 12:00 MET). Prototype, not a medical device.</p>
      </HudPanel>

      <HudPanel title="Outbox" meta={`${pending.length} pending`} className="sy-out" aria-label="Outbox">
        {pending.length === 0 ? <p className="sy-empty">Everything is synced.</p> : (
          <ul className="sy-pkts">{pending.map((e) => <Packet key={e.id} e={e} />)}</ul>
        )}
        <section className="sy-sent" aria-label="Recently synced">
          <h3 className="sy-sent-h">Recently synced</h3>
          {synced.length === 0 ? <p className="sy-empty">Nothing synced yet.</p> : (
            <ul>
              {synced.map((e) => (
                <li key={e.id}>
                  <span>{e.text}</span>
                  <span className="sy-pkt-t">{e.syncedAt !== undefined ? `→ ${shortMet(e.syncedAt)}` : shortMet(e.ts)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </HudPanel>

      {log && crew && <LogTable log={log} crew={crew} />}
    </div>
  )
}
