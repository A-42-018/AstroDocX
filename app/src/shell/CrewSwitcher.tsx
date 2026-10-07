import { CircleCheck, OctagonAlert, TriangleAlert, type LucideIcon } from 'lucide-react'
import { useRef, type KeyboardEvent } from 'react'
import type { Status } from '../data/types'
import { initials } from './format'
import type { ShellCrew } from './useShellData'

const STATUS_ICON: Record<Status, LucideIcon> = { nominal: CircleCheck, watch: TriangleAlert, act: OctagonAlert }
const STATUS_WORD: Record<Status, string> = { nominal: 'Nominal', watch: 'Watch', act: 'Act' }

/** Crew switcher: one avatar per person with a status ring (colour + icon + word in the name, never colour alone). Arrow keys move between people. */
export function CrewSwitcher({ crew, crewId, onSelect }: { crew: ShellCrew[]; crewId: string; onSelect: (id: string) => void }) {
  const group = useRef<HTMLDivElement>(null)
  const onKey = (e: KeyboardEvent) => {
    const step = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0
    if (!step) return
    const btns = [...(group.current?.querySelectorAll<HTMLButtonElement>('button') ?? [])]
    const i = btns.indexOf(document.activeElement as HTMLButtonElement)
    if (i < 0) return
    e.preventDefault()
    btns[(i + step + btns.length) % btns.length].focus()
  }
  return (
    <div ref={group} role="group" aria-label="Crew member" className="crew-switch" onKeyDown={onKey}>
      {crew.map((c) => {
        const Icon = STATUS_ICON[c.status]
        const on = c.id === crewId
        return (
          <button
            key={c.id} type="button" aria-pressed={on} className={`av st-${c.status}${on ? ' on' : ''}`} title={`${c.name}: ${STATUS_WORD[c.status]}`}
            onClick={() => onSelect(c.id)}
          >
            {/* The name is real text (not an aria-label), so the visible initials and the accessible name never disagree. */}
            <span className="sr-only">{`${c.name}, ${STATUS_WORD[c.status]}${c.alerts ? `, ${c.alerts} open alert${c.alerts > 1 ? 's' : ''}` : ''}`}</span>
            <span className="av-disc" aria-hidden="true">{initials(c.name)}</span>
            <span className="av-flag" aria-hidden="true"><Icon size={11} strokeWidth={3} /></span>
            {on && <span className="av-name" aria-hidden="true">{c.name}</span>}
          </button>
        )
      })}
    </div>
  )
}
