import { Wallpaper } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import { BACKDROPS, backdropFor, useBackdropStore } from './backdropStore'

/** Backdrop menu in the top bar: each crew member picks their own scene. Native radios, so arrow keys and screen readers work as usual. */
export function BackdropPicker({ crewId, crewName }: { crewId: string; crewName: string }) {
  const current = useBackdropStore((s) => backdropFor(s.byCrew, crewId))
  const choose = useBackdropStore((s) => s.choose)
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const button = useRef<HTMLButtonElement>(null)
  const panelId = useId()

  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false) }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { setOpen(false); button.current?.focus() } }
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    // Focus the chosen scene so the arrow keys work straight away.
    root.current?.querySelector<HTMLInputElement>('input:checked')?.focus()
    return () => { document.removeEventListener('pointerdown', onDown); document.removeEventListener('keydown', onKey) }
  }, [open])

  return (
    <div className="bd-pick" ref={root}>
      <button
        ref={button} type="button" className="bell" aria-expanded={open} aria-controls={panelId}
        aria-label="Backdrop" title="Change the backdrop" onClick={() => setOpen((o) => !o)}
      >
        <Wallpaper size={19} strokeWidth={1.9} aria-hidden="true" />
      </button>
      {open && (
        <fieldset id={panelId} className="bd-menu">
          <legend>Backdrop for {crewName}</legend>
          {BACKDROPS.map((b) => (
            <label key={b.id} className={b.id === current ? 'on' : undefined}>
              <input type="radio" name={`${panelId}-bd`} value={b.id} checked={b.id === current} onChange={() => choose(crewId, b.id)} />
              <span className={`bd-thumb bd-thumb-${b.id}`} aria-hidden="true" />
              <span className="bd-text"><b>{b.name}</b><small>{b.hint}</small></span>
            </label>
          ))}
        </fieldset>
      )}
    </div>
  )
}
