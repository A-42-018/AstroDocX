import { CircleCheck, Clock } from 'lucide-react'
import { useState } from 'react'
import { met } from '../engine/actions'
import type { ActionLogEntry, CrewMember } from '../data/types'

type State = 'all' | 'pending' | 'synced'
const SHOW = 100

/** The whole on-board log, newest first, with filters for state, kind and person. */
export function LogTable({ log, crew }: { log: ActionLogEntry[]; crew: CrewMember[] }) {
  const [state, setState] = useState<State>('all')
  const [kind, setKind] = useState('all')
  const [who, setWho] = useState('all')
  const kinds = [...new Set(log.map((e) => e.kind))].sort()
  const rows = log
    .filter((e) => (state === 'all' || e.sync === state) && (kind === 'all' || e.kind === kind) && (who === 'all' || e.crewId === who))
    .sort((a, b) => b.ts - a.ts || (b.id ?? 0) - (a.id ?? 0))
  const name = (id: string) => crew.find((c) => c.id === id)?.name ?? id
  return (
    <section aria-label="On-board log">
      <h2 className="sec-title">On-board log</h2>
      <div className="log-filters">
        <div role="group" aria-label="Sync state" className="chips">
          {(['all', 'pending', 'synced'] as const).map((s) => <button key={s} type="button" className={`chip${state === s ? ' on' : ''}`} aria-pressed={state === s} onClick={() => setState(s)}>{s[0].toUpperCase() + s.slice(1)}</button>)}
        </div>
        <label className="field"><span>Kind</span>
          <select value={kind} onChange={(e) => setKind(e.target.value)}><option value="all">All kinds</option>{kinds.map((k) => <option key={k} value={k}>{k}</option>)}</select>
        </label>
        <label className="field"><span>Person</span>
          <select value={who} onChange={(e) => setWho(e.target.value)}><option value="all">Whole crew</option>{crew.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
        </label>
      </div>
      <div className="glass log-table-wrap">
        {rows.length === 0 ? <p className="muted" style={{ margin: 0 }}>No entries match.</p> : (
          <table className="log-table">
            <thead><tr><th scope="col">Time</th><th scope="col">Person</th><th scope="col">Kind</th><th scope="col">Entry</th><th scope="col">Status</th></tr></thead>
            <tbody>
              {rows.slice(0, SHOW).map((e) => (
                <tr key={e.id}>
                  <td className="mono">{met(e.ts)}</td>
                  <td>{name(e.crewId)}</td>
                  <td><span className="badge mono kind">{e.kind}</span></td>
                  <td>{e.text}</td>
                  <td>{e.sync === 'synced'
                    ? <span className="sync-tag ok"><CircleCheck size={14} aria-hidden="true" />Synced{e.syncedAt !== undefined ? ` ${met(e.syncedAt)}` : ''}</span>
                    : <span className="sync-tag wait"><Clock size={14} aria-hidden="true" />Pending</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {rows.length > SHOW && <p className="muted note">Showing the newest {SHOW} of {rows.length} entries. Download the CSV for all of them.</p>}
    </section>
  )
}
