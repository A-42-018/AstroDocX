import '../styles/pages/ultrasound.css'
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Check, Flag, RotateCcw, RotateCw } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useSnapshot } from '../board/hooks'
import { useBoard } from '../board/store'
import { confirmChime, notAllowed, scanSweep } from '../audio/sfx'
import type { UsScan } from '../data/types'
import { met } from '../engine/actions'
import { hashSeed, loadTargets } from '../live/telemetry'
import { useHidden, useReducedMotion } from '../live/usePaused'
import { requestPersistentStorage } from '../shell/install'
import { Button, HudPanel, KpiCell, KpiGrid, Segmented, StatusTag, Switch, buttonClass } from '../ui'
import { StateView } from '../ui/StateView'
import { BodyMap } from './BodyMap'
import { EXAMS, examById, type Exam, type ExamId } from './exams'
import { GOOD, HOLD_S, Hold, assist, clamp, hint, quality, startProbe, type Hint, type Probe } from './guide'
import { IMG_H, IMG_W, NORMAL_ANATOMY, dopplerEnvelope, renderFrame, type Anatomy } from './render'
import { baselineFor, measure, missionDay, type Finding, type ScanResult } from './sim'
import { Sparkline } from './Sparkline'
import { flagUsScan, saveUsScan, watchScans } from './store'

const STEP = 0.06
const FPS = 24

const fmt = (n: number, dec: number) => n.toFixed(dec)

/** What the controls show about the probe: kept in state, so rendering never reads the probe ref. */
const hudOf = (p: Probe, held: number): { q: number; held: number; hint: Hint } => ({ q: quality(p), held, hint: hint(p) })

export default function UltrasoundPage() {
  const snap = useSnapshot()
  const boot = useBoard((s) => s.boot)
  if (boot.state === 'error') return <StateView kind="error" title="Could not open the local database"><p>{boot.error}</p></StateView>
  if (boot.state !== 'ready' || snap === undefined) {
    const pct = boot.state === 'seeding' && boot.total > 0 ? (boot.done / boot.total) * 100 : undefined
    return <StateView kind="loading" label="Initializing demo mission data" progress={pct} />
  }
  if (snap === null) return <StateView kind="empty" label="No crew data yet." />
  return <UsView key={snap.crewId} crewId={snap.crewId} name={snap.crew.find((c) => c.id === snap.crewId)?.name ?? ''} now={snap.now} />
}

/** What the picture should look like so it agrees with the numbers this scan will report. */
function anatomyFrom(res: ScanResult): Anatomy {
  const a = { ...NORMAL_ANATOMY }
  for (const v of res.values) (a as Record<string, number>)[v.id] = v.value
  return a
}

