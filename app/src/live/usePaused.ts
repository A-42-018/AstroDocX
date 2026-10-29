import { useEffect, useState } from 'react'

const mq = () => (typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null)

/** True when the user asked for reduced motion; follows changes while the page is open. */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() => mq()?.matches ?? false)
  useEffect(() => {
    const m = mq()
    if (!m) return
    const on = () => setReduced(m.matches)
    m.addEventListener('change', on)
    return () => m.removeEventListener('change', on)
  }, [])
  return reduced
}

/*
 * An embedded console screen (the 3D cabin's wall screens, shell/Embed.tsx) is told by the cabin when nobody can see
 * it, and then pauses like a background tab: its live twin and traces stop drawing under the cabin's own frames.
 */
let offstage = false
const offstageListeners = new Set<() => void>()
if (typeof window !== 'undefined' && window.parent !== window) {
  try { offstage = (window.frameElement as HTMLElement | null)?.dataset.offstage === '1' } catch { /* another origin's frame */ }
  window.addEventListener('message', (e) => {
    if (e.source !== window.parent || e.origin !== location.origin || typeof e.data?.offstage !== 'boolean') return
    if (e.data.offstage === offstage) return
    offstage = e.data.offstage
    offstageListeners.forEach((f) => f())
  })
}

/** True while the tab is in the background, or this is an embedded screen nobody can see. */
export const isHidden = () => (typeof document !== 'undefined' && document.hidden) || offstage

/** True while the tab is in the background (or, embedded, off stage); follows changes. */
export function useHidden(): boolean {
  const [hidden, setHidden] = useState(isHidden)
  useEffect(() => {
    const on = () => setHidden(isHidden())
    document.addEventListener('visibilitychange', on)
    offstageListeners.add(on)
    return () => { document.removeEventListener('visibilitychange', on); offstageListeners.delete(on) }
  }, [])
  return hidden
}
