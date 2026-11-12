/**
 * X-Ray Mirror (/xray): point the camera at your face and see your skull, jaw, brain and face muscles move with you,
 * and the bones of any hand you raise. Full screen, outside the console frame, like the 3D cabin.
 *
 * A self-contained feature: everything lives in src/xray and public/xray (plus tools/xray for the models). To remove
 * it, delete those folders and the lines marked "XRAY" in App.tsx and shell/Chrome.tsx.
 */
import './xray.css'
import { Activity, BicepsFlexed, Brain, Camera, Hand, Play, ScanFace, SlidersHorizontal, Skull, X } from 'lucide-react'
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSnapshot } from '../board/hooks'
import { saveScan } from '../scan/store'
import { GuideRun, measureFrame, STEPS } from './guide'
import { drawTags, type TagGroup } from './labels'
import { createXray, type XrayScene } from './scene'
import { loadSettings, saveSettings, type Layer, type XraySettings } from './settings'
import { composeSnapshot, saveCanvas } from './snapshot'
import { useTracker, type TrackFrame } from './useTracker'
import { tintFor, videoFilter } from './view'
import { VitalsCard } from './VitalsCard'
import { useVitals } from './vitals'

const XrayPanel = lazy(() => import('./XrayPanel'))

const LAYERS: { id: Layer; label: string; icon: typeof Skull }[] = [
  { id: 'skull', label: 'Skull', icon: Skull },
  { id: 'brain', label: 'Brain', icon: Brain },
  { id: 'muscles', label: 'Muscles', icon: BicepsFlexed },
  { id: 'hands', label: 'Hand bones', icon: Hand },
]

