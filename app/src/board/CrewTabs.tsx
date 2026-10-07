import type { CrewMember } from '../data/types'

/** Crew switcher: a labelled group of toggle buttons (the selected one is aria-pressed). */
export function CrewTabs({ crew, crewId, onSelect }: { crew: CrewMember[]; crewId: string; onSelect: (id: string) => void }) {
  return (
    <div role="group" aria-label="Crew member" className="crew-tabs">
      {crew.map((c) => (
        <button key={c.id} type="button" aria-pressed={c.id === crewId} className={c.id === crewId ? 'on' : ''} onClick={() => onSelect(c.id)}>
          {c.name}
        </button>
      ))}
    </div>
  )
}
