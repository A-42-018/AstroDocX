import { useEffect, useRef } from 'react'

/** Heartbeats from the live ECG, so anything else on screen (the Health Twin's heart and pulse) beats in step with the trace. */
const bus = new EventTarget()
export const emitBeat = () => { bus.dispatchEvent(new Event('beat')) }

/**
 * Calls `onBeat` on every ECG beat. When the ECG is not drawing (scrolled away on a phone), it keeps the
 * same rhythm on its own from the heart rate, so the twin never freezes. Off when `enabled` is false.
 */
export function useHeartbeat(hr: number, enabled: boolean, onBeat: () => void) {
  const cb = useRef(onBeat)
  const rate = useRef(hr)
  useEffect(() => { cb.current = onBeat; rate.current = hr })
  useEffect(() => {
    if (!enabled) return
    let last = performance.now()
    const beat = () => { last = performance.now(); cb.current() }
    bus.addEventListener('beat', beat)
    const id = setInterval(() => {
      const period = 60_000 / Math.min(200, Math.max(30, rate.current))
      if (performance.now() - last > period * 1.25) beat()
    }, 50)
    return () => { bus.removeEventListener('beat', beat); clearInterval(id) }
  }, [enabled])
}
