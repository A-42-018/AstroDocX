import type { Status } from '../data/types'
import { initials } from '../shell/format'
import { StatusPill } from '../shell/icons'
import type { ShellCrew } from '../shell/useShellData'

const WORD: Record<Status, string> = { nominal: 'Nominal', watch: 'Watch', act: 'Act' }

/** Four compact cards: readiness ring and worst hazard for each person. Click to switch. */
export function CrewOverview({ crew, crewId, onSelect }: { crew: ShellCrew[]; crewId: string; onSelect: (id: string) => void }) {
  return (
    <section aria-label="Crew overview">
      <h2 className="sec-title">Crew</h2>
      <ul className="crew-ov">
        {crew.map((c) => (
          <li key={c.id}>
            <button
              type="button" aria-pressed={c.id === crewId} className={`glass st-${c.status}${c.id === crewId ? ' on' : ''}`}
              aria-label={`Show ${c.name}: readiness ${c.readiness} percent, ${WORD[c.status]}${c.worstHazard ? `, worst hazard ${c.worstHazard}` : ''}`}
              onClick={() => onSelect(c.id)}
            >
              <span className="ov-ring" aria-hidden="true">
                <svg viewBox="0 0 44 44"><circle cx="22" cy="22" r="18" className="ring-track" /><circle cx="22" cy="22" r="18" className="ring-fill" pathLength={100} strokeDasharray={`${c.readiness} 100`} transform="rotate(-90 22 22)" /></svg>
                <b>{initials(c.name)}</b>
              </span>
              <span className="ov-text" aria-hidden="true">
                <b>{c.name}</b>
                <span className="mono">{c.readiness}%{c.worstHazard ? ` · ${c.worstHazard}` : ''}</span>
              </span>
              <span aria-hidden="true"><StatusPill status={c.status} /></span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
