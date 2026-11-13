import '../styles/pages/tour.css'
import { Pause, Play, SkipForward, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useSound } from '../audio/sfx'
import { vitaPrime } from '../audio/voice'
import { askedMode, readHandoff } from '../vita/handoff'
import { VitaAvatar } from '../vita/VitaAvatar'
import { exitTour, runTour, skipChapter, soundOnForTour } from './director'
import { CHAPTERS, useTour } from './store'

const REPO = 'https://github.com/A-42-018/AstroDocX'

/** Was the console opened by the landing page's 1-click tour (?tour=1)? Read from the first address, before any redirect drops it. */
const ASKED = typeof location !== 'undefined' && new URLSearchParams(location.search).get('tour') === '1'
/** Which tour: ?mode=full from the landing page's "full tour", else the quick one (the landing page can also leave it in sessionStorage). */
const MODE = typeof location !== 'undefined' ? askedMode(location.search) : 'quick'
/** Once per page load: the cabin renders outside the console frame, so this component remounts on the way in. */
let started = false

/** A ring around the panel VITA is talking about (the one carrying data-tour="<name>"), following it as the page moves. */
function Spotlight({ name }: { name: string }) {
  const [box, setBox] = useState<{ x: number; y: number; w: number; h: number } | null>(null)
  useEffect(() => {
    // bring the panel into view when most of it is off screen or under the tour bar (on a laptop the hazard row is below the fold)
    let tries = 0
    const reveal = () => {
      const el = document.querySelector(`[data-tour="${name}"]`)
      const r = el?.getBoundingClientRect()
      if (!el || !r || r.height === 0) { if (++tries < 10) timer = window.setTimeout(reveal, 300); return }
      const bar = document.querySelector('.tour-bar')?.getBoundingClientRect()
      const under = bar && bar.left < r.right && bar.right > r.left
      const bottom = Math.min(innerHeight, under ? bar.top - 8 : innerHeight)
      const seen = Math.max(0, Math.min(r.bottom, bottom) - Math.max(r.top, 0))
      if (seen / Math.min(r.height, bottom) < 0.85) {
        const smooth = !matchMedia('(prefers-reduced-motion: reduce)').matches
        window.scrollTo({ top: Math.max(0, scrollY + r.top - Math.max(12, (bottom - r.height) / 2)), behavior: smooth ? 'smooth' : 'auto' })
      }
    }
    let timer = window.setTimeout(reveal, 0)
    const find = () => {
      const r = document.querySelector(`[data-tour="${name}"]`)?.getBoundingClientRect()
      const next = r && r.width > 0 ? { x: r.left, y: r.top, w: r.width, h: r.height } : null
      setBox((b) => (b && next && b.x === next.x && b.y === next.y && b.w === next.w && b.h === next.h ? b : next))
    }
    find()
    const id = window.setInterval(find, 400)
    window.addEventListener('resize', find)
    window.addEventListener('scroll', find, { passive: true })
    return () => { window.clearTimeout(timer); window.clearInterval(id); window.removeEventListener('resize', find); window.removeEventListener('scroll', find) }
  }, [name])
  if (!box) return null
  return <div className="tour-ring" aria-hidden="true" style={{ left: box.x - 6, top: box.y - 6, width: box.w + 12, height: box.h + 12 }} />
}

/**
 * The 1-click tour's controls and end card, over every screen. Started by /app/…?tour=1 (the landing page hands over
 * after its own chapter). While it runs: Space pauses, Esc exits, a click or scroll on the page pauses so the visitor can
 * look closer, and "Resume" carries on.
 */
