import '../styles/pages/cabin.css'
import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useReducedMotion } from '../live/usePaused'
import type { CabinData } from './data'
import { statusColor, statusLabel } from './panels'
import { evaCrewId } from './eva'
import { createCabin, STOP_COUNT, type CabinScene, type IntroPhase } from './scene'
import { useCabinData } from './useCabinData'
import { FloatHint, FloatPad } from './FloatPad'
import { VisorHud } from './VisorHud'
import { CabinLoader, loaderShownMs } from './CabinLoader'
import { useTour } from '../tour/store'
import * as sfx from '../audio/sfx'
import { SoundToggle } from '../audio/SoundToggle'
import { disposeMusic } from '../audio/music'
import { introduce, setCrewStatus, startChatter, stopChatter, useVitaVoice, vitaCanSpeak, vitaSay } from '../audio/voice'
import { actAlert, cabinBrief, cabinHello, crewNote } from '../doctor/brief'
import { useDoctorBrief, useDoctorReport } from '../doctor/useDoctorReport'

/** The arrival's phases and the visor, heard as well as seen. */
// the arrival: the flight in with a puff of thrusters, the glare as it locks, then the dock clanks shut and the cabin pressurises
const INTRO_SOUND: Partial<Record<IntroPhase, () => void>> = {
  fly: () => { sfx.flyRumble(); window.setTimeout(sfx.thrusterPuff, 2200) },
  lock: sfx.glare,
  clear: () => { sfx.dockingClank(); sfx.pressurise() },
}

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

/**
 * What VITA says at each tour stop: the same ten stops as stops(), in short spoken sentences with numbers in words.
 * Names come from the live data, as in the captions.
 */
function spokenStops(d: CabinData | null) {
  const name = (id?: string) => d?.crew.find((c) => c.id === id)?.name ?? 'crew member'
  const focus = name(d?.focusId)
  const out = d ? evaCrewId(d) : null
  const n = d?.crew.length ?? 6
  const words = ['Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten']
  return [
    `This is the view from the ${name(d?.selfId)}’s helmet. The visor display is wired to Astro Doc X. It shows readiness, live vitals, the five hazard modules, the crew and the ground link. Scroll, and you float forward.`,
    `${words[n] ?? n} astronauts at work in microgravity. Every floating tag is live. Name, heart rate and status, from the same engine as the console.`,
    `The real console, on the wall. This is the ${name(d?.selfId)}’s Status Board, with readiness, the body twin, vitals and the five hazard modules.`,
    `Live vitals for the ${focus}. Heart trace, oxygen and breathing, with their next action. This screen follows whoever needs attention most.`,
    `And here is the ${focus}, the person behind the numbers. When someone is off nominal, their tag pulses and a ring of light surrounds them. You can see the alert in the room, not only on a screen.`,
    'Explainable alerts. Each one says why, in the engine’s own words, and gives the next step. No black box warnings.',
    `Trends. Thirty days of the ${focus}’s heart rate, against their personal baseline band and the crew median.`,
    'Earth, through the forward window. The view the crew works under every day.',
    'The whole module, looking back from the window. The crew, four console screens, one system.',
    out ? `Outside. The ${name(out)} is on a spacewalk, tethered to the ship. Astro Doc X tracks every heartbeat out here too. Press Escape when you want to go back to the console.` : 'Outside, the station, and Earth below. Press Escape when you want to go back to the console.',
  ]
}

/** The tour stop that shows each wall screen, to the screen's index (scene.ts). */
const SCREEN_OF_STOP: Record<number, number> = { 2: 0, 3: 1, 5: 2, 6: 3 }

/** Named stops for /cabin?shot=… */
const SHOTS: Record<string, number> = { helmet: 0, crew: 1, board: 2, vitals: 3, alerts: 5, trends: 6, window: 7, eva: 9, outside: 9 }

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

