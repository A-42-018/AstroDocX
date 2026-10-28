import { useEffect, useRef, useState } from 'react'
import { met } from '../engine/actions'
import { useReducedMotion } from '../live/usePaused'

/** Mission clock that runs up to the new time when the simulator moves it (about 0.9 s), so a jump of days reads as travel, not a glitch. */
export function MissionClock({ now }: { now: number }) {
  const reduced = useReducedMotion()
  const [shown, setShown] = useState(now)
  const cur = useRef(now)
  useEffect(() => {
    if (reduced || cur.current === now) { cur.current = now; return }
    const from = cur.current
    const start = performance.now()
    let raf = 0
    const step = (t: number) => {
      const p = Math.min(1, (t - start) / 900)
      const eased = 1 - (1 - p) ** 3
      cur.current = p >= 1 ? now : from + (now - from) * eased
      setShown(cur.current)
      if (p < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [now, reduced])
  const [day, unit] = met(reduced ? now : shown).split(/ (?=MET$)/)
  return <p className="sm-mclock" aria-label="Mission elapsed time"><span className="sm-mclock-v">{day}</span> <span className="sm-mclock-u">{unit}</span></p>
}
