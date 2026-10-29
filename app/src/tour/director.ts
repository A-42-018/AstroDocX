import { useBoard } from '../board/store'
import { runDemo } from '../sim/demoRun'
import { CHAPTERS, useTour } from './store'

/*
 * The 1-click tour, console side. The landing page plays chapter 1 and opens /app/board?tour=1; from there this script
 * walks the console's main screens (running the built-in CO₂ demo on the board) and then the 3D cabin's ten stops,
 * ending outside the station. Every wait honours Pause; "Skip" ends the current chapter. Times are in ms.
 */

export type Go = (path: string) => void

interface ConsoleStep { path: string; ms: number; caption: string }
const CONSOLE: ConsoleStep[] = [
  { path: '/alerts', ms: 5500, caption: 'Explainable Alerts: every alert says WHY in plain words, shows the evidence behind it and the NEXT step from its action card.' },
  { path: '/trends', ms: 4500, caption: 'Trends: 30 days of each vital against the astronaut’s own baseline band and the crew median.' },
  { path: '/ground', ms: 4000, caption: 'Ground View: what flight surgeons on Earth see once the next sync window opens.' },
  { path: '/nasa', ms: 4000, caption: 'NASA Data: the hazards, limits and studies the engine is built on: NASA-STD-3001, OSDR and Human Research Program reports.' },
]
/** The demo stops as soon as Environment reaches ACT; it stays on screen at least DEMO_MIN_MS so the climb can be watched. */
const BOARD_MS = 5000, DEMO_MIN_MS = 8000, DEMO_MS = 18000, AFTER_DEMO_MS = 3500
/** How long the camera holds at each cabin stop: the helmet, eight stops through the hall, then outside. */
const CABIN_MS = [4000, 2600, 3000, 3000, 2600, 3000, 3000, 2600, 2600, 6500]
/** The cabin's loading screen and arrival from space, roughly; only used to pace the progress bar. */
const CABIN_LOAD_MS = 8000

const CONSOLE_MS = BOARD_MS + DEMO_MS + AFTER_DEMO_MS + CONSOLE.reduce((a, s) => a + s.ms, 0)
const CABIN_TOTAL_MS = CABIN_LOAD_MS + CABIN_MS.reduce((a, b) => a + b, 0)

let token = 0
let skip = false
const tour = () => useTour.getState()
const live = (mine: number) => mine === token && tour().phase === 'running'

/** Progress through the current chapter: chapter k of three fills the bar from k/3 to (k+1)/3. */
let done = 0, total = 1
function chapter(k: number, ms: number) {
  skip = false
  done = 0
  total = ms
  tour().set({ chapter: k, progress: k / CHAPTERS.length })
}
const say = (caption: string) => tour().set({ caption })
function tick(ms: number) {
  done += ms
  const k = tour().chapter
  tour().set({ progress: (k + Math.min(1, done / total)) / CHAPTERS.length })
}

/** Wait `ms` of tour time (paused time does not count). Resolves early on Skip, Exit, or once `until` is true. */
function wait(mine: number, ms: number, until?: () => boolean) {
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

const splashUp = () => !!document.getElementById('adx-splash')

export async function runTour(go: Go) {
  const mine = ++token
  tour().set({ phase: 'running', paused: false, caption: 'Starting the Crew Console…' })

  // ── Chapter 2: the console ──
  chapter(1, CONSOLE_MS)
  go('/board')
  await until(mine, () => useBoard.getState().boot.state === 'ready' && !splashUp(), 20000)
  if (!live(mine)) return
  say('Status Board: each astronaut’s readiness score, live vitals, a body twin and five NASA hazard modules, all worked out on board with no ground link needed.')
  await wait(mine, BOARD_MS)

  if (live(mine) && !skip) {
    say('Live demo: a CO₂ scrubber fault is injected and the mission clock jumps ahead an hour at a time. Watch Environment climb from OK to ACT.')
    let finished = false
    const t0 = performance.now()
    void runDemo(useBoard.getState().selectCrew).finally(() => { finished = true })
    await wait(mine, DEMO_MS, () => finished && performance.now() - t0 >= DEMO_MIN_MS)
    if (live(mine) && !skip) {
      say('The engine raised an alert on its own, and Next Action tells the crew exactly what to do.')
      await wait(mine, AFTER_DEMO_MS)
    }
  }
  for (const s of CONSOLE) {
    if (!live(mine) || skip) break
    go(s.path)
    say(s.caption)
    await wait(mine, s.ms)
  }
  if (!live(mine)) return

  // ── Chapter 3: the 3D cabin ──
  chapter(2, CABIN_TOTAL_MS)
  try { sessionStorage.removeItem('adx-cabin-arrived') } catch { /* the arrival may just not replay */ }
  tour().set({ cabin: null, cabinFailed: false })
  go('/cabin')
  say('Entering the 3D cabin: the same live data, inside the crew module.')
  const t0 = performance.now()
  await until(mine, () => !!tour().cabin || tour().cabinFailed, 45000)
  if (!live(mine)) return
  tick(Math.min(CABIN_LOAD_MS, performance.now() - t0))
  const cabin = tour().cabin
  if (cabin) {
    say('')
    for (let i = 0; i < CABIN_MS.length; i++) {
      if (!live(mine) || skip) break
      cabin.goTo(i)
      await wait(mine, CABIN_MS[i])
    }
  }
  if (!live(mine)) return
  tour().set({ phase: 'end', progress: 1, caption: '' })
}

export function skipChapter() {
  if (tour().phase !== 'running') return
  skip = true
  tour().set({ paused: false })
}

export function exitTour() {
  token++
  tour().set({ phase: 'off', paused: false, caption: '' })
}
