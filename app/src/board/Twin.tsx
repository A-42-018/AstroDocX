import { useEffect, useRef, useState } from 'react'
import type { Hazard, Status } from '../data/types'
import { useHeartbeat } from '../live/heartbeat'
import { useHidden, useReducedMotion } from '../live/usePaused'
import * as A from './anatomy'
import { useBoard } from './store'
import { HudPanel } from '../ui/HudPanel'
import { STATUS_WORD } from '../ui/status'
import { StatusTag } from '../ui/StatusTag'
import type { HazardTile } from './snapshot'
import { HAZARD_INDEX, loadBody, turned, twinRenderer, type Body3D } from './body3d'

/** Body outline: control points for the right half (dx from the centre line, y), mirrored and smoothed with a closed Catmull-Rom spline. */
const RIGHT: [number, number][] = [
  [13, 88], [15, 104], [36, 114], [58, 122], [70, 134], [76, 160], [80, 200], [85, 240], [89, 275], [93, 315],
  [98, 345], [102, 362], [100, 380], [92, 388], [86, 374], [84, 350], [78, 318], [72, 282], [66, 246], [60, 205],
  [55, 170], [52, 200], [48, 245], [50, 280], [56, 310], [60, 350], [58, 400], [52, 455], [52, 500], [48, 555],
  [40, 600], [48, 620], [46, 634], [14, 634], [16, 604], [16, 550], [14, 480], [12, 420], [9, 370], [0, 345],
]
const CX = 150
function bodyPath(): string {
  const P: [number, number][] = RIGHT.map(([dx, y]) => [CX + dx, y])
  for (let i = RIGHT.length - 2; i >= 0; i--) P.push([CX - RIGHT[i][0], RIGHT[i][1]])
  const n = P.length
  const f = (v: number) => v.toFixed(1)
  let d = `M${f(P[0][0])} ${f(P[0][1])}`
  for (let i = 0; i < n; i++) {
    const p0 = P[(i - 1 + n) % n], p1 = P[i], p2 = P[(i + 1) % n], p3 = P[(i + 2) % n]
    d += `C${f(p1[0] + (p2[0] - p0[0]) / 6)} ${f(p1[1] + (p2[1] - p0[1]) / 6)} ${f(p2[0] - (p3[0] - p1[0]) / 6)} ${f(p2[1] - (p3[1] - p1[1]) / 6)} ${f(p2[0])} ${f(p2[1])}`
  }
  return d + 'Z'
}
export const BODY_D = bodyPath() + 'M121 56a29 37 0 1 0 58 0a29 37 0 1 0 -58 0Z'

const VB_W = 300
const VB_H = 660
/** Where each hazard sits on the SVG twin, and which side its callout goes (the 3D twin uses the rig's anchors). */
const SPOTS: { id: Hazard; x: number; y: number; side: 'l' | 'r' }[] = [
  { id: 'I', x: 150, y: 40, side: 'l' },
  { id: 'R', x: 74, y: 270, side: 'l' },
  { id: 'E', x: 176, y: 194, side: 'r' },
  { id: 'D', x: 173, y: 58, side: 'r' },
  { id: 'G', x: 182, y: 468, side: 'r' },
]
type Spot = (typeof SPOTS)[number]
const SCAN_S = 5.5

/** One beat: the heart contracts twice (lub-dub), it flashes, and a pulse wave runs out along every artery. */
function useBeatAnimation(hr: number) {
  const heart = useRef<SVGGElement>(null)
  const glow = useRef<SVGCircleElement>(null)
  const pulses = useRef<SVGGElement>(null)
  const beatAt = useRef(-1e9)
  const reduced = useReducedMotion()
  const hidden = useHidden()
  useHeartbeat(hr, !reduced && !hidden, () => {
    beatAt.current = performance.now()
    const period = 60_000 / Math.max(30, hr)
    heart.current?.animate?.(
      [{ transform: 'scale(1)' }, { transform: 'scale(1.13)', offset: 0.12 }, { transform: 'scale(0.97)', offset: 0.26 }, { transform: 'scale(1.07)', offset: 0.38 }, { transform: 'scale(1)' }],
      { duration: Math.min(700, period * 0.85), easing: 'ease-out' },
    )
    glow.current?.animate?.([{ opacity: 0.85 }, { opacity: 0 }], { duration: Math.min(700, period * 0.85), easing: 'ease-out' })
    for (const p of pulses.current?.querySelectorAll('path') ?? []) {
      p.animate?.([{ strokeDashoffset: 0, opacity: 1 }, { strokeDashoffset: -1000, opacity: 0.2 }], { duration: Math.min(1100, period * 1.1), easing: 'cubic-bezier(.3,.6,.4,1)' })
    }
  })
  return { heart, glow, pulses, beatAt, reduced }
}

