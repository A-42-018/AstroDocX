import type { CrewMember } from '../data/types'

export function CrewTabs({ crew, crewId, onSelect }: { crew: CrewMember[]; crewId: string; onSelect: (id: string) => void }) {
  return (
    <div role="tablist" aria-label="Crew member" className="crew-tabs">
      {crew.map((c) => (
        <button key={c.id} role="tab" aria-selected={c.id === crewId} className={c.id === crewId ? 'on' : ''} onClick={() => onSelect(c.id)}>
          {c.name}
        </button>
      ))}
    </div>
  )
}
