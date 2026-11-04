import '../styles/pages/cabin.css'
import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useReducedMotion } from '../live/usePaused'
import type { CabinData } from './data'
import { statusColor, statusLabel } from './panels'
import { evaCrewId } from './eva'
import { createCabin, STOP_COUNT, type CabinScene, type IntroPhase } from './scene'
import { useCabinData } from './useCabinData'
import { VisorHud } from './VisorHud'
import { CabinLoader, loaderShownMs } from './CabinLoader'
import { useTour } from '../tour/store'
import * as sfx from '../audio/sfx'
import { SoundToggle } from '../audio/SoundToggle'
import { MusicToggle } from '../audio/MusicToggle'
import { disposeMusic } from '../audio/music'
import { introduce, startChatter, stopChatter } from '../audio/voice'

/** The arrival's phases and the visor, heard as well as seen. */
const INTRO_SOUND: Partial<Record<IntroPhase, () => void>> = { fly: sfx.flyRumble, lock: sfx.glare, clear: sfx.pressurise }

/** Caption for each tour stop, in scene order; names come from the live data. */
function stops(d: CabinData | null) {
  const name = (id?: string) => d?.crew.find((c) => c.id === id)?.name ?? 'the crew member'
  const focus = name(d?.focusId), n = d?.crew.length ?? 6
  const out = d ? evaCrewId(d) : null
  return [
    { title: 'Helmet view', text: `You are in the ${name(d?.selfId)}'s helmet at the back of the module. The visor HUD is wired to AstroDocX: your readiness, live vitals, the five hazard modules, the crew and the ground link. Scroll to float forward.` },
    { title: 'Crew overview', text: `${n} astronauts at work in microgravity. Every floating tag is live: name, heart rate and status from the same engine as the console.` },
    { title: 'Crew Status Board', text: `The real console on the wall, live: the ${name(d?.selfId)}'s Status Board with readiness, the body twin, vitals and the five hazard modules.` },
    { title: 'Live Vitals', text: `The console's live vitals for the ${focus}: ECG, SpO₂ and breathing, with their Next Action. This screen follows whoever needs attention most.` },
    { title: focus, text: 'The crew member behind the numbers. When they are off-nominal their tag pulses and a ring of light surrounds them, so the alert is visible in the room, not only on a screen.' },
    { title: 'Explainable Alerts', text: 'Each alert says WHY in the engine’s own words and the NEXT step from its action card. No black-box warnings.' },
    { title: 'Trends', text: `30 days of the ${focus}'s heart rate against their personal baseline band and the crew median.` },
    { title: 'Forward window', text: 'Earth below, through the forward window: the view the crew works under every day.' },
    { title: 'Look back', text: 'The whole module from the window: the crew, four console screens, one system.' },
    { title: 'Outside', text: `${out ? `The ${name(out)} on EVA beside the station, tethered to the ship. AstroDocX tracks every heartbeat out here too.` : 'The station beyond the window, Earth below.'} Press Esc or “Console” to return.` },
  ]
}

/** The arrival from space plays on the first visit to the cabin in a browser session; after that the tour starts in the helmet. */
const ARRIVED = 'adx-cabin-arrived'
const seenArrival = () => { try { return sessionStorage.getItem(ARRIVED) === '1' } catch { return false } }
/** Keep the loader up at least this long, so a warm cache does not flash it; then fade it over FADE_MS. */
const MIN_LOADER_MS = 1400, FADE_MS = 800

