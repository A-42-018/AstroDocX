import { useRef } from 'react'
import type { Hazard, Status } from '../data/types'
import { useHeartbeat } from '../live/heartbeat'
import { useHidden, useReducedMotion } from '../live/usePaused'
import * as A from './anatomy'
import { useBoard } from './store'
import { HazardIcon, StatusPill } from '../shell/icons'
import type { HazardTile } from './snapshot'

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
/** Where each hazard sits on the body, and which side its label goes. Radiation is a faint whole-body aura (the outline glows), pinned on the left flank; Distance sits at the ear (the antenna); Environment sits on the lungs. */
const SPOTS: { id: Hazard; x: number; y: number; side: 'l' | 'r' }[] = [
  { id: 'I', x: 150, y: 40, side: 'l' },
  { id: 'D', x: 173, y: 58, side: 'r' },
  { id: 'E', x: 176, y: 194, side: 'r' },
  { id: 'R', x: 74, y: 270, side: 'l' },
  { id: 'G', x: 182, y: 468, side: 'r' },
]
const WORD: Record<Status, string> = { nominal: 'NOMINAL', watch: 'WATCH', act: 'ACT' }

/** One beat: the heart contracts twice (lub-dub), it flashes, and a pulse wave runs out along every artery. */
function useBeatAnimation(hr: number) {
  const heart = useRef<SVGGElement>(null)
  const glow = useRef<SVGCircleElement>(null)
  const pulses = useRef<SVGGElement>(null)
  const reduced = useReducedMotion()
  const hidden = useHidden()
  useHeartbeat(hr, !reduced && !hidden, () => {
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
  return { heart, glow, pulses }
}

/**
 * Health Twin: a translucent anatomical hologram. Skeleton, brain, lungs and organs sit inside a glass body;
 * the heart beats in step with the live ECG and sends a pulse wave down the arteries; veins flow back.
 * The parts each hazard concerns take its status colour (brain: Isolation, lungs: Environment, leg bones:
 * Gravity, whole-body aura: Radiation), and a labelled chip per hazard jumps to its card.
 */
export function Twin({ tiles, overall, hr = 62 }: { tiles: HazardTile[]; overall: Status; hr?: number }) {
  const by = new Map(tiles.map((t) => [t.hazard, t]))
  const st = (h: Hazard) => by.get(h)?.status ?? 'nominal'
  const { heart, glow, pulses } = useBeatAnimation(hr)
  const focus = useBoard((s) => s.focusHazard)
  const setFocus = useBoard((s) => s.setFocusHazard)
  return (
    <div className="twin" role="group" aria-label="Health twin">
      <div className={`twin-fig st-${overall}`}>
        <svg viewBox={`0 0 ${VB_W} ${VB_H}`} aria-hidden="true">
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
            <radialGradient id="twin-floor" cx="0.5" cy="0.5" r="0.5">
              <stop offset="0" stopColor="#2dd4e8" stopOpacity="0.35" />
              <stop offset="1" stopColor="#2dd4e8" stopOpacity="0" />
            </radialGradient>
            <linearGradient id="twin-scan-g" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stopColor="#7fe8ff" stopOpacity="0" />
              <stop offset="0.92" stopColor="#7fe8ff" stopOpacity="0.22" />
              <stop offset="1" stopColor="#bff6ff" stopOpacity="0.8" />
            </linearGradient>
            <clipPath id="twin-clip"><path d={BODY_D} /></clipPath>
          </defs>

          {/* holographic floor */}
          <g className="twin-floor">
            <ellipse cx="150" cy="642" rx="130" ry="22" fill="url(#twin-floor)" />
            <ellipse cx="150" cy="642" rx="112" ry="17" className="floor-ring" />
            <ellipse cx="150" cy="642" rx="84" ry="12" className="floor-ring spin" />
            <ellipse cx="150" cy="642" rx="54" ry="8" className="floor-ring" />
          </g>

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

          {SPOTS.map((s) => {
            const status = st(s.id)
            const x2 = s.side === 'l' ? -14 : VB_W + 14
            return (
              <g key={s.id} className={`twin-spot st-${status}${focus === s.id ? ' is-linked' : ''}`}>
                <line x1={s.x} y1={s.y} x2={x2} y2={s.y} className="twin-leader" />
                <circle cx={s.x} cy={s.y} r="13" className="twin-halo" />
                <circle cx={s.x} cy={s.y} r="5" className="twin-dot" data-spot={s.id} />
              </g>
            )
          })}
        </svg>
        {SPOTS.map((s) => {
          const t = by.get(s.id)
          if (!t) return null
          return (
            <a key={s.id} href={`#hz-${s.id}`} className={`twin-chip ${s.side} st-${t.status}${focus === s.id ? ' is-linked' : ''}`} style={{ top: `${(s.y / VB_H) * 100}%` }}
              onMouseEnter={() => setFocus(s.id)} onMouseLeave={() => setFocus(null)} onFocus={() => setFocus(s.id)} onBlur={() => setFocus(null)}>
              <span className="sr-only">{`Jump to ${t.name} card, ${WORD[t.status]}`}</span>
              <HazardIcon hazard={s.id} status={t.status} />
              <span className="twin-chip-text" aria-hidden="true"><b>{t.name}</b><StatusPill status={t.status} /></span>
            </a>
          )
        })}
      </div>
    </div>
  )
}
