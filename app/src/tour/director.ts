import { stinger } from '../audio/music'
import { hushChatter, vitaPause, vitaResume, vitaSay, vitaStop } from '../audio/voice'
import { useBoard } from '../board/store'
import { runDemo } from '../sim/demoRun'
import { BOARD, CABIN_ENTER, CABIN_MIN_MS, FINISH, LIBRARY_LINE, lineFor, readMs, stepsFor, type TourMode } from './script'
import { CHAPTERS, useTour } from './store'

/*
 * The guided tour, console side. The landing page plays chapter 1 and opens /app/?tour=1[&mode=full]; from there this
 * script walks the console's screens (running the built-in CO₂ demo on the board) and then the 3D cabin's ten stops,
 * ending outside the station. VITA narrates every step aloud when Sound is on, and the same words show as the caption.
 * A step lasts as long as the longer of its own time and the speech: the tour never moves on mid-sentence.
 * Every wait honours Pause; "Skip" ends the current chapter. Times are in ms.
 */

export type Go = (path: string) => void

/** The demo stops as soon as Environment reaches ACT; it stays on screen at least DEMO_MIN_MS so the climb can be watched. */
const DEMO_MIN_MS = 8000
/** The cabin's loading screen and arrival from space, roughly; only used to pace the progress bar. */
const CABIN_LOAD_MS = 8000

let token = 0
let skip = false
const tour = () => useTour.getState()
/** The id of the tour run that is current; steps belonging to an older run stop at their next check. */
export const currentRun = () => token
const live = (mine: number) => mine === token && tour().phase === 'running'

/** Progress through the current chapter: chapter k of three fills the bar from k/3 to (k+1)/3. */
let done = 0, total = 1
function chapter(k: number, ms: number) {
  skip = false
  done = 0
  total = ms
  tour().set({ chapter: k, progress: k / CHAPTERS.length })
}
const caption = (text: string, focus: string | null = null) => tour().set({ caption: text, focus })
function tick(ms: number) {
  done += ms
  const k = tour().chapter
  tour().set({ progress: (k + Math.min(1, done / total)) / CHAPTERS.length })
}

/** Wait `ms` of tour time (paused time does not count). Resolves early on Skip, Exit, or once `until` is true. */
export function wait(mine: number, ms: number, until?: () => boolean) {
  return new Promise<void>((resolve) => {
    let left = ms, last = performance.now()
    const id = window.setInterval(() => {
      const now = performance.now(), dt = now - last
      last = now
      if (!live(mine) || skip || until?.()) { window.clearInterval(id); resolve(); return }
      if (tour().paused) return
      left -= dt
      tick(Math.min(dt, Math.max(0, left + dt)))
      if (left <= 0) { window.clearInterval(id); resolve() }
    }, 100)
  })
}

/** Wait (unpaced) until `ok()` is true, for at most `max` ms. */
function until(mine: number, ok: () => boolean, max: number) {
  return new Promise<boolean>((resolve) => {
    const t0 = performance.now()
    const id = window.setInterval(() => {
      if (!live(mine) || skip) { window.clearInterval(id); resolve(false); return }
      if (ok()) { window.clearInterval(id); resolve(true); return }
      if (performance.now() - t0 > max) { window.clearInterval(id); resolve(false) }
    }, 100)
  })
}

/** Wait for a flag that no timer drives (the end of a line of speech); Skip and Exit still break it. Paused time does not run out. */
function settle(mine: number, ok: () => boolean) {
  return new Promise<void>((resolve) => {
    const id = window.setInterval(() => {
      if (!live(mine) || skip || ok()) { window.clearInterval(id); resolve() }
    }, 50)
  })
}

/**
 * VITA says `text` while it shows as the caption, and the step lasts at least `ms` (and long enough to read the caption).
 * It then also waits for the speech to end, so with a long sentence the tour holds still until she has finished.
 * `until` ends the timed part early (the demo finishing); the speech is still waited for. With Sound off there is no
 * speech to wait for and only the time counts.
 */
