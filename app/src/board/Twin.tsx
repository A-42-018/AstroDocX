import type { Hazard, Status } from '../data/types'
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
/** Where each hazard sits on the body, and which side its label goes. Radiation is a whole-body aura (the outline glows), pinned at the abdomen. */
const SPOTS: { id: Hazard; x: number; y: number; side: 'l' | 'r' }[] = [
  { id: 'I', x: 150, y: 52, side: 'l' },
  { id: 'D', x: 214, y: 46, side: 'r' },
  { id: 'E', x: 150, y: 178, side: 'r' },
  { id: 'R', x: 150, y: 290, side: 'l' },
  { id: 'G', x: 172, y: 470, side: 'r' },
]
const WORD: Record<Status, string> = { nominal: 'NOMINAL', watch: 'WATCH', act: 'ACT' }

/** Health twin: translucent body with one hotspot per RIDGE hazard, coloured by status; each label jumps to its card. */
export function Twin({ tiles, overall }: { tiles: HazardTile[]; overall: Status }) {
  const by = new Map(tiles.map((t) => [t.hazard, t]))
  const rad = by.get('R')?.status ?? 'nominal'
  return (
    <div className="twin" role="group" aria-label="Health twin">
      <div className={`twin-fig st-${overall}`}>
        <svg viewBox={`0 0 ${VB_W} ${VB_H}`} aria-hidden="true">
          <defs>
            <linearGradient id="twin-fill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stopColor="#2dd4e8" stopOpacity="0.28" />
              <stop offset="1" stopColor="#2dd4e8" stopOpacity="0.04" />
            </linearGradient>
            <clipPath id="twin-clip"><path d={BODY_D} /></clipPath>
          </defs>
          <path d={BODY_D} className={`twin-aura st-${rad}`} />
          <path d={BODY_D} fill="url(#twin-fill)" className="twin-body" fillRule="evenodd" />
          <g clipPath="url(#twin-clip)"><rect className="twin-scan" x="0" y="0" width={VB_W} height="46" /></g>
          {SPOTS.map((s) => {
            const st = by.get(s.id)?.status ?? 'nominal'
            const x2 = s.side === 'l' ? -14 : VB_W + 14
            return (
              <g key={s.id} className={`twin-spot st-${st}`}>
                <line x1={s.x} y1={s.y} x2={x2} y2={s.y} className="twin-leader" />
                <circle cx={s.x} cy={s.y} r="15" className="twin-halo" />
                <circle cx={s.x} cy={s.y} r="6" className="twin-dot" />
              </g>
            )
          })}
        </svg>
        {SPOTS.map((s) => {
          const t = by.get(s.id)
          if (!t) return null
          return (
            <a key={s.id} href={`#hz-${s.id}`} className={`twin-chip ${s.side} st-${t.status}`} style={{ top: `${(s.y / VB_H) * 100}%` }} aria-label={`Jump to ${t.name} card, ${WORD[t.status]}`}>
              <HazardIcon hazard={s.id} status={t.status} />
              <span className="twin-chip-text" aria-hidden="true"><b>{t.name}</b><StatusPill status={t.status} /></span>
            </a>
          )
        })}
      </div>
    </div>
  )
}
