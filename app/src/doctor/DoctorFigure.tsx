import { useEffect, useRef, useState } from 'react'
import { onVitaLine, onVitaWord } from '../audio/voice'
import { useReducedMotion } from '../live/usePaused'
import { VitaAvatar } from '../vita/VitaAvatar'
import type { DoctorFigure as Figure } from './figure3d'

const MODEL = `${import.meta.env.BASE_URL}models/doctor.glb`
const hasWebGL = () => typeof window !== 'undefined' && 'WebGLRenderingContext' in window

/**
 * VITA as a person: the 3D crew doctor standing on the holo pedestal (figure3d.ts). three.js and the 3 MB model load on
 * demand; the figure materialises when they arrive. Where WebGL is missing or the model will not load, VITA's particle
 * drone takes the spot, so the screen never shows a hole. `talking`: gestures, body language and lips (timed to the words VITA says);
 * `thinking`: a thoughtful pose while she works; `listening`: an attentive pose while the crew member asks; `size` is the drone's.
 */
export function DoctorFigure({ talking = false, thinking = false, listening = false, size = 270 }: { talking?: boolean; thinking?: boolean; listening?: boolean; size?: number }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const figure = useRef<Figure | null>(null)
  const talk = useRef(talking)
  const think = useRef(thinking)
  const ear = useRef(listening)
  const reduced = useReducedMotion()
  const [failed, setFailed] = useState(!hasWebGL())

  useEffect(() => {
    const el = canvas.current
    if (failed || !el) return
    let gone = false
    void import('./figure3d').then(({ createDoctorFigure }) => {
      if (gone) return
      figure.current = createDoctorFigure(el, { url: MODEL, reduced, onError: () => { if (!gone) setFailed(true) } })
      figure.current.talk(talk.current); figure.current.think(think.current); figure.current.listen(ear.current)
    }).catch(() => { if (!gone) setFailed(true) })
    return () => { gone = true; figure.current?.stop(); figure.current = null }
  }, [reduced, failed])
  useEffect(() => { talk.current = talking; figure.current?.talk(talking) }, [talking])
  useEffect(() => { think.current = thinking; figure.current?.think(thinking) }, [thinking])
  useEffect(() => { ear.current = listening; figure.current?.listen(listening) }, [listening])
  useEffect(() => onVitaLine((ws) => figure.current?.line(ws)), [])
  useEffect(() => onVitaWord((w) => figure.current?.word(w)), [])

  if (failed) return <VitaAvatar talking={talking} size={size} />
  // keyed on reduced motion: a canvas whose WebGL context was released cannot be drawn on again
  return <canvas key={String(reduced)} ref={canvas} className="dr-doctor" aria-hidden="true" />
}