export async function narrate(mine: number, text: string, ms: number, opts: { until?: () => boolean; focus?: string | null } = {}) {
  caption(text, opts.focus ?? null)
  let spoken = false
  void vitaSay(text).then(() => { spoken = true })
  await wait(mine, Math.max(ms, readMs(text)), opts.until)
  await settle(mine, () => spoken)
}

const splashUp = () => !!document.getElementById('adx-splash')

export async function runTour(go: Go, mode: TourMode = 'quick') {
  const mine = ++token
  skip = false
  vitaStop()
  tour().set({ phase: 'running', mode, paused: false, caption: 'Starting the Crew Console…', focus: null })
  hushChatter(true)

  // ── Chapter 2: the console ──
  const steps = stepsFor(mode)
  const consoleMs = BOARD.intro.ms + BOARD.demo.ms + BOARD.after.ms + steps.reduce((a, s) => a + s.ms, 0)
  chapter(1, consoleMs)
  go('/board')
  await until(mine, () => useBoard.getState().boot.state === 'ready' && !splashUp(), 20000)
  if (!live(mine)) return
  await narrate(mine, lineFor(BOARD.intro, mode), BOARD.intro.ms, { focus: 'readiness' })

  if (live(mine) && !skip) {
    let finished = false
    const t0 = performance.now()
    void runDemo(useBoard.getState().selectCrew).finally(() => { finished = true })
    await narrate(mine, lineFor(BOARD.demo, mode), BOARD.demo.ms, { until: () => finished && performance.now() - t0 >= DEMO_MIN_MS, focus: 'hazards' })
    if (live(mine) && !skip) await narrate(mine, lineFor(BOARD.after, mode), BOARD.after.ms, { focus: 'next-action' })
  }
  for (const s of steps) {
    if (!live(mine) || skip) break
    go(s.path)
    await narrate(mine, lineFor(s, mode), s.ms)
  }
  if (!live(mine)) return

  // ── Chapter 3: the 3D cabin ──
  chapter(2, CABIN_LOAD_MS + CABIN_MIN_MS.reduce((a, b) => a + b, 0))
  try { sessionStorage.removeItem('adx-cabin-arrived') } catch { /* the arrival may just not replay */ }
  tour().set({ cabin: null, cabinFailed: false })
  go('/cabin')
  caption(CABIN_ENTER)
  let entered = false
  void vitaSay(CABIN_ENTER).then(() => { entered = true })
  const t0 = performance.now()
  await until(mine, () => !!tour().cabin || tour().cabinFailed, 45000)
  if (!live(mine)) return
  await settle(mine, () => entered) // the first stop must not cut the welcome off
  tick(Math.min(CABIN_LOAD_MS, performance.now() - t0))
  const cabin = tour().cabin
  if (cabin) {
    for (let i = 0; i < CABIN_MIN_MS.length; i++) {
      if (!live(mine) || skip) break
      cabin.goTo(i)
      // the cabin's own caption card shows the same stop; ours stays out of its way while the camera moves
      await narrate(mine, cabin.spoken(i), CABIN_MIN_MS[i])
    }
  }
  if (!live(mine)) return
  if (mode === 'full' && !skip) await narrate(mine, LIBRARY_LINE, 5000)
  if (!live(mine)) return
  hushChatter(false)
  tour().set({ phase: 'end', progress: 1, caption: '', focus: null })
  stinger('success')
  void vitaSay(FINISH[mode])
}

export function skipChapter() {
  if (tour().phase !== 'running') return
  skip = true
  vitaStop()
  tour().set({ paused: false })
}

export function exitTour() {
  token++
  skip = false
  vitaStop()
  hushChatter(false)
  tour().set({ phase: 'off', paused: false, caption: '', focus: null })
}

// Pause / Resume on the bar (or Space) pauses and resumes VITA mid-sentence; leaving the tour any other way silences her too.
useTour.subscribe((s, prev) => {
  if (s.phase === 'running' && s.paused !== prev.paused) { if (s.paused) vitaPause(); else vitaResume() }
  if (prev.phase !== 'off' && s.phase === 'off') vitaStop()
})
