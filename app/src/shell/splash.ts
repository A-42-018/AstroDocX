import { useEffect } from 'react'
import { useBoard } from '../board/store'

/** The launch screen in index.html (driven by public/splash.js). Absent in tests and after it has closed. */
type Splash = { mark: (step: 'systems' | 'data') => void; seed: (fraction: number) => void; ready: () => void }
const splash = () => (window as Window & { adxSplash?: Splash }).adxSplash

/** The bundle has loaded and is about to render. */
export function markSystemsLoaded() { splash()?.mark('systems') }

/** Report demo seeding to the launch screen, and let it go once the board has painted its first frame. */
export function useSplashHandoff() {
  const boot = useBoard((s) => s.boot)
  useEffect(() => {
    const s = splash()
    if (!s) return
    if (boot.state === 'seeding' && boot.total) s.seed(boot.done / boot.total)
    if (boot.state !== 'ready' && boot.state !== 'error') return
    s.mark('data')
    // two frames: React has committed the board and the browser has painted it
    let id = requestAnimationFrame(() => { id = requestAnimationFrame(() => s.ready()) })
    return () => cancelAnimationFrame(id)
  }, [boot])
}
