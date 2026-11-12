import { useEffect, useRef, useState } from 'react'
import type { Status } from '../data/types'
import { met } from '../engine/actions'
import { LiveWave } from '../live/LiveWave'
import { hashSeed } from '../live/telemetry'
import type { CabinData } from './data'

/*
 * The helmet visor at the first tour stop: a padded helmet rim around a tinted glass visor, and a HUD projected on
 * the glass, wired to AstroDocX. Readiness takes the place of a heading tape, the five hazard modules run down the
 * left edge, the ground link down the right, and the status bar carries the engine's next action.
 */

const LABEL: Record<Status, string> = { nominal: 'NOMINAL', watch: 'WATCH', act: 'ACT' }
const tone = (s: Status) => `var(--${s === 'nominal' ? 'ok' : s})`
const pad2 = (n: number) => String(n).padStart(2, '0')
const hms = (ms: number) => { const s = Math.floor(ms / 1000); return `${pad2(Math.floor(s / 3600))}:${pad2(Math.floor(s / 60) % 60)}:${pad2(s % 60)}` }

/** The visor opening in a 1000 x 1000 box: a superellipse with a slight chin rest pushing up at the bottom. */
function opening(scale = 1) {
  const a = 452 * scale, b = 468 * scale, n = 2.7, pts: string[] = []
  for (let i = 0; i < 120; i++) {
    const t = (i / 120) * Math.PI * 2, c = Math.cos(t), s = Math.sin(t)
    const x = a * Math.sign(c) * Math.abs(c) ** (2 / n)
    let y = b * Math.sign(s) * Math.abs(s) ** (2 / n)
    if (s > 0) y -= 34 * scale * Math.exp(-((x / (a * 0.3)) ** 2)) * s ** 4
    pts.push(`${(500 + x).toFixed(1)} ${(500 + y).toFixed(1)}`)
  }
  return `M${pts.join('L')}Z`
}
const EDGE = opening(), SEAMS = [opening(1.075), opening(1.17)]

/** True while the window is taller than it is wide (a phone held upright). */
function usePortrait() {
  const q = '(max-aspect-ratio: 1/1)'
  const [on, setOn] = useState(() => typeof window !== 'undefined' && !!window.matchMedia?.(q).matches)
  useEffect(() => {
    const m = window.matchMedia?.(q)
    if (!m) return
    const f = () => setOn(m.matches)
    m.addEventListener?.('change', f)
    return () => m.removeEventListener?.('change', f)
  }, [])
  return on
}

/**
 * Stretched to a tall window the round helmet became a narrow pill that ate the sides of the view. Upright, it keeps its
 * shape at the window's height instead (slice): the sides of the opening fall past the screen's edges, as they would
 * past the eye, and only the brow and chin of the rim show.
 */
function Helmet() {
  const portrait = usePortrait()
  return (
    <svg className="visor-svg" viewBox="0 0 1000 1000" preserveAspectRatio={portrait ? 'xMidYMid slice' : 'none'}>
      <defs>
        <radialGradient id="vz-glass" cx="50%" cy="46%" r="62%">
          <stop offset="0.55" stopColor="#06121c" stopOpacity="0.06" />
          <stop offset="0.85" stopColor="#04101a" stopOpacity="0.32" />
          <stop offset="1" stopColor="#02070c" stopOpacity="0.7" />
        </radialGradient>
        <radialGradient id="vz-pad" cx="50%" cy="50%" r="71%">
          <stop offset="0.62" stopColor="#262c33" />
          <stop offset="0.74" stopColor="#12171c" />
          <stop offset="1" stopColor="#020304" />
        </radialGradient>
        <linearGradient id="vz-edge" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0.05" stopColor="#e8f8ff" stopOpacity="0.95" />
          <stop offset="0.3" stopColor="#7d93a2" stopOpacity="0.45" />
          <stop offset="0.6" stopColor="#2a3540" stopOpacity="0.4" />
          <stop offset="0.92" stopColor="#d8efff" stopOpacity="0.75" />
        </linearGradient>
        <linearGradient id="vz-lip" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffe6b8" stopOpacity="0" />
          <stop offset="0.75" stopColor="#fff4dc" stopOpacity="0.55" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0.9" />
        </linearGradient>
        <filter id="vz-soft" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="6" /></filter>
        <clipPath id="vz-in"><path d={EDGE} /></clipPath>
      </defs>
      {/* the visor glass, a sheet that slides down inside the opening (--drop, set by scene.ts); its lower edge catches the light as it goes */}
      <g clipPath="url(#vz-in)">
        <g className="vz-glass">
          <path d={EDGE} fill="url(#vz-glass)" />
          {/* reflections on the curved glass: a soft arc top left, a fainter one bottom right */}
          <g filter="url(#vz-soft)">
            <path d="M70 420 C 90 190, 260 70, 470 52" fill="none" stroke="#cfeeff" strokeOpacity="0.14" strokeWidth="18" />
            <path d="M940 600 C 925 790, 800 905, 610 935" fill="none" stroke="#cfeeff" strokeOpacity="0.07" strokeWidth="14" />
          </g>
          <rect className="vz-glass-edge" x="0" y="986" width="1000" height="14" fill="url(#vz-lip)" />
        </g>
      </g>
      <path d={`M-20 -20H1020V1020H-20Z${EDGE}`} fillRule="evenodd" fill="url(#vz-pad)" />
      {SEAMS.map((d, i) => (
        <g key={i} fill="none" vectorEffect="non-scaling-stroke">
          <path d={d} stroke="#000" strokeOpacity="0.55" strokeWidth="3" vectorEffect="non-scaling-stroke" />
          <path d={d} stroke="#9fb4c4" strokeOpacity="0.06" strokeWidth="1" vectorEffect="non-scaling-stroke" transform="translate(0 2)" />
        </g>
      ))}
      <path d={EDGE} fill="none" stroke="#0a0e12" strokeWidth="16" vectorEffect="non-scaling-stroke" />
      <path d={EDGE} fill="none" stroke="url(#vz-edge)" strokeWidth="3" vectorEffect="non-scaling-stroke" />
      <path d={EDGE} fill="none" stroke="#36e2f5" strokeOpacity="0.18" strokeWidth="1" vectorEffect="non-scaling-stroke" transform="translate(500 500) scale(.985) translate(-500 -500)" />
    </svg>
  )
}