/**
 * The 3D twin: the baked human (body3d.ts) as a particle hologram that turns gently, with a scan line sweeping
 * down it. Each hazard colours its own part and the heart beats with the ECG. Every frame the five anchors are
 * turned with the same angle the shader gets (`turned`) and the markers and leader lines move through refs, so
 * the lines stay on the body without a React render. Until the body has loaded and WebGL works (and in tests)
 * the SVG twin shows and the markers sit at its fixed spots.
 */
function useParticleTwin(statuses: Record<Hazard, Status>, focus: Hazard | null, beatAt: { current: number }, reduced: boolean) {
  const [body, setBody] = useState<Body3D | null>(null)
  const [failed, setFailed] = useState(false)
  const canvas = useRef<HTMLCanvasElement>(null)
  const root = useRef<HTMLDivElement>(null)
  const fig = useRef<HTMLDivElement>(null)
  const spots = useRef<Partial<Record<Hazard, SVGGElement | null>>>({})
  const chips = useRef<Partial<Record<Hazard, HTMLElement | null>>>({})
  const scanLine = useRef<SVGLineElement>(null)
  const state = useRef({ statuses, focus })
  const redraw = useRef<() => void>(() => {})
  useEffect(() => { state.current = { statuses, focus } })
  useEffect(() => { let on = true; void loadBody().then((b) => { if (on) setBody(b) }); return () => { on = false } }, [])
  const statusKey = SPOTS.map((s) => statuses[s.id]).join()
  const live = !!body && !failed

  useEffect(() => {
    const host = root.current, box = fig.current
    if (!host || !box) return
    // Layout, measured on resize: the figure's box and each callout's edge, in the bay's own pixels.
    let F = { x: 0, y: 0, w: 1, h: 1 }
    let C: Partial<Record<Hazard, { x: number; y: number }>> = {}
    const measure = () => {
      const o = host.getBoundingClientRect(), f = box.getBoundingClientRect()
      F = { x: f.left - o.left, y: f.top - o.top, w: f.width || 1, h: f.height || 1 }
      C = {}
      for (const s of SPOTS) {
        const r = chips.current[s.id]?.getBoundingClientRect()
        if (r && r.width) C[s.id] = { x: (s.side === 'l' ? r.right : r.left) - o.left, y: r.top - o.top + Math.min(r.height / 2, 34) }
      }
    }
    const place = (ang: number) => {
      for (const s of SPOTS) {
        const g = spots.current[s.id], c = C[s.id]
        if (!g) continue
        const [bx, by] = live ? turned(body!.anchors[s.id], ang) : [s.x, s.y]
        const x = (F.x + (bx / VB_W) * F.w).toFixed(1), y = (F.y + (by / VB_H) * F.h).toFixed(1)
        g.querySelectorAll('.twin-mark circle').forEach((n) => { n.setAttribute('cx', x); n.setAttribute('cy', y) })
        if (!c) continue
        const knee = c.x + (s.side === 'l' ? 18 : -18)
        g.querySelector('polyline')?.setAttribute('points', `${c.x.toFixed(1)},${c.y.toFixed(1)} ${knee.toFixed(1)},${c.y.toFixed(1)} ${x},${y}`)
        const end = g.querySelector('.twin-end')
        end?.setAttribute('cx', c.x.toFixed(1)); end?.setAttribute('cy', c.y.toFixed(1))
      }
    }
    const sweep = (scan: number) => {
      const l = scanLine.current
      if (!l) return
      const y = (F.y + scan * F.h).toFixed(1)
      l.setAttribute('x1', (F.x - F.w * 0.1).toFixed(1)); l.setAttribute('x2', (F.x + F.w * 1.1).toFixed(1))
      l.setAttribute('y1', y); l.setAttribute('y2', y)
    }

    let r: ReturnType<typeof twinRenderer> | null = null
    if (live && canvas.current) {
      try { r = twinRenderer(canvas.current, body!); r.resize() } catch { queueMicrotask(() => setFailed(true)); return }   // no WebGL: back to the SVG twin
    }
    let seen = true
    const io = typeof IntersectionObserver === 'undefined' ? null : new IntersectionObserver((es) => { seen = es[es.length - 1].isIntersecting })
    io?.observe(host)
    let applied = ''
    const t0 = performance.now()
    function frame(now: number) {
      const t = (now - t0) / 1000, ang = reduced ? 0.12 : 0.12 + 0.3 * Math.sin(t * 0.3)
      const scan = reduced ? -1 : (t % SCAN_S) / SCAN_S
      if (r) {
        const { statuses: st, focus: fo } = state.current, key = SPOTS.map((s) => st[s.id]).join()
        if (key !== applied) { r.setStatus(st); applied = key }
        r.draw(t, ang, reduced ? 9 : (now - beatAt.current) / 1000, fo ? HAZARD_INDEX[fo] : -1, scan)
        if (scan >= 0) sweep(scan)
      }
      place(ang)
    }
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => { r?.resize(); measure(); frame(performance.now()) })
    ro?.observe(host)
    measure()
    let raf = 0, last = 0
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop)
      if (document.hidden || !seen || now - last < 1000 / 30 - 2) return
      last = now; frame(now)
    }
    frame(performance.now())
    redraw.current = () => { measure(); frame(performance.now()) }
    if (r && !reduced) raf = requestAnimationFrame(loop)
    return () => { cancelAnimationFrame(raf); ro?.disconnect(); io?.disconnect(); r?.dispose(); redraw.current = () => {} }
  }, [body, live, reduced, beatAt])

  /* the SVG twin and reduced motion draw on demand: redraw when a status or the linked hazard changes (callouts may resize) */
  useEffect(() => { redraw.current() }, [statusKey, focus])
  return { live, body, canvas, root, fig, spots, chips, scanLine }
}