export default function XrayPage() {
  const navigate = useNavigate()
  const stage = useRef<HTMLDivElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const scene = useRef<XrayScene | null>(null)
  const [sceneError, setSceneError] = useState('')
  const [cfg, setCfg] = useState<XraySettings>(loadSettings)
  const [drawer, setDrawer] = useState(false)
  const tagCanvas = useRef<HTMLCanvasElement>(null)
  const labelsNow = useRef<TagGroup[]>([])
  const { layers, strength } = cfg
  const guide = useRef(new GuideRun())
  const [step, setStep] = useState(0)
  const [face, setFace] = useState(false)
  const [flash, setFlash] = useState(false)
  const seen = useRef(false)
  const lastFace = useRef(0)
  const [showVitals, setShowVitals] = useState(true)
  const vitals = useVitals(showVitals)
  const feedVitals = vitals.feed
  const board = useSnapshot()
  const [vSaved, setVSaved] = useState(false)
  const [vBusy, setVBusy] = useState(false)
  const [vError, setVError] = useState('')
  const saveVitals = useCallback(async () => {
    const result = vitals.view.final
    if (!result || !board) return
    setVBusy(true); setVError('')
    try { await saveScan({ crewId: board.crewId, ts: board.now, analysis: result }); setVSaved(true) }
    catch (e) { setVError(e instanceof Error ? e.message : String(e)) }
    finally { setVBusy(false) }
  }, [vitals.view.final, board])
  const vitalsAgain = useCallback(() => { setVSaved(false); setVError(''); vitals.again() }, [vitals])

  /** The name tags are a 2D canvas over the mirror (not flipped: their positions are already mirrored). */
  const paintTags = useCallback((groups: TagGroup[]) => {
    const c = tagCanvas.current
    if (!c) return
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const w = c.clientWidth, h = c.clientHeight
    if (c.width !== Math.round(w * dpr) || c.height !== Math.round(h * dpr)) { c.width = Math.round(w * dpr); c.height = Math.round(h * dpr) }
    const ctx = c.getContext('2d')
    if (!ctx) return
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, w, h)
    if (groups.length) drawTags(ctx, groups, w, h, w < 640 ? 10 : 12)
  }, [])

  const onFrame = useCallback((f: TrackFrame) => {
    const placed = scene.current?.update(f) ?? []
    labelsNow.current = placed
    paintTags(placed)
    if (guide.current.feed(measureFrame(f), f.now)) setStep(guide.current.step)
    feedVitals(f)
    // "looking for your face" only after a short miss, so a blink of lost tracking does not flash it
    if (f.face) lastFace.current = f.now
    const now = !!f.face || f.now - lastFace.current < 800
    if (now !== seen.current) { seen.current = now; setFace(now) }
  }, [paintTags, feedVitals])
  const { videoRef, state, error, notice, start, stop } = useTracker(onFrame)

  const begin = useCallback(async () => {
    setSceneError('')
    guide.current = new GuideRun(); setStep(0)
    if (!scene.current && canvas.current) {
      try {
        scene.current = await createXray(canvas.current)
        scene.current.apply(cfg)
        const r = stage.current?.getBoundingClientRect()
        if (r) scene.current.resize(r.width, r.height)
      } catch {
        setSceneError('The X-ray view could not start on this device (it needs WebGL and the anatomy files).')
        return
      }
    }
    await start()
  }, [start, cfg])

  const exit = useCallback(() => { stop(); navigate('/board') }, [stop, navigate])

  const snap = useCallback(async () => {
    const v = videoRef.current, s = scene.current
    if (!v || !s) return
    const shot = composeSnapshot(v, s.draw(), cfg, labelsNow.current)
    setFlash(true); window.setTimeout(() => setFlash(false), 220)
    await saveCanvas(shot)
  }, [videoRef, cfg])

  useEffect(() => { scene.current?.apply(cfg) }, [cfg])
  // saved a moment after the last change, so dragging a slider does not write on every step
  useEffect(() => { const t = window.setTimeout(() => saveSettings(cfg), 300); return () => window.clearTimeout(t) }, [cfg])
  const toggle = (id: Layer) => setCfg((c) => ({ ...c, layers: { ...c.layers, [id]: !c.layers[id] } }))

  // keep the overlay the size of the screen
  useEffect(() => {
    const el = stage.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(([e]) => scene.current?.resize(e.contentRect.width, e.contentRect.height))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useEffect(() => () => { scene.current?.dispose(); scene.current = null }, [])

  useEffect(() => {
    // Escape closes the drawer first, then the page
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') { if (drawer) setDrawer(false); else exit() } }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [exit, drawer])

  const live = state === 'on'
  const guiding = live && step < STEPS.length
  const problem = sceneError || (state === 'error' ? error : '')

  return (
    <div className={`xr${live ? ' xr-live' : ''}`}>
      <div ref={stage} className="xr-stage">
        <video ref={videoRef} className="xr-video" playsInline muted style={{ filter: videoFilter(strength, cfg.realThrough) }} />
        <div className="xr-tint" style={{ background: tintFor(strength, cfg.realThrough) }} aria-hidden="true" />
        <canvas ref={canvas} className="xr-canvas" aria-hidden="true" />
      </div>
      <canvas ref={tagCanvas} className="xr-tags" aria-hidden="true" />
      {flash && <div className="xr-flash" aria-hidden="true" />}

      <header className="xr-top">
        <span className="xr-title"><ScanFace size={18} aria-hidden="true" /><b>X-Ray Mirror</b></span>
        <button type="button" className="xr-icon" onClick={exit} aria-label="Close the X-ray mirror and go back to the console" title="Close (Esc)">
          <X size={20} aria-hidden="true" />
        </button>
      </header>

      {!live && (
        <section className="xr-card" aria-labelledby="xr-h">
          {state === 'loading' ? (
            <>
              <div className="xr-spin" aria-hidden="true" />
              <h1 id="xr-h">Starting the mirror…</h1>
              <p>Allow the camera when your browser asks. The X-ray loads once, then works offline.</p>
            </>
          ) : problem ? (
            <>
              <h1 id="xr-h">The mirror could not start</h1>
              <p role="alert">{problem}</p>
              <div className="xr-row">
                <button type="button" className="xr-go" onClick={() => void begin()}><Play size={16} aria-hidden="true" />Try again</button>
                <button type="button" className="xr-ghost" onClick={exit}>Back to console</button>
              </div>
            </>
          ) : (
            <>
              <ScanFace size={40} className="xr-hero" aria-hidden="true" />
              <h1 id="xr-h">See inside your head</h1>
              <p>Your skull, jaw, brain and face muscles follow you live. Open your mouth and the jaw opens; raise a hand to see its bones.</p>
              <ul className="xr-facts">
                <li>Your camera picture stays on this device. Nothing is recorded or sent.</li>
                <li>Best in good light, about an arm’s length from the screen.</li>
              </ul>
              {notice && <p className="xr-note" role="status">{notice}</p>}
              <div className="xr-row">
                <button type="button" className="xr-go" onClick={() => void begin()}><Play size={16} aria-hidden="true" />Start mirror</button>
                <button type="button" className="xr-ghost" onClick={exit}>Back to console</button>
              </div>
            </>
          )}
        </section>
      )}

      {live && !face && <p className="xr-look" role="status">Looking for your face… face the camera in good light.</p>}

      {guiding && (
        <section className="xr-guide" aria-live="polite" aria-label="Guided start">
          <ol className="xr-steps">
            {STEPS.map((s, i) => <li key={s.id} className={i < step ? 'done' : i === step ? 'now' : ''}><span className="sr-only">{i < step ? 'Done: ' : ''}</span>{s.title}</li>)}
          </ol>
          <p><b>{STEPS[step].title}.</b> {STEPS[step].hint}</p>
          <button type="button" className="xr-ghost sm" onClick={() => { guide.current.skip(); setStep(STEPS.length) }}>Skip guide</button>
        </section>
      )}

      {live && (
        <nav className="xr-bar" aria-label="X-ray controls">
          <div className="xr-layers" role="group" aria-label="Layers">
            {LAYERS.map(({ id, label, icon: Icon }) => (
              <button key={id} type="button" className="xr-tog" aria-label={label} title={label} aria-pressed={layers[id]} onClick={() => toggle(id)}>
                <Icon size={18} aria-hidden="true" /><span>{label}</span>
              </button>
            ))}
          </div>
          <label className="xr-slider">
            <span>X-ray</span>
            <input type="range" min={0} max={1} step={0.05} value={strength} onChange={(e) => setCfg((c) => ({ ...c, strength: Number(e.target.value) }))} aria-valuetext={`${Math.round(strength * 100)}%`} />
          </label>
          <div className="xr-row">
            <button type="button" className="xr-ghost sm" onClick={() => setShowVitals((v) => !v)} aria-pressed={showVitals} aria-label="Show vital signs"><Activity size={16} aria-hidden="true" />Vitals</button>
            <button type="button" className="xr-ghost sm" onClick={() => setDrawer((d) => !d)} aria-expanded={drawer} aria-label="Open the settings"><SlidersHorizontal size={16} aria-hidden="true" />Settings</button>
            {!guiding && <button type="button" className="xr-ghost sm" onClick={() => { guide.current = new GuideRun(); setStep(0) }}>Guide</button>}
            <button type="button" className="xr-go" onClick={() => void snap()} aria-label="Take a snapshot and save it as a picture"><Camera size={18} aria-hidden="true" /><span>Snapshot</span></button>
          </div>
        </nav>
      )}

      {live && showVitals && <VitalsCard view={vitals.view} onAgain={vitalsAgain} save={{ onSave: board ? () => void saveVitals() : undefined, busy: vBusy, saved: vSaved, error: vError }} />}
      {live && cfg.reveal === 'lens' && !drawer && <p className="xr-look" role="status">X-ray lens: raise a hand and point with your index finger.</p>}
      {drawer && <Suspense fallback={null}><XrayPanel settings={cfg} onChange={setCfg} onClose={() => setDrawer(false)} /></Suspense>}

      <footer className="xr-credit">
        Anatomy: BodyParts3D © DBCLS, CC BY-SA 2.1 JP · Tracking: MediaPipe · Not a medical image
      </footer>
    </div>
  )
}