const markArrived = () => { try { sessionStorage.setItem(ARRIVED, '1') } catch { /* private mode: it just plays again */ } }

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
  const flash = useRef<HTMLDivElement>(null)
  const mist = useRef<HTMLDivElement>(null)
  const [intro, setIntro] = useState<IntroPhase>('off')
  const scene = useRef<CabinScene | null>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'unsupported'>(() => (webglAvailable() ? 'loading' : 'unsupported'))
  const [progress, setProgress] = useState(0)
  // 'show' while loading, 'fade' once the scene is ready (the arrival starts underneath), 'gone' after the fade
  const [loader, setLoader] = useState<'show' | 'fade' | 'gone'>('show')
  const [stop, setStop] = useState(0)
  const [picked, setPicked] = useState<string | null>(null)
  const dataRef = useRef(data)
  useEffect(() => { dataRef.current = data })
  const lastStop = useRef(-1)
  const visorWas = useRef<string>('raised')
  const leave = () => (location.key === 'default' ? navigate('/board') : navigate(-1))

  useEffect(() => {
    if (!canvas.current || state === 'unsupported') return
    let s: CabinScene
    try {
      s = createCabin(canvas.current, {
        // the arrival waits for the loading screen to lift (below), so it is not spent behind it
        reducedMotion: reduced, intro: false, visor: visor.current, flash: flash.current, mist: mist.current,
        onIntro: (ph) => {
          setIntro(ph); if (ph === 'clear') markArrived()
          INTRO_SOUND[ph]?.()
          sfx.humOutside(ph === 'fly' || ph === 'wait' || ph === 'lock' ? 1 : 0)
        },
        onStop: (i) => {
          // the first stop shown is the start, not a move
          if (lastStop.current >= 0 && i !== lastStop.current) sfx.whoosh()
          lastStop.current = i
          sfx.humOutside(i === STOP_COUNT - 1 ? 1 : 0)
          setStop(i)
        },
        onPick: (id) => {
          if (id) { sfx.select(); const c = dataRef.current?.crew.find((x) => x.id === id); if (c) introduce(c.role) }
          setPicked(id)
        },
        onVisor: (ph) => {
          if (ph === 'dropping') sfx.visorSeal()
          else if (ph === 'booting') sfx.hudBoot()
          else if (ph === 'raised' && visorWas.current !== 'raised') sfx.visorOpen()
          visorWas.current = ph
        }, onReady: () => setState('ready'), onProgress: setProgress,
      })
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

  // Lift the loading screen once the scene is ready (and has been up long enough not to flash), and start the
  // arrival under it on the first visit. Opened straight onto /cabin, the console's launch screen is still up:
  // the arrival then waits for that to go too.
  useEffect(() => {
    if (state !== 'ready' || loader !== 'show') return
    const lift = () => {
      setLoader('fade')
      if (!seenArrival()) scene.current?.replayIntro()
      else scene.current?.lowerVisor() // straight into the helmet: it goes on as the loading screen lifts
    }
    const wait = window.setTimeout(() => {
      if (document.getElementById('adx-splash')) window.addEventListener('adx:launched', lift, { once: true })
      else lift()
    }, reduced ? 0 : Math.max(0, MIN_LOADER_MS - loaderShownMs()))
    return () => { window.clearTimeout(wait); window.removeEventListener('adx:launched', lift) }
  }, [state, loader, reduced])
  // life support hums from the moment the loading screen lifts until the crew leaves the cabin
  const lifted = loader !== 'show'
  useEffect(() => {
    if (!lifted) return
    sfx.cabinHum(true)
    startChatter()
    return () => { sfx.cabinHum(false); stopChatter(); disposeMusic() }
  }, [lifted])
  useEffect(() => {
    if (loader !== 'fade') return
    const gone = window.setTimeout(() => setLoader('gone'), reduced ? 0 : FADE_MS)
    return () => window.clearTimeout(gone)
  }, [loader, reduced])
  // The 1-click tour steers the camera once the scene is loaded and the arrival is over.
  useEffect(() => {
    if (state === 'unsupported') { useTour.getState().set({ cabinFailed: true }); return }
    if (state !== 'ready' || loader !== 'gone' || intro !== 'off') return
    useTour.getState().set({ cabin: { goTo: (i) => scene.current?.goTo(i) } })
    return () => useTour.getState().set({ cabin: null })
  }, [state, loader, intro])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (picked) { setPicked(null); scene.current?.goTo(stop) } else leave()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const caps = stops(data)
  const who = picked ? data?.crew.find((c) => c.id === picked) : undefined

  return (
    <div className={intro === 'off' ? 'cabin' : 'cabin is-arriving'}>
      <canvas ref={canvas} className="cabin-gl" role="img" aria-label="3D crew module. Scroll, use the arrow keys or the stop list to move through the tour." />

      <div ref={mist} className="cabin-mist" aria-hidden="true" />
      <div ref={visor} className="cabin-visor" aria-hidden="true">
        <VisorHud data={data} reduced={reduced} />
      </div>
      <div ref={flash} className="cabin-flash" aria-hidden="true" />
      {(intro === 'fly' || intro === 'wait') && (
        <div className="cabin-arrive">
          <span className="ca-status" role="status">{intro === 'wait' && state !== 'ready' ? 'Pressurising cabin…' : 'Approaching the station'}</span>
          <button type="button" className="ca-skip" onClick={() => scene.current?.skipIntro()}>Skip ›</button>
        </div>
      )}

      <header className="cabin-top">
        <button type="button" className="cabin-back" onClick={leave}>← Console</button>
        <div className="cabin-brand">AstroDocX <span>· 3D Cabin</span></div>
        <MusicToggle className="cabin-sound" />
        <SoundToggle className="cabin-sound" />
        <button type="button" className="cabin-replay" onClick={() => scene.current?.replayIntro()}>↺ Replay arrival</button>
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
        Module: “<a href="https://sketchfab.com/3d-models/space-ship-interior-08f117102f2f4e48ab583b7ae22db1c1" target="_blank" rel="noopener noreferrer">Space Ship Interior</a>” by Ryley Burnett · Astronaut: “<a href="https://sketchfab.com/3d-models/e2c4b146e58141e4b87917456a9970b1" target="_blank" rel="noopener noreferrer">Animated Floating Astronaut</a>” by LasquetiSpice · Station: “<a href="https://sketchfab.com/3d-models/813f5b296e584c26bf386ca39de6c3d4" target="_blank" rel="noopener noreferrer">ISS</a>” by uperesito · Consoles: “<a href="https://sketchfab.com/3d-models/sci-fi-computer-desk-console-28c67457f2ef4973a0bbc8b667bb183f" target="_blank" rel="noopener noreferrer">Sci-Fi Computer Desk Console</a>” and “<a href="https://sketchfab.com/3d-models/large-wall-mounted-computer-console-298b7d9b68064618a3819d1a8fae4baf" target="_blank" rel="noopener noreferrer">Large Wall-Mounted Computer Console</a>” by Inditrion Dradnon, “<a href="https://sketchfab.com/3d-models/sci-fi-supercomputer-9464e880c35e4fd29c0cdb6fefe5ebba" target="_blank" rel="noopener noreferrer">Sci-fi Supercomputer</a>” by Jungle Jim · Robots: “<a href="https://sketchfab.com/3d-models/tars-interstellar-improved-4648e3edb8cd4b35af57868da5fcb62c" target="_blank" rel="noopener noreferrer">TARS Interstellar (Improved)</a>” by THAD · all CC BY 4.0 · Surfaces: <a href="https://ambientcg.com" target="_blank" rel="noopener noreferrer">ambientCG</a>, CC0 · Earth: <a href="https://visibleearth.nasa.gov" target="_blank" rel="noopener noreferrer">NASA Visible Earth</a> and “<a href="https://sketchfab.com/3d-models/earth-63d902b12fd14868b4dc2f19dc21d7c2" target="_blank" rel="noopener noreferrer">Earth</a>” by kongle, CC BY-SA 4.0
      </footer>

      {state !== 'unsupported' && loader !== 'gone' && (
        <CabinLoader progress={0.15 + 0.85 * progress} leaving={loader === 'fade'} reduced={reduced} onBack={leave} />
      )}
      {state === 'unsupported' && (
        <div className="cabin-loading" role="status">
          <div className="cabin-panel cabin-nogl">
            <h1>3D mode needs WebGL</h1>
            <p>This browser or device cannot draw the 3D cabin. Everything it shows is on the console screens.</p>
            <button type="button" className="cabin-back" onClick={leave}>← Back to the console</button>
          </div>
        </div>
      )}
    </div>
  )
}