/** Readiness on a shallow arc, like a heading tape: zone band, ticks every 2.5, a needle at the score. */
function Gauge({ value, status }: { value: number; status: Status }) {
  const C = 200, CY = 520, R = 470, SPAN = 22
  const ang = (v: number) => ((v / 100 - 0.5) * 2 * SPAN * Math.PI) / 180
  const at = (v: number, r: number) => [C + r * Math.sin(ang(v)), CY - r * Math.cos(ang(v))] as const
  const arc = (a: number, b: number, r: number) => { const [x0, y0] = at(a, r), [x1, y1] = at(b, r); return `M${x0} ${y0}A${r} ${r} 0 0 1 ${x1} ${y1}` }
  const ticks = Array.from({ length: 41 }, (_, i) => i * 2.5)
  const v = Math.max(0, Math.min(100, value))
  return (
    <svg className="vz-gauge" viewBox="0 0 400 100">
      <path d={arc(0, 55, R + 7)} className="z act" /><path d={arc(55, 80, R + 7)} className="z watch" /><path d={arc(80, 100, R + 7)} className="z ok" />
      {ticks.map((t) => {
        const major = t % 10 === 0, [x0, y0] = at(t, R), [x1, y1] = at(t, R - (major ? 10 : 5))
        return <line key={t} x1={x0} y1={y0} x2={x1} y2={y1} className={major ? 'tk major' : 'tk'} />
      })}
      {[0, 50, 100].map((t) => { const [x, y] = at(t, R + 18); return <text key={t} x={x} y={y} textAnchor="middle">{t}</text> })}
      <g className="needle" style={{ transform: `rotate(${(v / 100 - 0.5) * 2 * SPAN}deg)`, transformOrigin: `${C}px ${CY}px`, color: tone(status) }}>
        <line x1={C} y1={CY - R - 14} x2={C} y2={CY - R + 14} />
        <path d={`M${C} ${CY - R + 15}l-8 13h16z`} />
      </g>
    </svg>
  )
}

/** The centre reticle: crosshair, an inner ring and a slowly turning tick ring. */
function Reticle() {
  const ticks = Array.from({ length: 48 }, (_, i) => i * 7.5)
  return (
    <svg className="vz-reticle" viewBox="-130 -130 260 260">
      <circle r="84" className="ring" />
      <g className="spin">{ticks.map((d) => <line key={d} x1="0" y1={-92} x2="0" y2={d % 45 === 0 ? -102 : -96} transform={`rotate(${d})`} />)}</g>
      <circle r="24" className="ring hi" />
      <path d="M0 -128V-34M0 34V128M-128 0H-34M34 0H128" className="cross" />
      <path d="M-4 0H4M0 -4V4" className="cross hi" />
    </svg>
  )
}

/** Ten segments filled to `pct`, in the status colour. */
const Segs = ({ pct, status, n = 10 }: { pct: number; status: Status; n?: number }) => (
  <span className="vz-segs" style={{ color: tone(status) }}>
    {Array.from({ length: n }, (_, i) => <i key={i} className={i < Math.round((pct / 100) * n) ? 'on' : undefined} />)}
  </span>
)

/** Ground link bars from hours since the last sync: five under 6 h, none if never synced. */
const linkBars = (h: number | null) => (h === null ? 0 : h < 6 ? 5 : h < 12 ? 4 : h < 24 ? 3 : h < 48 ? 2 : 1)

