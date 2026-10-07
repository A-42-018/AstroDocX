import { useEffect, useRef, useState } from 'react'
import { useReducedMotion } from './usePaused'

/** A number that glides to its new value instead of jumping (critically damped, about 0.4 s). Shows the exact value when motion is reduced. */
export function LiveNumber({ value, decimals = 0 }: { value: number; decimals?: number }) {
  const reduced = useReducedMotion()
  const [shown, setShown] = useState(value)
  const cur = useRef(value)

  useEffect(() => {
    if (reduced) { cur.current = value; return }
    let raf = 0
    let last = performance.now()
    const eps = 0.5 * 10 ** -decimals
    const step = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.1)
      last = now
      cur.current += (value - cur.current) * (1 - Math.exp(-dt * 9))
      if (Math.abs(value - cur.current) < eps / 4) { cur.current = value; setShown(value); return }
      setShown(cur.current)
      raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [value, decimals, reduced])

  return <span className="live-num">{(reduced ? value : shown).toFixed(decimals)}</span>
}
