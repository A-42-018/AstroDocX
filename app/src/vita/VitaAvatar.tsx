import { useEffect, useRef } from 'react'
import { useReducedMotion } from '../live/usePaused'
import { createVitaBot, type VitaBot } from './bot'

/** VITA's particle drone on a canvas. `talking` makes it speak; `size` is in CSS pixels. */
export function VitaAvatar({ talking = false, size = 96, perk = 0 }: { talking?: boolean; size?: number; perk?: number }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const bot = useRef<VitaBot | null>(null)
  const reduced = useReducedMotion()
  const dpr = typeof window === 'undefined' ? 1 : Math.min(window.devicePixelRatio || 1, 2)

  useEffect(() => {
    if (!canvas.current) return
    const b = createVitaBot(canvas.current, { reduced })
    bot.current = b
    return () => { b.stop(); bot.current = null }
  }, [reduced])
  useEffect(() => { bot.current?.talk(talking) }, [talking, reduced])
  useEffect(() => { if (perk) bot.current?.perk() }, [perk])

  return <canvas ref={canvas} className="vita-avatar" width={Math.round(size * dpr)} height={Math.round(size * dpr)} style={{ width: size, height: size }} aria-hidden="true" />
}