function UsView({ crewId, name, now }: { crewId: string; name: string; now: number }) {
  const [params, setParams] = useSearchParams()
  const exam: Exam = examById(params.get('exam')) ?? EXAMS[0]
  const fromRf = params.get('from') === 'rf'
  const reduced = useReducedMotion()
  const hidden = useHidden()

  const [finding, setFinding] = useState<Finding>('expected')
  const [auto, setAuto] = useState(false)
  const [round, setRound] = useState(0) // each new scan gets its own start position and noise
  const [gain, setGain] = useState(1)
  const [history, setHistory] = useState<UsScan[]>([])
  const [savedAny, setSaved] = useState<UsScan | null>(null)
  const [error, setError] = useState('')
  const [rates, setRates] = useState({ hr: 64, resp: 14 })
  const [tick, setTick] = useState(0) // a still page redraws when the probe moves

  const pending = useMemo(() => measure(exam, crewId, missionDay(now), finding, round), [exam, crewId, now, finding, round])
  const probe = useRef<Probe>(startProbe(hashSeed(`${crewId}:${exam.id}:${round}`)))
  const hold = useRef(new Hold())
  const [hud, setHud] = useState(() => hudOf(probe.current, 0))
  const canvas = useRef<HTMLCanvasElement>(null)
  const doppler = useRef<HTMLCanvasElement>(null)
  // a scan saved for another exam is not this exam's result (the state is cleared a moment after the exam changes)
  const saved = savedAny && savedAny.exam === exam.id ? savedAny : null
  const done = saved !== null
  const redrawKey = reduced ? tick : 0 // a still page redraws when the probe moves; a live one has its own loop

  useEffect(() => { void loadTargets(crewId).then((t) => setRates({ hr: t.hr, resp: 14 }), () => {}) }, [crewId])
  useEffect(() => {
    const sub = watchScans(crewId, exam.id, setHistory, () => {})
    return () => sub.unsubscribe()
  }, [crewId, exam.id])

  // a new exam, finding or scan starts from scratch
  useEffect(() => {
    probe.current = startProbe(hashSeed(`${crewId}:${exam.id}:${round}`))
    hold.current.reset()
    setSaved(null); setError('')
    setHud(hudOf(probe.current, 0))
  }, [crewId, exam.id, round, finding])

  const capture = useCallback(async () => {
    try {
      const s = await saveUsScan({ crewId, ts: now, result: pending, quality: quality(probe.current) })
      setSaved(s); scanSweep(); confirmChime()
      void requestPersistentStorage()
    } catch (e) {
      notAllowed(); setError(e instanceof Error ? e.message : String(e))
    }
  }, [crewId, now, pending])
  const captureRef = useRef(capture)
  useEffect(() => { captureRef.current = capture })

  const move = (d: Partial<Probe>) => {
    if (done) return
    const p = probe.current
    probe.current = { x: clamp(p.x + (d.x ?? 0)), y: clamp(p.y + (d.y ?? 0)), tilt: clamp(p.tilt + (d.tilt ?? 0)) }
    setHud(hudOf(probe.current, hold.current.held))
    setTick((n) => n + 1)
  }
  const onKey = (e: React.KeyboardEvent) => {
    const k: Record<string, Partial<Probe>> = {
      ArrowLeft: { x: -STEP }, ArrowRight: { x: STEP }, ArrowUp: { y: -STEP }, ArrowDown: { y: STEP }, a: { tilt: -STEP }, d: { tilt: STEP },
    }
    const m = k[e.key]
    if (m) { e.preventDefault(); move(m) }
  }

  // the picture and the guidance loop
  useEffect(() => {
    const cv = canvas.current
    const ctx = cv?.getContext('2d')
    if (!cv || !ctx) return
    const off = document.createElement('canvas'); off.width = IMG_W; off.height = IMG_H
    const octx = off.getContext('2d')!
    const img = octx.createImageData(IMG_W, IMG_H)
    const anat = anatomyFrom(pending)
    const clock = { t: 0, heartHz: rates.hr / 60, breathHz: rates.resp / 60 }
    const dcv = doppler.current
    const dctx = exam.id === 'vascular' ? dcv?.getContext('2d') : null
    const env: number[] = []

    const size = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const w = cv.getBoundingClientRect().width
      cv.width = Math.floor(w * dpr); cv.height = Math.floor((w * IMG_H / IMG_W) * dpr)
      if (dcv && dctx) { dcv.width = Math.floor(w * dpr); dcv.height = Math.floor(72 * dpr); dctx.setTransform(dpr, 0, 0, dpr, 0, 0) }
    }
    const paintDoppler = () => {
      if (!dcv || !dctx) return
      const w = dcv.getBoundingClientRect().width, h = 72
      dctx.fillStyle = '#02070b'; dctx.fillRect(0, 0, w, h)
      dctx.strokeStyle = 'rgba(70,225,245,0.2)'; dctx.beginPath(); dctx.moveTo(0, h - 16); dctx.lineTo(w, h - 16); dctx.stroke()
      const peak = anat.cpv, top = Math.max(peak * 1.25, 1)
      const n = Math.min(env.length, Math.floor(w / 2))
      for (let i = 0; i < n; i++) {
        const v = env[env.length - 1 - i]
        const x = w - i * 2
        const hh = (v / top) * (h - 22)
        const g = dctx.createLinearGradient(0, h - 16 - hh, 0, h - 16)
        g.addColorStop(0, 'rgba(230,250,255,0.95)'); g.addColorStop(1, 'rgba(54,226,245,0.15)')
        dctx.fillStyle = g; dctx.fillRect(x, h - 16 - hh, 2, hh)
      }
      dctx.fillStyle = 'rgba(214,238,250,0.7)'; dctx.font = '10px ui-monospace, monospace'
      dctx.fillText(`peak ${Math.round(peak)} cm/s`, 6, 12)
    }
    const paint = () => {
      renderFrame(img, exam.id, clock, probe.current, anat, gain)
      octx.putImageData(img, 0, 0)
      ctx.imageSmoothingEnabled = true
      ctx.drawImage(off, 0, 0, cv.width, cv.height)
      paintDoppler()
    }
    size()
    const q0 = quality(probe.current)
    for (let i = 0; i < 120; i++) env.push(dopplerEnvelope(((i / 24) * clock.heartHz) % 1, anat.cpv * (0.4 + 0.6 * q0)))
    paint()
    if (reduced || hidden || done) return
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => { size(); paint() }) : null
    ro?.observe(cv)
    let raf = 0, last = performance.now(), lastHud = 0, wob = 0
    let captured = false
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame)
      if (now - last < 1000 / FPS - 1) return
      const dt = Math.min((now - last) / 1000, 0.25)
      last = now
      clock.t += dt
      env.push(dopplerEnvelope((clock.t * clock.heartHz) % 1, anat.cpv * (0.4 + 0.6 * quality(probe.current)))); if (env.length > 400) env.shift()
      if (auto) { wob = Math.sin(clock.t * 2.3) + 0.7 * Math.sin(clock.t * 5.1); probe.current = assist(probe.current, dt, wob) }
      const q = quality(probe.current)
      const fin = hold.current.update(q, dt)
      paint()
      if (now - lastHud > 120) { lastHud = now; setHud(hudOf(probe.current, hold.current.held)) }
      if (fin && !captured) { captured = true; void captureRef.current() }
    }
    raf = requestAnimationFrame(frame)
    return () => { cancelAnimationFrame(raf); ro?.disconnect() }
  }, [exam.id, pending, rates, gain, auto, reduced, hidden, done, redrawKey])

  const pickExam = (id: ExamId) => {
    const next = new URLSearchParams(params)
    next.set('exam', id); next.delete('from')
    setParams(next, { replace: true })
  }
  const h = hud.hint
  const q = hud.q
  const qPct = Math.round(q * 100)
  const best = done ? saved.quality : q
  const canCapture = !done && q >= GOOD

  const flag = async () => {
    if (!saved) return
    try { await flagUsScan(saved, now); setSaved({ ...saved, flagged: true }); confirmChime() } catch (e) { notAllowed(); setError(e instanceof Error ? e.message : String(e)) }
  }

  return (
    <div className="us">
      <div className="us-side">
        <HudPanel title="Ultrasound" meta="Simulated imagery" className="us-who">
          <p className="us-eb">Guided scan · {name}</p>
          <h1 className="us-h1">{exam.label} scan</h1>
          {fromRf && <p className="us-from" role="status">Suggested by Wi-Fi sensing, which saw a sustained change in breathing.</p>}
          <Segmented label="Exam" options={EXAMS.map((e) => ({ id: e.id, label: e.label }))} value={exam.id} onChange={pickExam} className="us-seg" />
          <BodyMap active={exam.id} onPick={pickExam} />
          <p className="us-site-name"><b>{exam.siteName}</b></p>
          <p className="us-text">{exam.probe}</p>
          <p className="us-text"><b>Checks:</b> {exam.checks}</p>
          <p className="us-text"><b>Why in space:</b> {exam.why}</p>
          <p className="us-research">{exam.research}</p>
        </HudPanel>
      </div>

      <HudPanel title={`${exam.mode}`} meta={done ? 'Captured' : 'Live'} hero className="us-bay">
        <div className="us-stage-wrap">
          <div className="us-stage" tabIndex={0} role="group" aria-label="Probe view. Arrow keys slide the probe, A and D tilt it." onKeyDown={onKey}>
            <canvas ref={canvas} className="us-cv" aria-hidden="true" />
            <span className="us-badge" aria-hidden="true">Simulated</span>
            <span className="us-depth" aria-hidden="true"><i>0</i><i>2</i><i>4</i><i>6 cm</i></span>
            {!done && <span className={`us-hint k-${h.key}`} aria-hidden="true">{h.text}</span>}
          </div>
          {exam.id === 'vascular' && <canvas ref={doppler} className="us-dop" aria-hidden="true" />}
        </div>

        <div className="us-ctl">
          <div className="us-meter" role="meter" aria-label="Image quality" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(best * 100)}>
            <span style={{ width: `${Math.round(best * 100)}%` }} className={best >= GOOD ? 'ok' : ''} />
            <em>{done ? `Captured at ${Math.round(best * 100)}%` : `Image quality ${qPct}%`}</em>
          </div>
          <p className="us-live" role="status" aria-live="polite">
            {done ? 'Scan captured.' : q >= GOOD ? `Good view. Hold steady: ${Math.max(0, HOLD_S - hud.held).toFixed(1)} s to capture.` : h.text + '.'}
          </p>
          <div className="us-pad" role="group" aria-label="Move the probe">
            <Button variant="ghost" size="sm" onClick={() => move({ tilt: -STEP })} aria-label="Tilt the probe back" disabled={done}><RotateCcw size={16} aria-hidden="true" /></Button>
            <Button variant="ghost" size="sm" onClick={() => move({ y: -STEP })} aria-label="Slide the probe up" disabled={done}><ArrowUp size={16} aria-hidden="true" /></Button>
            <Button variant="ghost" size="sm" onClick={() => move({ tilt: STEP })} aria-label="Tilt the probe forward" disabled={done}><RotateCw size={16} aria-hidden="true" /></Button>
            <Button variant="ghost" size="sm" onClick={() => move({ x: -STEP })} aria-label="Slide the probe left" disabled={done}><ArrowLeft size={16} aria-hidden="true" /></Button>
            <Button variant="ghost" size="sm" onClick={() => move({ y: STEP })} aria-label="Slide the probe down" disabled={done}><ArrowDown size={16} aria-hidden="true" /></Button>
            <Button variant="ghost" size="sm" onClick={() => move({ x: STEP })} aria-label="Slide the probe right" disabled={done}><ArrowRight size={16} aria-hidden="true" /></Button>
          </div>
          <div className="us-opts">
            <Switch checked={auto} onChange={setAuto} disabled={done || reduced}>Auto-guide (assisted hand)</Switch>
            <label className="us-gain">Gain
              <input type="range" min={0.6} max={1.6} step={0.05} value={gain} onChange={(e) => setGain(Number(e.target.value))} />
            </label>
          </div>
          <div className="us-actions">
            {!done && <Button size="sm" onClick={() => void capture()} disabled={!canCapture}><Check size={16} aria-hidden="true" /> Capture now</Button>}
            {done && <Button size="sm" onClick={() => setRound((r) => r + 1)}>Scan again</Button>}
          </div>
          {error && <p className="us-err" role="alert">{error}</p>}
        </div>
      </HudPanel>

      <div className="us-side">
        <HudPanel title="Measurements" meta={done ? 'This scan' : 'After capture'} className="us-res" tone={done && saved.status !== 'nominal' ? saved.status : undefined}>
          {done ? (
            <>
              <div className="us-verdict"><StatusTag status={saved.status} /><span>{saved.status === 'nominal' ? 'Within the expected range.' : 'Outside the expected range. Show the flight surgeon.'}</span></div>
              <KpiGrid>
                {saved.values.map((v) => {
                  const m = exam.measures.find((x) => x.id === v.id)!
                  const delta = !m.flag && v.baseline ? ((v.value - v.baseline) / v.baseline) * 100 : null
                  return (
                    <KpiCell key={v.id} label={m.label} status={v.status}
                      value={m.flag ? (v.value >= 0.5 ? 'Present' : 'Absent') : `${fmt(v.value, m.dec)}`}
                      sub={m.flag ? undefined : `${m.unit} · preflight ${fmt(v.baseline, m.dec)}${delta !== null ? ` (${delta >= 0 ? '+' : ''}${delta.toFixed(0)}%)` : ''}`} />
                  )
                })}
              </KpiGrid>
              <div className="us-actions">
                <Button variant="ghost" size="sm" onClick={() => void flag()} disabled={saved.flagged}><Flag size={16} aria-hidden="true" /> {saved.flagged ? 'Flagged for flight surgeon' : 'Flag for flight surgeon'}</Button>
                <Link to="/sync" className={buttonClass('ghost', 'sm')}>Ground sync</Link>
              </div>
            </>
          ) : <p className="us-empty">Line up the probe until the picture is clear. The scan is captured by itself after {HOLD_S} s of a good view.</p>}
        </HudPanel>

        <HudPanel title="Simulated finding" meta="Demo control" className="us-case">
          <Segmented label="Finding to simulate" value={finding} onChange={(f) => { setFinding(f); setRound((r) => r + 1) }}
            options={[{ id: 'expected', label: 'Expected for day ' + Math.round(missionDay(now)) }, { id: 'concerning', label: 'Concerning' }]} />
          <p className="us-text">The picture and the numbers come from a model of this crew member, not a real probe. Use <b>Concerning</b> to see how out-of-range results are flagged.</p>
        </HudPanel>

        <HudPanel title="History" meta={history.length ? `${history.length} saved` : 'None yet'} className="us-hist">
          {exam.measures.map((m) => (
            <div key={m.id} className="us-hrow">
              <span className="us-hl">{m.label}</span>
              <Sparkline label={m.label} unit={m.unit} baseline={baselineFor(crewId, m)} values={history.map((s) => s.values.find((v) => v.id === m.id)?.value).filter((v): v is number => v !== undefined)} />
            </div>
          ))}
          {history.length > 0 && (
            <ol className="us-list">
              {[...history].reverse().slice(0, 4).map((s) => (
                <li key={s.id}><span className="us-when">{met(s.ts)}</span><StatusTag status={s.status} short />{s.flagged && <span className="us-flagged">flagged</span>}</li>
              ))}
            </ol>
          )}
          <p className="us-note">Results are logged for Ground. They never raise alerts or change baselines, and need a real probe and clinical validation.</p>
        </HudPanel>
      </div>
    </div>
  )
}
