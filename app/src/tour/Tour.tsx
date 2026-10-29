import '../styles/pages/tour.css'
import { Pause, Play, SkipForward, X } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { exitTour, runTour, skipChapter } from './director'
import { CHAPTERS, useTour } from './store'

const REPO = 'https://github.com/A-42-018/AstroDocX'

/** Was the console opened by the landing page's 1-click tour (?tour=1)? Read from the first address, before any redirect drops it. */
const ASKED = typeof location !== 'undefined' && new URLSearchParams(location.search).get('tour') === '1'
/** Once per page load: the cabin renders outside the console frame, so this component remounts on the way in. */
let started = false

/**
 * The 1-click tour's controls and end card, over every screen. Started by /app/…?tour=1 (the landing page hands over
 * after its own chapter). While it runs: Space pauses, Esc exits, a click or scroll on the page pauses so the visitor can
 * look closer, and "Resume" carries on.
 */
export function Tour() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const { phase, chapter, caption, progress, paused, set } = useTour()
  const bar = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (started || !ASKED) return
    started = true
    void runTour((path) => navigate(path, { replace: true }))
  }, [navigate])

  useEffect(() => {
    if (phase !== 'running') return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); exitTour() }
      else if (e.key === ' ' && !(e.target as HTMLElement | null)?.closest?.('button, a, input, textarea, select')) {
        e.preventDefault(); e.stopImmediatePropagation(); set({ paused: !useTour.getState().paused })
      }
    }
    // the visitor reaching for the page pauses the tour rather than fighting them for it
    const onReach = (e: Event) => { if (!bar.current?.contains(e.target as Node)) set({ paused: true }) }
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
        {inCabin || <p className="tour-end-note">Everything runs in your browser, offline included.</p>}
      </div>
    </div>
  )

  return (
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
  )
}
