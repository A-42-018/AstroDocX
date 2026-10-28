import '../styles/pages/cabin.css'
import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useReducedMotion } from '../live/usePaused'
import type { CabinData } from './data'
import { statusColor, statusLabel } from './panels'
import { createCabin, STOP_COUNT, type CabinScene } from './scene'
import { useCabinData } from './useCabinData'

/** Caption for each tour stop, in scene order; names come from the live data. */
function stops(d: CabinData | null) {
  const name = (id?: string) => d?.crew.find((c) => c.id === id)?.name ?? 'the crew member'
  const focus = name(d?.focusId), n = d?.crew.length ?? 6
  return [
    { title: 'Helmet view', text: `You are in the ${name(d?.selfId)}'s helmet at the back of the module. The visor HUD is wired to AstroDocX: your heart rate and the crew link. Scroll to float forward.` },
    { title: 'Crew overview', text: `${n} astronauts at work in microgravity. Every floating tag is live: name, heart rate and status from the same engine as the console.` },
    { title: 'Crew Status Board', text: 'Every crew member at a glance with live heart rate, SpO₂ and breathing. Amber and red cards are off-nominal.' },
    { title: 'Live Vitals', text: `The ${focus}'s live ECG, SpO₂, breathing and cabin CO₂. This panel follows whoever needs attention most.` },
    { title: focus, text: 'The crew member behind the numbers. When they are off-nominal their tag pulses and a ring of light surrounds them, so the alert is visible in the room, not only on a screen.' },
    { title: 'Explainable Alerts', text: 'Each alert says WHY in the engine’s own words and the NEXT step from its action card. No black-box warnings.' },
    { title: 'Trends', text: `30 days of the ${focus}'s heart rate against their personal baseline band and the crew median.` },
    { title: 'Forward window', text: 'Earth below, through the forward window: the view the crew works under every day.' },
    { title: 'Look back', text: 'The whole module from the window: the crew, four health panels, one system. Press Esc or “Console” to return.' },
  ]
}

/** Can this browser draw WebGL at all? Checked once, before the scene is built. */
function webglAvailable() {
  try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') ?? c.getContext('webgl')) } catch { return false }
}

/**
 * 3D mode: a walk-through of the crew module with the console's live data on in-cabin panels. Full screen,
 * outside the console frame; the scene (three.js) loads with this chunk only. Without WebGL it says so and
 * offers the way back.
 */
