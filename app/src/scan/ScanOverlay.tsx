import type { CSSProperties } from 'react'
import type { Phase } from './session'
import type { Verdict } from './roi'

/*
 * The scanning look drawn over the camera preview. Purely visual: nothing here feeds the measurement.
 * The viewBox is 400 x 300 (the preview's 4:3), so circles stay round.
 *   searching - amber dashed oval, a slow orbit ring, nothing locked yet
 *   locked    - green: face mesh, a beam sweeping the face, eye rings with a scan line
 *   measuring - the three skin patches pulse at the measured heart rate once it is reliable
 * The oval and the three patches sit exactly where roi.ts reads, so what you see is what is measured.
 */

const CX = 200, CY = 150, RX = 108, RY = 126
/** The patches, in viewBox units: roi.ts's fractions of 400 x 300. */
const PATCHES = [{ x: 152, y: 60, w: 96, h: 30 }, { x: 120, y: 150, w: 48, h: 36 }, { x: 232, y: 150, w: 48, h: 36 }] as const
const EYES = [{ x: 160, y: 128 }, { x: 240, y: 128 }] as const

export function ScanOverlay({ verdict, phase, bpm }: { verdict: Verdict; phase: Phase; bpm: number | null }) {
  const locked = verdict === 'ok'
  const beat = bpm && bpm > 30 && bpm < 200 ? ({ '--beat': `${(60 / bpm).toFixed(3)}s` } as CSSProperties) : undefined
  return (
    <>
      <svg className={`sc-guide ${locked ? 'ok' : 'bad'} ${phase}`} viewBox="0 0 400 300" aria-hidden="true">
        <defs>
          <clipPath id="sc-face"><ellipse cx={CX} cy={CY} rx={RX} ry={RY} /></clipPath>
          <linearGradient id="sc-trail" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0" stopColor="currentColor" stopOpacity="0.55" />
            <stop offset="1" stopColor="currentColor" stopOpacity="0" />
          </linearGradient>
          <pattern id="sc-mesh" width="14" height="14" patternUnits="userSpaceOnUse">
            <path d="M14 0H0V14" fill="none" stroke="currentColor" strokeWidth="0.5" />
          </pattern>
        </defs>

        {/* dim everything outside the oval so the face stands out */}
        <path className="sc-dim" fillRule="evenodd" d={`M0 0H400V300H0Z M${CX - RX} ${CY}a${RX} ${RY} 0 1 0 ${RX * 2} 0a${RX} ${RY} 0 1 0 ${-RX * 2} 0Z`} />

        {/* corner brackets of the scan window */}
        <path className="sc-corner" d="M12 40V12H40M360 12H388V40M388 260V288H360M40 288H12V260" />

        {/* orbit: two broken rings turning in opposite directions */}
        <g className="sc-orbit">
          <ellipse className="sc-ring a" cx={CX} cy={CY} rx={RX + 20} ry={RY + 14} />
          <ellipse className="sc-ring b" cx={CX} cy={CY} rx={RX + 30} ry={RY + 22} />
        </g>

        <ellipse className="sc-oval" cx={CX} cy={CY} rx={RX} ry={RY} />

        {/* face mesh, the sweeping beam and the centre cross, only once the face is locked */}
        <g className="sc-lock" clipPath="url(#sc-face)">
          <rect className="sc-meshfill" x={CX - RX} y={CY - RY} width={RX * 2} height={RY * 2} fill="url(#sc-mesh)" />
          <path className="sc-cross" d={`M${CX} ${CY - RY}V${CY + RY}M${CX - RX} ${CY}H${CX + RX}`} />
          <g className="sc-beam">
            <rect x={CX - RX} y={CY - RY - 46} width={RX * 2} height="46" fill="url(#sc-trail)" />
            <rect className="sc-edge" x={CX - RX} y={CY - RY - 1.5} width={RX * 2} height="3" />
          </g>
        </g>

        {/* eye scan: a ring round each eye, an arc turning inside it, and a line sweeping across both */}
        <g className="sc-eyes">
          {EYES.map((e, i) => (
            <g key={i} transform={`translate(${e.x} ${e.y})`}>
              <circle className="sc-eye-ring" r="17" />
              <circle className="sc-eye-arc" r="12" style={{ animationDirection: i ? 'reverse' : 'normal' }} />
              <path className="sc-eye-tick" d="M-24 0H-19M19 0H24M0 -24V-19M0 19V24" />
              <circle className="sc-eye-dot" r="1.8" />
            </g>
          ))}
          <line className="sc-eye-sweep" x1="124" x2="276" y1="128" y2="128" />
        </g>

        {/* the patches the scan reads; they beat with the heart once a rate is known */}
        <g className="sc-patches" style={beat}>
          {PATCHES.map((p, i) => (
            <g key={i} className={beat ? 'sc-patch beat' : 'sc-patch'}>
              <rect x={p.x} y={p.y} width={p.w} height={p.h} />
              <path d={`M${p.x} ${p.y + 5}V${p.y}H${p.x + 5}M${p.x + p.w - 5} ${p.y}H${p.x + p.w}V${p.y + 5}M${p.x + p.w} ${p.y + p.h - 5}V${p.y + p.h}H${p.x + p.w - 5}M${p.x + 5} ${p.y + p.h}H${p.x}V${p.y + p.h - 5}`} />
            </g>
          ))}
        </g>
      </svg>

      <p className={`sc-tag ${locked ? 'ok' : 'bad'}`} aria-hidden="true">
        <i />{phase === 'measuring' && locked ? 'Scanning' : locked ? 'Face locked' : 'Searching for face'}
      </p>
    </>
  )
}
