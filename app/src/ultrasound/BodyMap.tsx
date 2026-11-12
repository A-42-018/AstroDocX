import { useEffect, useRef, useState } from 'react'
import * as A from '../board/anatomy'
import { HAZARD_INDEX, loadBody, toBox, turned, twinRenderer, type Body3D } from '../board/body3d'
import { BODY_D } from '../board/Twin'
import { useHeartbeat } from '../live/heartbeat'
import { isHidden, useHidden, useReducedMotion } from '../live/usePaused'
import { EXAMS, type ExamId } from './exams'

const VB_W = 300
const VB_H = 660
/** Probe sites on the baked body, in body units (x to the crew member's left, y up, z out of the chest), so they turn with it. */
const SITES: Record<ExamId, [number, number, number]> = {
  cardiac: [0.1, 0.76, 0.13],
  vascular: [0.075, 1.33, 0.06],
  lung: [-0.19, 0.86, 0.12],
  muscle: [-0.2, -0.68, 0.12],
  ocular: [-0.055, 1.6, 0.13],
}
/** The twin shader lights a hazard's part of the body: borrow that to light the organ the exam looks at. */
const LIGHT: Partial<Record<ExamId, number>> = { lung: HAZARD_INDEX.E, ocular: HAZARD_INDEX.I, muscle: HAZARD_INDEX.G }
const NOMINAL = { I: 'nominal', D: 'nominal', E: 'nominal', R: 'nominal', G: 'nominal' } as const

/**
 * The probe sites on the health twin's body: the same baked human the board shows (skin, skeleton, organs and
 * arteries as a particle hologram), turning gently with a beating heart. The active site pulses and the organ it
 * scans lights up. Without WebGL (and in tests) the twin's SVG anatomy stands in. Decorative: the picker names the exam.
 */
export function BodyMap({ active, onPick, hr = 62 }: { active: ExamId; onPick: (id: ExamId) => void; hr?: number }) {
  const [body, setBody] = useState<Body3D | null>(null)
  const [failed, setFailed] = useState(false)
  const canvas = useRef<HTMLCanvasElement>(null)
  const host = useRef<HTMLDivElement>(null)
  const marks = useRef<Partial<Record<ExamId, SVGGElement | null>>>({})
  const beatAt = useRef(-1e9)
  const activeRef = useRef(active)
  const redraw = useRef<() => void>(() => {})
  const reduced = useReducedMotion()
  const hidden = useHidden()
  useEffect(() => { let on = true; void loadBody().then((b) => { if (on) setBody(b) }); return () => { on = false } }, [])
  useHeartbeat(hr, !reduced && !hidden, () => { beatAt.current = performance.now() })
  const live = !!body && !failed

  useEffect(() => {
    const place = (ang: number) => {
      for (const e of EXAMS) {
        const [x, y] = live ? turned(SITES[e.id], ang) : toBox(SITES[e.id][0], SITES[e.id][1])
        marks.current[e.id]?.setAttribute('transform', `translate(${x.toFixed(1)} ${y.toFixed(1)})`)
      }
    }
    let r: ReturnType<typeof twinRenderer> | null = null
    if (live && canvas.current) {
      try { r = twinRenderer(canvas.current, body!); r.resize(); r.setStatus(NOMINAL) } catch { queueMicrotask(() => setFailed(true)); return }
    }
    let seen = true
    const io = typeof IntersectionObserver === 'undefined' || !host.current ? null : new IntersectionObserver((es) => { seen = es[es.length - 1].isIntersecting })
    if (host.current) io?.observe(host.current)
    const t0 = performance.now()
    const frame = (now: number) => {
      const t = (now - t0) / 1000, ang = reduced ? 0.1 : 0.1 + 0.28 * Math.sin(t * 0.32)
      r?.draw(t, ang, reduced ? 9 : (now - beatAt.current) / 1000, LIGHT[activeRef.current] ?? -1)
      place(ang)
    }
    const ro = typeof ResizeObserver === 'undefined' || !host.current ? null : new ResizeObserver(() => { r?.resize(); frame(performance.now()) })
    if (host.current) ro?.observe(host.current)
    let raf = 0, last = 0
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop)
      if (isHidden() || !seen || now - last < 1000 / 30 - 2) return
      last = now; frame(now)
    }
    frame(performance.now())
    redraw.current = () => frame(performance.now())
    if (r && !reduced) raf = requestAnimationFrame(loop)
    return () => { cancelAnimationFrame(raf); ro?.disconnect(); io?.disconnect(); r?.dispose(); redraw.current = () => {} }
  }, [body, live, reduced])

  useEffect(() => { activeRef.current = active; redraw.current() }, [active])

  return (
    <div ref={host} className={`us-body${live ? ' is-3d' : ''}`} role="group" aria-label="Probe sites on the body">
      <canvas ref={canvas} className="us-body-cv" aria-hidden="true" />
      {!live && (
        <svg className="us-body-svg" viewBox={`0 0 ${VB_W} ${VB_H}`} aria-hidden="true">
          <defs><clipPath id="us-body-clip"><path d={BODY_D} /></clipPath></defs>
          <path d={BODY_D} className="us-skin" fillRule="evenodd" />
          <g clipPath="url(#us-body-clip)">
            <path d={A.BRAIN} className={`us-org brain${active === 'ocular' ? ' on' : ''}`} />
            <path d={A.LUNGS} className={`us-org lung${active === 'lung' ? ' on' : ''}`} />
            <path d={A.LIVER} className="us-org soft" />
            <path d={A.STOMACH} className="us-org soft" />
            <g className="us-bone">
              <path d={A.SKULL} />
              {A.VERTEBRAE.map((v, i) => <rect key={i} x={v.x} y={v.y} width={v.w} height={v.h} rx="1.6" />)}
              <path d={A.CLAVICLES} /><path d={A.RIBS} /><path d={A.PELVIS} /><path d={A.ARM_BONES} />
              <path d={A.LEG_BONES} className={active === 'muscle' ? 'on' : undefined} />
            </g>
            <g className={`us-art${active === 'vascular' ? ' on' : ''}`}>{A.ARTERIES.map((d, i) => <path key={i} d={d} />)}</g>
            <path d={A.HEART} transform={`translate(${A.HEART_AT.x} ${A.HEART_AT.y}) scale(0.92)`} className={`us-heart${active === 'cardiac' ? ' on' : ''}`} />
          </g>
        </svg>
      )}
      <svg className="us-body-sites" viewBox={`0 0 ${VB_W} ${VB_H}`}>
        {EXAMS.map((e) => (
          <g key={e.id} ref={(g) => { marks.current[e.id] = g }}>
            <title>{e.label}</title>
            {active === e.id && <circle className="us-ping" r="16" />}
            <circle className={active === e.id ? 'us-site on' : 'us-site'} r="9" onClick={() => onPick(e.id)} />
          </g>
        ))}
      </svg>
    </div>
  )
}
