import { useId } from 'react'
import { BACKDROPS, backdropFor, useBackdropStore } from './backdropStore'

/** Backdrop choice inside the overflow menu: each crew member picks their own scene. Native radios, so arrow keys and screen readers work as usual. */
export function BackdropChoices({ crewId, crewName }: { crewId: string; crewName: string }) {
  const current = useBackdropStore((s) => backdropFor(s.byCrew, crewId))
  const choose = useBackdropStore((s) => s.choose)
  const name = useId()
  return (
    <fieldset className="bd-menu">
      <legend>Backdrop for {crewName}</legend>
      {BACKDROPS.map((b) => (
        <label key={b.id} className={b.id === current ? 'on' : undefined}>
          <input type="radio" name={name} value={b.id} checked={b.id === current} onChange={() => choose(crewId, b.id)} />
          <span className={`bd-thumb bd-thumb-${b.id}`} aria-hidden="true" />
          <span className="bd-text"><b>{b.name}</b><small>{b.hint}</small></span>
        </label>
      ))}
    </fieldset>
  )
}