const sigmaText = (s: number) => `${s < 0 ? '−' : '+'}${Math.abs(s).toFixed(1)}σ`

/** One callout: the hazard's name, tag and headline value with its σ, linked to its card. Phones show the code and, off nominal, the tag. */
function Callout({ t, s, linked, chipRef, setFocus }:
  { t: HazardTile; s: Spot; linked: boolean; chipRef: (el: HTMLAnchorElement | null) => void; setFocus: (h: Hazard | null) => void }) {
  return (
    <a ref={chipRef} href={`#hz-${s.id}`} className={`tc tc-${s.side} tc-${s.id} st-${t.status}${linked ? ' is-linked' : ''}`}
      onMouseEnter={() => setFocus(s.id)} onMouseLeave={() => setFocus(null)} onFocus={() => setFocus(s.id)} onBlur={() => setFocus(null)}>
      <span className="sr-only">{`Jump to ${t.name} card, ${STATUS_WORD[t.status]}`}</span>
      <span className="tc-row" aria-hidden="true">
        <b className="tc-code">{s.id}</b><b className="tc-name">{t.name}</b><StatusTag status={t.status} short />
      </span>
      <span className="tc-val" aria-hidden="true">
        {t.value}<small>{[t.unit, t.sigma !== undefined ? sigmaText(t.sigma) : null].filter(Boolean).join(' · ')}</small>
      </span>
      {t.status !== 'nominal' && <span className="tc-sub" aria-hidden="true">{t.label}</span>}
    </a>
  )
}

/**
 * Health Twin bay (plan §4.2): the particle hologram on floor rings, a ringed marker on each hazard's part of the
 * body and a leader line from each marker to its callout. Callouts link to the hazard modules below and light them
 * on hover and focus (and the reverse). The SVG hologram (organs, skeleton, beating heart) stands in without WebGL.
 */