export function VisorHud({ data, reduced }: { data: CabinData | null; reduced: boolean }) {
  const [since] = useState(() => Date.now())
  const [clock, setClock] = useState(since)
  useEffect(() => {
    if (reduced) return
    const id = setInterval(() => setClock(Date.now()), 1000)
    return () => clearInterval(id)
  }, [reduced])
  const heart = useRef<HTMLSpanElement>(null)
  const beat = () => { const h = heart.current; if (!h) return; h.classList.remove('beat'); void h.offsetWidth; h.classList.add('beat') }

  const self = data?.crew.find((c) => c.id === data.selfId)
  const focus = data?.crew.find((c) => c.id === data.focusId)
  const off = data?.crew.filter((c) => c.status !== 'nominal').length ?? 0
  const status = self?.status ?? 'nominal'
  const readiness = self?.readiness ?? 0
  const open = data?.alerts.filter((a) => a.status !== 'resolved') ?? []
  const mine = open.find((a) => a.crewId === data?.selfId)
  const next = mine ? mine.next : open[0] ? `${open[0].title} · ${open[0].next}` : 'None, all clear'
  const bars = linkBars(data?.link.sinceSyncH ?? null)
  const f0 = (v?: number) => (v === undefined ? '–' : v.toFixed(0))
  const f1 = (v?: number) => (v === undefined ? '–' : v.toFixed(1))

  return (
    <>
      <Helmet />
      <div className="vz-hud">
        <div className="vz vz-tl">
          <b className="big">ASTRODOCX // CREW HEALTH</b>
          <span>{(self?.name ?? 'Crew').toUpperCase()} · {data ? met(data.now) : 'MET –'}</span>
          <span><i style={{ color: 'var(--ok)' }}>●</i> LINKED T+{hms(clock - since)}</span>
        </div>

        <div className="vz vz-tc">
          <small>READINESS</small>
          <b className="huge">{self ? readiness : '–'}<em>/100</em></b>
          <Gauge value={readiness} status={status} />
          <span className="state" style={{ color: tone(status) }}><i>■</i> HEALTH: {LABEL[status]}</span>
        </div>

        <div className="vz vz-tr">
          <b className="big"><span ref={heart} className="vz-heart">♥</span> {f0(self?.live.hr)} <em>BPM</em></b>
          <div className="vz-ecg">{self && <LiveWave kind="ecg" rate={self.live.hr} seed={hashSeed(self.id)} height={28} onBeat={beat} />}</div>
          <span><span className="nt">SpO₂</span> {f0(self?.live.spo2)}% <Segs pct={self ? (self.live.spo2 - 85) * (100 / 15) : 0} status={self && self.live.spo2 < 94 ? 'watch' : 'nominal'} /></span>
          <span>RESP {f0(self?.live.resp)} /MIN</span>
        </div>

        <div className="vz ladder left">
          <small>HAZARDS · RIDGE</small>
          {(data?.hazards ?? []).map((h, i, all) => (
            <span key={h.id} style={{ marginLeft: `${Math.abs(i - (all.length - 1) / 2) ** 2 * 7}px` }}>
              <b style={{ color: tone(h.status) }}>{h.id}</b><Segs pct={h.score} status={h.status} /><em>{h.score}</em>
            </span>
          ))}
        </div>

        <div className="vz ladder right">
          <span className="vz-signal" aria-hidden="true">{[1, 2, 3, 4, 5].map((n) => <i key={n} className={n <= bars ? 'on' : undefined} style={{ height: `${4 + n * 3}px` }} />)}</span>
          <small>GROUND LINK</small>
          <span>{data?.link.sinceSyncH == null ? 'NEVER SYNCED' : `SYNC ${f1(data.link.sinceSyncH)} H AGO`}</span>
          <span>{data?.link.pending ?? 0} PENDING</span>
        </div>

        <div className="vz vz-bl">
          <small>CABIN · ENVIRONMENT</small>
          <b className="big">CO₂ {f1(self?.live.co2)} <em>mmHg</em></b>
          <b className="big">DOSE {f1(self?.live.dose)} <em>µSv/h</em></b>
        </div>

        <div className="vz vz-br">
          <small>CREW LINK</small>
          <b className="big">CREW {data?.crew.length ?? 0} ONLINE</b>
          <b className="big" style={{ color: off ? 'var(--watch)' : undefined }}>OFF-NOMINAL {off}</b>
          <span>WATCHING: {focus && focus.status !== 'nominal' ? `${focus.name.toUpperCase()} · ${LABEL[focus.status]}` : 'ALL CREW NOMINAL'}</span>
        </div>

        <div className="vz-bar">
          <Segs pct={readiness} status={status} />
          <span>LIFE SIGNS: <b style={{ color: tone(status) }}>{LABEL[status]}</b></span>
          <span>ALERTS: {self?.alerts ?? 0} OPEN</span>
          <span className="next">NEXT: {next}</span>
        </div>
        <div className="vz-motto">SENSE · EXPLAIN · ACT</div>
        <div className="prompt">Scroll to float forward <span>↓</span></div>
        <Reticle />
      </div>
    </>
  )
}