export function Tour() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const { phase, mode, chapter, caption, progress, paused, focus, set } = useTour()
  const bar = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (started || !ASKED) return
    started = true
    // VITA narrates by default. The one exception: the landing page's tour handing over with Sound muted during it.
    const h = readHandoff()
    if (!(h.tour && h.sound === false)) soundOnForTour()
    // Browsers refuse speech until the visitor has touched this page. Arriving from the landing page they have not, so
    // with Sound on a card asks for one click first (it also unlocks the audio); without sound the tour just starts.
    const silent = !useSound.getState().on || typeof speechSynthesis === 'undefined'
    if (!silent && navigator.userActivation?.hasBeenActive === false) { set({ phase: 'gate', mode: MODE }); return }
    void runTour((path) => navigate(path, { replace: true }), MODE)
  }, [navigate, set])

  const begin = (withSound: boolean) => {
    if (!withSound) useSound.setState({ on: false })
    else vitaPrime() // this click is the gesture: it unlocks speech (and the sound context, via sfx's own listener)
    void runTour((path) => navigate(path, { replace: true }), MODE)
  }
  useEffect(() => {
    if (phase !== 'gate') return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.preventDefault(); set({ phase: 'off' }) } }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [phase, set])

  useEffect(() => {
    if (phase !== 'running') return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); exitTour() }
      else if (e.key === ' ' && !(e.target as HTMLElement | null)?.closest?.('button, a, input, textarea, select')) {
        e.preventDefault(); e.stopImmediatePropagation(); set({ paused: !useTour.getState().paused })
      }
    }
    // the visitor reaching for the page pauses the tour rather than fighting them for it
    // (VITA's own dock is not "the page": opening it pauses the tour itself, when a question is asked)
    const onReach = (e: Event) => { const t = e.target as Element | null; if (!bar.current?.contains(t) && !t?.closest?.('.vita-dock')) set({ paused: true }) }
    // capture: ahead of the cabin's own keys (its Esc leaves the cabin, its Space moves the camera)
    window.addEventListener('keydown', onKey, true)
    window.addEventListener('pointerdown', onReach, true)
    window.addEventListener('wheel', onReach, { capture: true, passive: true })
    return () => {
      window.removeEventListener('keydown', onKey, true)
      window.removeEventListener('pointerdown', onReach, true)
      window.removeEventListener('wheel', onReach, true)
    }
  }, [phase, set])

  if (phase === 'off') return null
  if (phase === 'gate') return (
    <div className="tour-end tour-gate" role="dialog" aria-modal="true" aria-labelledby="tour-gate-title">
      <div className="tour-end-card tour-gate-card">
        <VitaAvatar talking size={132} />
        <span className="tour-eb">{MODE === 'full' ? 'The full tour' : 'The guided tour'}</span>
        <h2 id="tour-gate-title">Ready when you are.</h2>
        <p>I’m VITA. I’ll show you AstroDocX out loud, screen by screen. Your browser needs one click before I can speak.</p>
        <div className="tour-end-actions">
          <button type="button" className="tour-btn primary" autoFocus onClick={() => begin(true)}>Continue the tour</button>
          <button type="button" className="tour-btn" onClick={() => begin(false)}>Continue without sound</button>
        </div>
      </div>
    </div>
  )
  const inCabin = pathname.startsWith('/cabin')

  if (phase === 'end') return (
    <div className="tour-end" role="dialog" aria-modal="true" aria-labelledby="tour-end-title">
      <div className="tour-end-card">
        <span className="tour-eb">Tour complete</span>
        <h2 id="tour-end-title">That is AstroDocX.</h2>
        <p>A doctor on board: it learns each astronaut’s own baseline, explains every alert and says what to do next, with or without a link to Earth.</p>
        <div className="tour-end-actions">
          <button type="button" className="tour-btn primary" onClick={() => set({ phase: 'off' })}>Explore the cabin</button>
          <button type="button" className="tour-btn" onClick={() => { set({ phase: 'off' }); navigate('/board') }}>Open the console</button>
          <a className="tour-btn" href="/">Back to the landing page</a>
          <a className="tour-btn" href={REPO} target="_blank" rel="noopener noreferrer">Source on GitHub</a>
        </div>
        {mode === 'full' && <a className="tour-btn tour-lib" href="/#library">Open the NASA library</a>}
        {inCabin || <p className="tour-end-note">Everything runs in your browser, offline included.</p>}
      </div>
    </div>
  )

  return (
    <>
    {focus && !inCabin && <Spotlight name={focus} />}
    <div ref={bar} className={`tour-bar${inCabin ? ' in-cabin' : ''}`} role="region" aria-label="1-click tour">
      <div className="tour-row">
        <ol className="tour-chapters" aria-label="Tour chapters">
          {CHAPTERS.map((c, i) => (
            <li key={c} aria-current={i === chapter ? 'step' : undefined} className={i < chapter ? 'done' : undefined}><b>{i + 1}</b>{c}</li>
          ))}
        </ol>
        <div className="tour-ctl">
          <button type="button" className="tour-icon" onClick={() => set({ paused: !paused })} aria-label={paused ? 'Resume the tour' : 'Pause the tour'}>
            {paused ? <Play size={15} aria-hidden="true" /> : <Pause size={15} aria-hidden="true" />}
            <span>{paused ? 'Resume' : 'Pause'}</span>
          </button>
          <button type="button" className="tour-icon" onClick={skipChapter} aria-label="Skip to the next chapter">
            <SkipForward size={15} aria-hidden="true" /><span>Skip</span>
          </button>
          <button type="button" className="tour-icon" onClick={exitTour} aria-label="Exit the tour"><X size={16} aria-hidden="true" /></button>
        </div>
      </div>
      {caption && <p className="tour-caption" aria-live="polite">{caption}</p>}
      <div className="tour-progress" aria-hidden="true"><i style={{ transform: `scaleX(${progress})` }} /></div>
    </div>
    </>
  )
}