/** VITA greets you in the cabin once per visit (the tab's session). */
const HELLO_KEY = 'adx-vita-cabin-hello'
const hasGreeted = () => { try { return sessionStorage.getItem(HELLO_KEY) === '1' } catch { return false } }
const markGreeted = () => { try { sessionStorage.setItem(HELLO_KEY, '1') } catch { /* private mode: she may greet again */ } }

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
  const root = useRef<HTMLDivElement>(null)
  const captionEl = useRef<HTMLElement>(null)
  /** On a phone the caption shows three lines; "More" opens the rest. Closed again at each stop. */
  const [capOpen, setCapOpen] = useState(false)
  /** Whether the caption's text is cut short, so "More" has something to open. */
  const [capClamped, setCapClamped] = useState(false)
  const [intro, setIntro] = useState<IntroPhase>('off')
  const scene = useRef<CabinScene | null>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'unsupported'>(() => (webglAvailable() ? 'loading' : 'unsupported'))
  const [progress, setProgress] = useState(0)
  // 'show' while loading, 'fade' once the scene is ready (the arrival starts underneath), 'gone' after the fade
  const [loader, setLoader] = useState<'show' | 'fade' | 'gone'>('show')
  const [stop, setStop] = useState(0)
  const [picked, setPicked] = useState<string | null>(null)
  /** Float mode: drifting freely through the hall instead of following the tour. */
  const [floating, setFloating] = useState(false)
  const [wifi, setWifi] = useState(false)
  const [creditsOpen, setCreditsOpen] = useState(false)
  /** A wall screen stepped up to: which, and the console page it is showing (the frame reports it). */
  const [screen, setScreen] = useState<{ i: number; path: string; label: string } | null>(null)
  const screenWas = useRef<string | null>(null)
  const touch = typeof window !== 'undefined' && !!window.matchMedia?.('(pointer: coarse)').matches
  const dataRef = useRef(data)
  useEffect(() => { dataRef.current = data })
  // VITA, the crew doctor, is the robot on the floor: she speaks the crew exam (doctor/analyze.ts) in the cabin
  const report = useDoctorReport('all')
  const reportRef = useRef(report)
  useEffect(() => { reportRef.current = report })
  const vitaSpeaking = useVitaVoice((s) => s.speaking)
  const vitaLine = useVitaVoice((s) => s.line)
  /** What she says when she cannot be heard (Sound off, or no click yet): shown as the subtitle for a while instead. */
  const [caption, setCaption] = useState('')
  const captionTimer = useRef(0)
  const lastStop = useRef(-1)
  const visorWas = useRef<string>('raised')
  /**
   * Back to where the crew came from, in one press. `location.key === 'default'` is only true for the very first entry, so
   * an entry that was replaced (the tour, a redirect) used to send "back" to an earlier page, or nowhere. React Router
   * keeps the entry's place in `history.state.idx`: at 0 there is nothing in the app to go back to, so go to the board. If
   * going back lands on another cabin entry (or does not leave at all), the board is the answer after a beat.
   */
  const leave = () => {
    const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0
    if (idx <= 0) { navigate('/board', { replace: true }); return }
    navigate(-1)
    window.setTimeout(() => { if (document.querySelector('.cabin-back')) navigate('/board', { replace: true }) }, 400)
  }

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
          const prevStop = lastStop.current
          if (prevStop >= 0 && i !== prevStop) sfx.whoosh()
          lastStop.current = i
          // the last stop is outside the station: through the airlock, and a few boot steps on the hull
          if (prevStop >= 0 && (i === STOP_COUNT - 1) !== (prevStop === STOP_COUNT - 1)) { sfx.airlock(); if (i === STOP_COUNT - 1) window.setTimeout(sfx.evaSteps, 3000) }
          sfx.humOutside(i === STOP_COUNT - 1 ? 1 : 0)
          setStop(i)
        },
        onPick: (id) => {
          if (id) {
            sfx.select()
            const c = dataRef.current?.crew.find((x) => x.id === id)
            // the crew member says hello, then VITA adds her medical note on them
            if (c) introduce(c.role, () => { const r = reportRef.current; if (r && useTour.getState().phase !== 'running') sayVita(crewNote(r, id)) })
          }
          setPicked(id)
        },
        onPickVita: () => { sfx.select(); sayVita(vitaBrief()) },
        onVisor: (ph) => {
          if (ph === 'dropping') sfx.visorSeal()
          else if (ph === 'booting') sfx.hudBoot()
          else if (ph === 'raised' && visorWas.current !== 'raised') sfx.visorOpen()
          visorWas.current = ph
        },
        onFloat: (on) => {
          setFloating(on)
          // exploring on your own pauses a running guided tour (and VITA with it)
          if (on && useTour.getState().phase === 'running') useTour.getState().set({ paused: true })
        },
        onScreen: (i) => {
          if (i === null) { setScreen(null); screenWas.current = null; return }
          sfx.select(); sfx.hologramOn()
          setScreen((cur) => cur?.i === i ? cur : { i, path: '', label: '' })
          // using a screen pauses a running guided tour (and VITA with it), as exploring does
          if (useTour.getState().phase === 'running') useTour.getState().set({ paused: true })
        },
        onScreenPage: (i, path, label) => {
          if (screenWas.current !== null && screenWas.current !== path) sfx.navTick()
          screenWas.current = path
          setScreen((cur) => cur && cur.i === i ? { ...cur, path, label } : cur)
        },
        onReady: () => setState('ready'), onProgress: setProgress,
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
  useEffect(() => { setCapOpen(false) }, [stop])
  // how far up from the bottom the caption card reaches (--cap-top): the visor's lower HUD and VITA's subtitle sit above it, never under it
  useEffect(() => {
    const el = captionEl.current, host = root.current
    if (!el || !host || typeof ResizeObserver === 'undefined') return
    const put = () => {
      const r = el.getBoundingClientRect(), p = el.querySelector('p')
      host.style.setProperty('--cap-top', `${r.height ? Math.round(host.clientHeight - r.top) : 0}px`)
      if (p && !el.classList.contains('is-open')) setCapClamped(p.scrollHeight > p.clientHeight + 1)
    }
    const ro = new ResizeObserver(put); ro.observe(el); ro.observe(host); put()
    const mo = new MutationObserver(put); mo.observe(el, { childList: true, subtree: true, characterData: true }) // a new stop's text, same card size
    return () => { ro.disconnect(); mo.disconnect() }
  }, [])
  // her robot pulses its face and stops to face you whenever VITA speaks: the brief, the dock's answers, the tour
  useEffect(() => { scene.current?.vitaTalk(vitaSpeaking) }, [vitaSpeaking, state])
  useEffect(() => () => window.clearTimeout(captionTimer.current), [])
  // what she answers when the commander asks her over the radio
  useEffect(() => { setCrewStatus(() => reportRef.current?.headline ?? 'All crew are within their baselines, Commander.') }, [])
  // once per visit, after the arrival: who she is and the one line that matters (only if she can be heard)
  const settled = state === 'ready' && loader === 'gone' && intro === 'off'
  useEffect(() => {
    if (!settled || !report || hasGreeted()) return
    const hello = window.setTimeout(() => {
      if (useTour.getState().phase === 'running' || useVitaVoice.getState().speaking || !vitaCanSpeak()) return
      markGreeted(); void vitaSay(cabinHello(report))
    }, reduced ? 600 : 2600)
    return () => window.clearTimeout(hello)
  }, [settled, report, reduced])
  // a finding reaching ACT while you are here: she says so once
  const acts = useRef<Set<string> | null>(null)
  useEffect(() => {
    if (!report) return
    const now = new Set(report.findings.filter((f) => f.status === 'act').map((f) => f.id))
    const fresh = acts.current ? [...now].filter((id) => !acts.current!.has(id)) : []
    acts.current = now
    if (fresh.length && settled && useTour.getState().phase !== 'running') sayVita(actAlert(report, fresh[0]))
  }, [report, settled])

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
    useTour.getState().set({ cabin: { goTo: (i) => scene.current?.goTo(i), arrived: (i) => scene.current?.arrived(i) ?? true, spoken: (i) => spokenStops(dataRef.current)[i] ?? '', step: (d) => scene.current?.goTo(Math.max(0, Math.min(STOP_COUNT - 1, lastStop.current + d))) } })
    return () => useTour.getState().set({ cabin: null })
  }, [state, loader, intro])
  // /cabin?shot=eva (from VITA's answers) opens on that stop once the arrival is over
  const shot = new URLSearchParams(location.search).get('shot')
  useEffect(() => {
    const at = shot ? SHOTS[shot.toLowerCase()] : undefined
    if (at === undefined || state !== 'ready' || loader !== 'gone' || intro !== 'off') return
    scene.current?.goTo(at)
  }, [shot, state, loader, intro])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (creditsOpen) { setCreditsOpen(false); return }
      if (screen) { scene.current?.leaveScreen(); return }
      if (picked) { setPicked(null); scene.current?.goTo(stop) }
      else if (floating) scene.current?.setFloat(false)
      else leave()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const caps = stops(data)
  const stepIn = SCREEN_OF_STOP[stop]
  /** The console page that matches what a screen shows, for "Open in console" (Live Vitals is a cabin-only page: the board has the vitals). */
  const consolePath = screen?.path && screen.path !== '/vitals' ? screen.path : '/board'
  const who = picked ? data?.crew.find((c) => c.id === picked) : undefined
  const subtitle = vitaSpeaking && vitaLine ? vitaLine : caption

  /** VITA speaks; when she cannot be heard, her words show as the subtitle instead. */
  function sayVita(text: string) {
    if (!text) return
    window.clearTimeout(captionTimer.current)
    if (vitaCanSpeak()) { setCaption(''); void vitaSay(text); return }
    setCaption(text.replace(/<[^>]*>/g, ''))
    captionTimer.current = window.setTimeout(() => setCaption(''), Math.min(16_000, 3500 + text.length * 55))
  }
  /** Her brief: the live wording from the Crew Doctor screen if it is about the same report, else the offline one. */
  function vitaBrief() {
    const r = reportRef.current
    if (!r) return 'I am VITA, the crew doctor. I am still reading the crew data.'
    const live = useDoctorBrief.getState()
    return live.text && live.headline === r.headline ? `${live.text.replace(/<[^>]*>/g, '')} The full consultation is on the Crew Doctor screen.` : cabinBrief(r)
  }

  return (
    <div ref={root} className={`${intro === 'off' ? 'cabin' : 'cabin is-arriving'}${floating ? ' is-floating' : ''}${screen ? ' is-using' : ''}${wifi ? ' is-wifi' : ''}`}>
      <canvas ref={canvas} className="cabin-gl" role="img" aria-label="3D crew module. Scroll, use the arrow keys or the stop list to move through the tour. Press Enter at a wall screen to use it." />

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
        <SoundToggle className="cabin-sound" music />
        <button type="button" className="cabin-explore" aria-pressed={floating} aria-keyshortcuts="F" disabled={state !== 'ready' || intro !== 'off' || !!screen}
          onClick={() => scene.current?.setFloat(!floating)} title={floating ? 'Fly back to the tour (F or Esc)' : 'Drift freely through the module (F)'}>
          {floating ? '↩ Back to tour' : '✥ Explore'}
        </button>
        <button type="button" className="cabin-explore cabin-wifi" aria-pressed={wifi} disabled={state !== 'ready' || intro !== 'off' || !!screen}
          onClick={() => { const on = !wifi; setWifi(on); scene.current?.setWifi(on); if (on && stop === 0) scene.current?.goTo(1) }}
          title={wifi ? 'Back to the normal view' : 'See the cabin as Wi-Fi sensing would (simulated)'}>
          {wifi ? '↩ Normal view' : '📡 Wi-Fi view'}
        </button>
        <button type="button" className="cabin-replay" onClick={() => { if (wifi) { setWifi(false); scene.current?.setWifi(false) } scene.current?.replayIntro() }}>↺ Replay arrival</button>
      </header>

      {screen && (
        <div className="cabin-use cabin-panel" role="group" aria-label="Using a wall screen">
          <button type="button" className="cu-back" onClick={() => scene.current?.leaveScreen()} aria-keyshortcuts="Escape">← <span className="cu-long">Step </span>back <kbd>Esc</kbd></button>
          <span className="cu-title" aria-live="polite">{screen.label || 'Screen'}</span>
          <button type="button" className="cu-open" onClick={() => navigate(consolePath)}><span className="cu-long">Open in </span>console ↗</button>
        </div>
      )}

      <nav className="cabin-stops" aria-label="Tour stops" hidden={!!screen}>
        {caps.map((c, i) => (
          <button key={i} type="button" aria-current={i === stop ? 'step' : undefined} onClick={() => scene.current?.goTo(i)}>
            <span>{c.title}</span><i aria-hidden="true" />
          </button>
        ))}
      </nav>

      {floating && !screen && <FloatHint touch={touch} />}
      {floating && !screen && touch && <FloatPad onMove={(x, y, v) => scene.current?.move(x, y, v)} />}

      <section ref={captionEl} className={`cabin-caption cabin-panel${capOpen ? ' is-open' : ''}`} aria-live="polite" hidden={!!screen}>
        <div className="cap-step">{String(stop + 1).padStart(2, '0')} / {String(STOP_COUNT).padStart(2, '0')}</div>
        <h1>{caps[stop]?.title}</h1>
        <p id="cabin-cap-text">{caps[stop]?.text}</p>
        {(capClamped || capOpen) && <button type="button" className="cap-more" aria-expanded={capOpen} aria-controls="cabin-cap-text" onClick={() => setCapOpen((o) => !o)}>{capOpen ? 'Less' : 'More'}</button>}
        {stepIn !== undefined && !floating && state === 'ready' && intro === 'off' && (
          <button type="button" className="cap-use" onClick={() => scene.current?.stepUp(stepIn)} aria-keyshortcuts="Enter">Use this screen ▸ <kbd>Enter</kbd></button>
        )}
      </section>

      {subtitle && (
        <p className="cabin-vita-sub" aria-live={vitaSpeaking ? 'off' : 'polite'}><b>VITA</b><span>{subtitle}</span></p>
      )}

      {who && !screen && (
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
        <button type="button" className="cabin-credits-btn" aria-expanded={creditsOpen} aria-controls="cabin-credits-list" onClick={() => setCreditsOpen((o) => !o)}>
          Credits
        </button>
        <p id="cabin-credits-list" className="cabin-panel cabin-credits-list" hidden={!creditsOpen}>
        Module: “<a href="https://sketchfab.com/3d-models/space-ship-interior-08f117102f2f4e48ab583b7ae22db1c1" target="_blank" rel="noopener noreferrer">Space Ship Interior</a>” by Ryley Burnett · Astronaut: “<a href="https://sketchfab.com/3d-models/e2c4b146e58141e4b87917456a9970b1" target="_blank" rel="noopener noreferrer">Animated Floating Astronaut</a>” by LasquetiSpice · Station: “<a href="https://sketchfab.com/3d-models/813f5b296e584c26bf386ca39de6c3d4" target="_blank" rel="noopener noreferrer">ISS</a>” by uperesito · Consoles: “<a href="https://sketchfab.com/3d-models/sci-fi-computer-desk-console-28c67457f2ef4973a0bbc8b667bb183f" target="_blank" rel="noopener noreferrer">Sci-Fi Computer Desk Console</a>” and “<a href="https://sketchfab.com/3d-models/large-wall-mounted-computer-console-298b7d9b68064618a3819d1a8fae4baf" target="_blank" rel="noopener noreferrer">Large Wall-Mounted Computer Console</a>” by Inditrion Dradnon, “<a href="https://sketchfab.com/3d-models/sci-fi-supercomputer-9464e880c35e4fd29c0cdb6fefe5ebba" target="_blank" rel="noopener noreferrer">Sci-fi Supercomputer</a>” by Jungle Jim · Robots (VITA and MEDI): “<a href="https://sketchfab.com/3d-models/tars-interstellar-improved-4648e3edb8cd4b35af57868da5fcb62c" target="_blank" rel="noopener noreferrer">TARS Interstellar (Improved)</a>” by THAD · all CC BY 4.0 · Surfaces: <a href="https://ambientcg.com" target="_blank" rel="noopener noreferrer">ambientCG</a>, CC0 · Earth: <a href="https://visibleearth.nasa.gov" target="_blank" rel="noopener noreferrer">NASA Visible Earth</a> and “<a href="https://sketchfab.com/3d-models/earth-63d902b12fd14868b4dc2f19dc21d7c2" target="_blank" rel="noopener noreferrer">Earth</a>” by kongle, CC BY-SA 4.0
        </p>
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
