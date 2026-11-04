import { ChevronDown, ChevronUp } from 'lucide-react'
import { useRef, useState, type PointerEvent as RPointerEvent } from 'react'

/** What float mode asks of the visitor, bottom centre while it is on (the tour's caption card makes way for it). */
export function FloatHint({ touch }: { touch: boolean }) {
  return (
    <section className="cabin-float cabin-panel" aria-label="Float mode controls" role="status">
      <div className="cap-step">FLOAT MODE</div>
      {touch
        ? <p>Drag to look around. Use the stick to fly and the arrows to rise or sink. Tap <b>Back to tour</b> when you are done.</p>
        : <p><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> fly · drag to look · scroll to push forward · <kbd>Space</kbd> <kbd>Q</kbd> up and down · <kbd>Shift</kbd> faster · <kbd>F</kbd> or <kbd>Esc</kbd> back to the tour</p>}
    </section>
  )
}

/** A thumb stick and two lift buttons for touch screens: strafe and forward from the stick, up and down from the buttons. */
export function FloatPad({ onMove }: { onMove: (strafe: number, forward: number, lift: number) => void }) {
  const base = useRef<HTMLDivElement>(null)
  const state = useRef({ x: 0, y: 0, v: 0 })
  const [knob, setKnob] = useState({ x: 0, y: 0 })
  const push = (p: Partial<typeof state.current>) => { Object.assign(state.current, p); onMove(state.current.x, state.current.y, state.current.v) }
  const drive = (e: RPointerEvent) => {
    const r = base.current?.getBoundingClientRect()
    if (!r) return
    const reach = (r.width / 2) * 0.7
    let dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2)
    const m = Math.hypot(dx, dy)
    if (m > reach) { dx *= reach / m; dy *= reach / m }
    setKnob({ x: dx, y: dy }); push({ x: dx / reach, y: -dy / reach })
  }
  const rest = () => { setKnob({ x: 0, y: 0 }); push({ x: 0, y: 0 }) }
  return (
    <div className="float-pad">
      <div className="float-lift">
        <button type="button" aria-label="Rise" onPointerDown={() => push({ v: 1 })} onPointerUp={() => push({ v: 0 })} onPointerLeave={() => push({ v: 0 })} onPointerCancel={() => push({ v: 0 })}><ChevronUp size={22} aria-hidden="true" /></button>
        <button type="button" aria-label="Sink" onPointerDown={() => push({ v: -1 })} onPointerUp={() => push({ v: 0 })} onPointerLeave={() => push({ v: 0 })} onPointerCancel={() => push({ v: 0 })}><ChevronDown size={22} aria-hidden="true" /></button>
      </div>
      <div ref={base} className="float-stick" role="presentation"
        onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); drive(e) }}
        onPointerMove={(e) => { if (e.buttons) drive(e) }} onPointerUp={rest} onPointerCancel={rest}>
        <i style={{ transform: `translate(${knob.x}px, ${knob.y}px)` }} />
      </div>
    </div>
  )
}
