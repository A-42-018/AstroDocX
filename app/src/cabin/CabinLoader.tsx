import '../styles/pages/cabin-loader.css'
import { useEffect, useRef, useState, type CSSProperties } from 'react'

/** The art behind the loader: a 16:9 frame, full bleed (phones crop to the astronaut and rover). */
export const LOADER_ART = `${import.meta.env.BASE_URL}textures/cabin-loading.webp`

/** Warm the poster with the cabin chunk, so the loader never opens on a blank frame. */
export function preloadLoaderArt() { const i = new Image(); i.src = LOADER_ART }

/** What the loader says it is doing, by how far the load has got. */
const STEPS = [
  { at: 0, text: 'Fetching cabin systems' },
  { at: 0.15, text: 'Loading the crew module' },
  { at: 0.4, text: 'Suiting up the crew' },
  { at: 0.65, text: 'Wiring the consoles' },
  { at: 0.88, text: 'Pressurising cabin' },
]

const FACTS = [
  'On the ISS the crew sees about 16 sunrises a day.',
  'In microgravity the heart works less and can shrink slightly over a long mission.',
  'Astronauts can lose 1–1.5% of bone mass for every month in space.',
  'Body fluids shift towards the head in orbit, which is why faces look puffy.',
  'A Mars crew would be up to 22 minutes from Mission Control, each way. AstroDocX is built for that gap.',
]

/**
 * The fallback (the chunk) and the page (the models) each mount their own loader. They share one clock so the
 * art's drift and the bar carry on across the swap instead of starting over.
 */
const shared = { epoch: 0, shown: 0, gone: 0 }
function epoch() {
  const now = performance.now()
  if (!shared.epoch || (shared.gone && now - shared.gone > 1500)) { shared.epoch = now; shared.shown = 0 }
  shared.gone = 0
  return shared.epoch
}

/** How long the loading screen has been up, counting the fallback that came before the page. */
export function loaderShownMs() { return shared.epoch ? performance.now() - shared.epoch : 0 }

interface Props {
  /** 0–1, or undefined while only the code is downloading (the bar then creeps towards the first step). */
  progress?: number
  /** Fading out: the cabin is ready underneath. */
  leaving?: boolean
  reduced?: boolean
  onBack?: () => void
}

/** The loading screen between the console and the 3D cabin. */
export function CabinLoader({ progress, leaving = false, reduced = false, onBack }: Props) {
  // computed once: a changing delay would make the running animations jump
  const [lag] = useState(() => -((performance.now() - epoch()) / 1000))
  // the first loader of a visit plays the entrance; the one that takes over from the fallback does not
  const [fresh] = useState(() => shared.shown === 0)
  const bar = useRef<HTMLDivElement>(null)
  const pct = useRef<HTMLSpanElement>(null)
  const [step, setStep] = useState(0)
  const [fact, setFact] = useState(() => Math.floor(Math.random() * FACTS.length))
  const target = useRef(0)
  target.current = leaving ? 1 : progress ?? 0.12

  // The bar eases towards the real progress and never goes backwards (more files can join the queue as it loads).
  useEffect(() => {
    let raf = 0, last = performance.now()
    const tick = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000); last = now
      const goal = Math.max(shared.shown, target.current)
      shared.shown += (goal - shared.shown) * Math.min(1, dt * (leaving ? 9 : 3.5))
      const f = shared.shown
      if (bar.current) bar.current.style.transform = `scaleX(${f.toFixed(4)})`
      if (pct.current) pct.current.textContent = String(Math.min(100, Math.max(0, Math.round(f * 100))))
      let s = 0
      STEPS.forEach((x, i) => { if (f >= x.at) s = i })
      setStep(s)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => { cancelAnimationFrame(raf); shared.gone = performance.now() }
  }, [leaving])

  useEffect(() => {
    if (reduced) return
    const id = window.setInterval(() => setFact((i) => (i + 1) % FACTS.length), 4200)
    return () => window.clearInterval(id)
  }, [reduced])

  // negative delay: the animations pick up where the previous loader left them
  const style = { '--cl-t': `${lag.toFixed(2)}s`, '--cl-art': `url("${LOADER_ART}")` } as CSSProperties

  return (
    <div className={`cabin-loader${fresh ? ' is-fresh' : ''}${leaving ? ' is-leaving' : ''}${reduced ? ' is-still' : ''}`} style={style} role="status" aria-live="polite" aria-busy={!leaving}>
      <div className="cl-art" aria-hidden="true" />
      <div className="cl-dust" aria-hidden="true"><i /><i /><i /></div>
      <div className="cl-scan" aria-hidden="true" />
      <div className="cl-frame" aria-hidden="true">
        <span className="cl-corner tl" /><span className="cl-corner tr" /><span className="cl-corner bl" /><span className="cl-corner br" />
        <span className="cl-tag">SOL 0412 · JEZERO RIM · CREW HAB LINK</span>
      </div>

      <div className="cl-copy">
        <div className="cl-brand">AstroDocX <span>· 3D Cabin</span></div>
        <h1 className="cl-title">Docking with the<br />crew module</h1>

        <div className="cl-status">
          <span className="cl-step">{STEPS[step].text}<b className="cl-dots"><i>.</i><i>.</i><i>.</i></b></span>
          <span className="cl-pct"><span ref={pct}>0</span>%</span>
        </div>
        <div className="cl-track"><div ref={bar} className="cl-fill" /></div>
        <ol className="cl-steps" aria-hidden="true">
          {STEPS.map((s, i) => <li key={s.text} className={i < step ? 'done' : i === step ? 'now' : undefined} />)}
        </ol>

        <p className="cl-fact" key={fact}><span>DID YOU KNOW</span>{FACTS[fact]}</p>

        {onBack && <button type="button" className="cl-back" onClick={onBack}>← Back to console</button>}
      </div>
    </div>
  )
}