export function Twin({ tiles, overall, hr = 62, name, top }:
  { tiles: HazardTile[]; overall: Status; hr?: number; name?: string; top?: { name: string; status: Status } | null }) {
  const by = new Map(tiles.map((t) => [t.hazard, t]))
  const st = (h: Hazard) => by.get(h)?.status ?? 'nominal'
  const { heart, glow, pulses, beatAt, reduced } = useBeatAnimation(hr)
  const focus = useBoard((s) => s.focusHazard)
  const setFocus = useBoard((s) => s.setFocusHazard)
  const statuses = { I: st('I'), D: st('D'), E: st('E'), R: st('R'), G: st('G') } as Record<Hazard, Status>
  const { live, body, canvas, root, fig, spots, chips, scanLine } = useParticleTwin(statuses, focus, beatAt, reduced)
  const meta = ['Live', live && body ? `${body.n.toLocaleString('en-US')} pt scan` : null, `HR ${Math.round(hr)}`].filter(Boolean).join(' · ')
  return (
    <HudPanel hero className={`bay st-${overall}`} title={`Health twin // ${name ?? 'crew'}`} meta={meta}>
      <div ref={root} className="twin" role="group" aria-label="Health twin">
        <div ref={fig} className={`twin-fig st-${overall}${live ? ' is-3d' : ''}`}>
          <svg className="twin-floor" viewBox="0 0 360 70" aria-hidden="true">
            <ellipse cx="180" cy="35" rx="178" ry="32" className="floor-ring outer" />
            <ellipse cx="180" cy="35" rx="140" ry="25" className="floor-ring spin" />
            <ellipse cx="180" cy="35" rx="96" ry="17" className="floor-ring disc" />
            <ellipse cx="180" cy="35" rx="52" ry="9" className="floor-ring inner" />
          </svg>
          <canvas ref={canvas} className="twin-canvas" aria-hidden="true" />
          {!live && (
            <svg className="twin-svg" viewBox={`0 0 ${VB_W} ${VB_H}`} aria-hidden="true">
              <defs>
                <linearGradient id="twin-fill" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0" stopColor="#7fe8ff" stopOpacity="0.22" />
                  <stop offset="0.55" stopColor="#2dd4e8" stopOpacity="0.1" />
                  <stop offset="1" stopColor="#2dd4e8" stopOpacity="0.04" />
                </linearGradient>
                <radialGradient id="twin-heart-calm" cx="0.4" cy="0.35" r="0.7">
                  <stop offset="0" stopColor="#c8f7ff" />
                  <stop offset="0.45" stopColor="#2dd4e8" />
                  <stop offset="1" stopColor="#0b6f85" />
                </radialGradient>
                <radialGradient id="twin-heart" cx="0.4" cy="0.35" r="0.7">
                  <stop offset="0" stopColor="#ffb3bc" />
                  <stop offset="0.45" stopColor="#ff4d5e" />
                  <stop offset="1" stopColor="#a3122a" />
                </radialGradient>
                <linearGradient id="twin-scan-g" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0" stopColor="#7fe8ff" stopOpacity="0" />
                  <stop offset="0.92" stopColor="#7fe8ff" stopOpacity="0.22" />
                  <stop offset="1" stopColor="#bff6ff" stopOpacity="0.8" />
                </linearGradient>
                <clipPath id="twin-clip"><path d={BODY_D} /></clipPath>
              </defs>

              <path d={BODY_D} className={`twin-aura st-${st('R')}`} />
              <path d={BODY_D} fill="url(#twin-fill)" className="twin-body" fillRule="evenodd" />

              <g clipPath="url(#twin-clip)">
                {/* organs */}
                <path d={A.BRAIN} className={`org brain st-${st('I')}`} />
                <path d={A.BRAIN_FOLDS} className={`org-line st-${st('I')}`} />
                <path d={A.LUNGS} className={`org lung st-${st('E')}`} />
                <path d={A.BRONCHI} className={`org-line st-${st('E')}`} />
                <path d={A.LIVER} className="org soft liver" />
                <path d={A.STOMACH} className="org soft" />
                {A.KIDNEYS.map((k, i) => <ellipse key={i} cx={k.cx} cy={k.cy} rx="6" ry="10" className="org soft" />)}
                <path d={A.INTESTINE} className="org-line soft" />

                {/* skeleton */}
                <g className="bone">
                  <path d={A.SKULL} />
                  <path d={A.JAW} className="bone-line" />
                  {A.EYES.map((e, i) => <ellipse key={i} cx={e.cx} cy={e.cy} rx="6" ry="4.6" />)}
                  <path d={A.NOSE} />
                  {A.VERTEBRAE.map((v, i) => <rect key={i} x={v.x} y={v.y} width={v.w} height={v.h} rx="1.6" />)}
                  <path d={A.CLAVICLES} className="bone-line" />
                  <rect x={A.STERNUM.x} y={A.STERNUM.y} width={A.STERNUM.w} height={A.STERNUM.h} rx="3" />
                  <path d={A.RIBS} className="bone-line rib" />
                  <path d={A.PELVIS} />
                  <path d={A.SACRUM} />
                  <path d={A.ARM_BONES} className="bone-line" />
                  {A.ARM_JOINTS.map((j, i) => <circle key={i} cx={j.cx} cy={j.cy} r={j.r} />)}
                </g>
                <g className={`bone legs st-${st('G')}`}>
                  <path d={A.LEG_BONES} className="bone-line" />
                  {A.LEG_JOINTS.map((j, i) => <circle key={i} cx={j.cx} cy={j.cy} r={j.r} />)}
                </g>

                {/* circulation: veins flow back, arteries carry the pulse */}
                <g className="veins">{A.VEINS.map((d, i) => <path key={i} d={d} />)}</g>
                <g className="arteries">{A.ARTERIES.map((d, i) => <path key={i} d={d} />)}</g>
                <g ref={pulses} className="pulses">{A.ARTERIES.map((d, i) => <path key={i} d={d} pathLength={1000} />)}</g>

                {/* heart */}
                <g transform={`translate(${A.HEART_AT.x} ${A.HEART_AT.y}) scale(0.92)`}>
                  <circle ref={glow} r="26" className="heart-glow" />
                  <g ref={heart} className={`heart${st('E') === 'act' ? ' heart-alert' : ''}`}>
                    <path d={A.HEART_VESSELS} className="heart-vessels" />
                    <path d={A.HEART} fill={st('E') === 'act' ? 'url(#twin-heart)' : 'url(#twin-heart-calm)'} />
                    <path d={A.HEART_LINES} className="heart-line" />
                  </g>
                </g>

                {A.SPARKS.map((p, i) => <circle key={i} cx={p.cx} cy={p.cy} r={p.r} className="spark" style={{ animationDelay: `${p.delay}s` }} />)}
                <rect className="twin-scan" x="0" y="0" width={VB_W} height="46" />
              </g>
            </svg>
          )}
        </div>
        <svg className="twin-lines" aria-hidden="true">
          {live && !reduced && <line ref={scanLine} className="twin-scanline" />}
          {SPOTS.map((s) => (
            <g key={s.id} ref={(g) => { spots.current[s.id] = g }} className={`twin-spot st-${st(s.id)}${focus === s.id ? ' is-linked' : ''}`}>
              <polyline className="twin-leader" />
              <circle r="2.5" className="twin-end" />
              <g className="twin-mark">
                <circle r="11" className="twin-halo" />
                <circle r="6.5" className="twin-ring" />
                <circle r="2.6" className="twin-dot" data-spot={s.id} />
              </g>
            </g>
          ))}
        </svg>
        {SPOTS.map((s) => {
          const t = by.get(s.id)
          return t ? <Callout key={s.id} t={t} s={s} linked={focus === s.id} setFocus={setFocus} chipRef={(el) => { chips.current[s.id] = el }} /> : null
        })}
      </div>
      <footer className="baybar">
        <span>◇ Live hologram</span>
        {top
          ? <span className={`baybar-hot st-${top.status}`}>● {top.name} hotspot → next action</span>
          : <span className="baybar-hot st-nominal">● All hazards within own baseline</span>}
        <span className="baybar-r">Own baseline · 14 d</span>
      </footer>
    </HudPanel>
  )
}