export default function CabinPage() {
  const data = useCabinData()
  const reduced = useReducedMotion()
  const navigate = useNavigate()
  const location = useLocation()
  const canvas = useRef<HTMLCanvasElement>(null)
  const visor = useRef<HTMLDivElement>(null)
  const scene = useRef<CabinScene | null>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'unsupported'>(() => (webglAvailable() ? 'loading' : 'unsupported'))
  const [stop, setStop] = useState(0)
  const [picked, setPicked] = useState<string | null>(null)
  const leave = () => (location.key === 'default' ? navigate('/board') : navigate(-1))

  useEffect(() => {
    if (!canvas.current || state === 'unsupported') return
    let s: CabinScene
    try {
      s = createCabin(canvas.current, { reducedMotion: reduced, visor: visor.current, onStop: setStop, onPick: setPicked, onReady: () => setState('ready') })
    } catch (err) {
      console.warn('cabin: no WebGL context', err)
      void Promise.resolve().then(() => setState('unsupported')) // the context can still fail after the check
      return
    }
    scene.current = s
    return () => { s.dispose(); scene.current = null }
    // `state` only matters for the first run; a ready scene is not rebuilt when it loads.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduced])

  useEffect(() => { if (data) scene.current?.update(data) }, [data, state])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (picked) { setPicked(null); scene.current?.goTo(stop) } else leave()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const caps = stops(data)
  const self = data?.crew.find((c) => c.id === data.selfId)
  const off = data?.crew.filter((c) => c.status !== 'nominal').length ?? 0
  const who = picked ? data?.crew.find((c) => c.id === picked) : undefined

  return (
    <div className="cabin">
      <canvas ref={canvas} className="cabin-gl" role="img" aria-label="3D crew module. Scroll, use the arrow keys or the stop list to move through the tour." />

      <div ref={visor} className="cabin-visor" aria-hidden="true">
        <div className="visor-shade" /><div className="visor-rim" /><div className="visor-glare" />
        <div className="vhud tl"><b>EMU HELMET CAM</b><span>{self?.name.toUpperCase() ?? 'CREW'} · LINKED TO ASTRODOCX</span></div>
        <div className="vhud tr"><b>CABIN</b><span>CO₂ {self ? self.live.co2.toFixed(1) : '–'} mmHg</span></div>
        <div className="vhud bl"><b>SUIT</b><span>♥ {self ? self.live.hr.toFixed(0) : '–'} bpm · SpO₂ {self ? self.live.spo2.toFixed(0) : '–'}%</span></div>
        <div className="vhud br"><b>CREW LINK</b><span><i className="ok">●</i> {data?.crew.length ?? 0} ONLINE · <i className={off ? 'watch' : 'ok'}>●</i> {off} OFF-NOMINAL</span></div>
        <div className="reticle" />
        <div className="prompt">Scroll to explore <span>↓</span></div>
      </div>

      <header className="cabin-top">
        <button type="button" className="cabin-back" onClick={leave}>← Console</button>
        <div className="cabin-brand">AstroDocX <span>· 3D Cabin</span></div>
      </header>

      <nav className="cabin-stops" aria-label="Tour stops">
        {caps.map((c, i) => (
          <button key={i} type="button" aria-current={i === stop ? 'step' : undefined} onClick={() => scene.current?.goTo(i)}>
            <span>{c.title}</span><i aria-hidden="true" />
          </button>
        ))}
      </nav>

      <section className="cabin-caption cabin-panel" aria-live="polite">
        <div className="cap-step">{String(stop + 1).padStart(2, '0')} / {String(STOP_COUNT).padStart(2, '0')}</div>
        <h1>{caps[stop]?.title}</h1>
        <p>{caps[stop]?.text}</p>
      </section>

      {who && (
        <section className="cabin-card cabin-panel" aria-label={`${who.name} vitals`}>
          <button type="button" className="close" aria-label="Close" onClick={() => { setPicked(null); scene.current?.goTo(stop) }}>×</button>
          <div className="cc-role">{who.role}</div>
          <h2>{who.name}</h2>
          <div className="cc-grid">
            <div><span>HEART</span><b>{who.live.hr.toFixed(0)} bpm</b></div>
            <div><span>SpO₂</span><b>{who.live.spo2.toFixed(0)}%</b></div>
            <div><span>RESP</span><b>{who.live.resp.toFixed(0)}/min</b></div>
            <div><span>ALERTS</span><b>{who.alerts}</b></div>
          </div>
          <div className="cc-status" style={{ color: statusColor(who.status) }}>● {statusLabel(who.status)}</div>
        </section>
      )}

      <footer className="cabin-credits">
        Module: “<a href="https://sketchfab.com/3d-models/space-ship-interior-08f117102f2f4e48ab583b7ae22db1c1" target="_blank" rel="noopener noreferrer">Space Ship Interior</a>” by Ryley Burnett, CC BY 4.0 · Astronaut: NASA 3D Resources
      </footer>

      {state !== 'ready' && (
        <div className="cabin-loading" role="status">
          {state === 'loading' ? 'Pressurising cabin…' : (
            <div className="cabin-panel cabin-nogl">
              <h1>3D mode needs WebGL</h1>
              <p>This browser or device cannot draw the 3D cabin. Everything it shows is on the console screens.</p>
              <button type="button" className="cabin-back" onClick={leave}>← Back to the console</button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
