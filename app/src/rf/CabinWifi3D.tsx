import '../styles/pages/cabin.css'
import { useEffect, useRef, useState } from 'react'
import { useReducedMotion } from '../live/usePaused'
import { createCabin, type CabinScene } from '../cabin/scene'
import { useCabinData } from '../cabin/useCabinData'

function webglAvailable() {
  try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') ?? c.getContext('webgl')) } catch { return false }
}

/**
 * The 3D cabin in Wi-Fi sensing view, inside the console: the same scene as the 3D Cabin page, started at the crew overview with the
 * Wi-Fi view on, taking no input (the page keeps its scroll) and drawing only while it is on screen. It loads with this chunk
 * (three.js and the cabin models), and the page mounts it only once it scrolls into view.
 */
export default function CabinWifi3D({ onUnsupported }: { onUnsupported?: () => void }) {
  const data = useCabinData()
  const reduced = useReducedMotion()
  const canvas = useRef<HTMLCanvasElement>(null)
  const box = useRef<HTMLDivElement>(null)
  const scene = useRef<CabinScene | null>(null)
  const onScreen = useRef(true)
  const [state, setState] = useState<'loading' | 'ready' | 'unsupported'>(() => (webglAvailable() ? 'loading' : 'unsupported'))
  const [progress, setProgress] = useState(0)

  useEffect(() => { if (state === 'unsupported') onUnsupported?.() }, [state, onUnsupported])

  // draw only while the panel is in view
  useEffect(() => {
    const el = box.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver((e) => { onScreen.current = e[0]?.isIntersecting ?? true })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  useEffect(() => {
    if (!canvas.current || state === 'unsupported') return
    let s: CabinScene | undefined
    try {
      s = createCabin(canvas.current, {
        reducedMotion: reduced, intro: false, visor: null, flash: null, mist: null, wifiOnly: true,
        isPaused: () => !onScreen.current || document.hidden,
        onIntro: () => {}, onStop: () => {}, onPick: () => {},
        onReady: () => { s?.setWifi(true); setState('ready') },
        onProgress: setProgress,
      })
    } catch (err) {
      console.warn('wifi view: no WebGL context', err)
      void Promise.resolve().then(() => setState('unsupported'))
      return
    }
    scene.current = s
    return () => { s?.dispose(); scene.current = null }
    // the scene is built once; `state` only matters for the first run
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduced])

  useEffect(() => { if (data) scene.current?.update(data) }, [data, state])

  if (state === 'unsupported') return <p className="rf-3d-none" role="status">This browser cannot draw the 3D cabin, so the plan view is shown instead.</p>
  return (
    <div ref={box} className="rf-3d">
      <canvas ref={canvas} className="rf-3d-cv" role="img" aria-label="The 3D cabin as Wi-Fi sensing would show it: the cabin as a dot cloud, the crew as heat shapes with their breathing rates. Simulated." />
      {state === 'loading' && <div className="rf-3d-load" role="status">Loading the cabin… {Math.round(15 + 85 * progress)}%</div>}
    </div>
  )
}
