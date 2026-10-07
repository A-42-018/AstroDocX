import { Globe, Radio, Rocket, TriangleAlert, type LucideIcon } from 'lucide-react'
import { duration } from '../shell/format'
import type { LinkInfo } from './link'
import { windowProgress } from './link'

const R = 38
const C = 2 * Math.PI * R

function Node({ x, Icon, label }: { x: number; Icon: LucideIcon; label: string }) {
  return (
    <g>
      <circle cx={x} cy="86" r="34" className="ld-node" />
      <Icon x={x - 16} y={70} size={32} strokeWidth={1.8} className="ld-ico" />
      <text x={x} y="146" textAnchor="middle" className="ld-label">{label}</text>
    </g>
  )
}

/**
 * Ship, relay, Earth. While a window is open the link is solid and packets flow toward Earth (more queued
 * means more packets); between windows it is dim and still; in a blackout it is broken. A burst of packets
 * flies once when queued entries are delivered. Decorative: the status text beside it says the same in words.
 */
export function LinkDiagram({ link, now, queued, burst }: { link: LinkInfo; now: number; queued: number; burst: { n: number; key: number } }) {
  const p = windowProgress(now, link)
  const flowing = link.state === 'open' && queued > 0
  const fill = link.state === 'blackout' ? 0 : p.fraction
  return (
    <div className={`ld ld-${link.state}`}>
      <svg className="ld-svg" viewBox="0 0 720 170" aria-hidden="true">
        <path d="M124 86H326" className="ld-line" />
        <path d="M394 86H596" className="ld-line" />
        {flowing && (
          <>
            <path d="M124 86H326" className="ld-flow" style={{ animationDuration: `${Math.max(0.8, 2.6 - queued * 0.15)}s` }} />
            <path d="M394 86H596" className="ld-flow" style={{ animationDuration: `${Math.max(0.8, 2.6 - queued * 0.15)}s` }} />
          </>
        )}
        {link.state === 'blackout' && (
          <g className="ld-break">
            <path d="M326 86l22-14M394 86l-22 14" />
            <path d="M348 72l-4 28M372 72l-4 28" className="ld-spark" />
          </g>
        )}
        <Node x={90} Icon={Rocket} label="Ship" />
        <Node x={360} Icon={Radio} label="Relay" />
        <Node x={630} Icon={Globe} label="Earth" />
        {burst.n > 0 && (
          <g key={burst.key} className="ld-burst">
            {Array.from({ length: Math.min(burst.n, 8) }, (_, i) => <circle key={i} cx="124" cy="86" r="5" style={{ animationDelay: `${i * 0.12}s` }} />)}
          </g>
        )}
      </svg>
      <div className="ld-ring" aria-hidden="true">
        <svg viewBox="0 0 100 100">
          <circle cx="50" cy="50" r={R} className="ring-track" />
          <circle cx="50" cy="50" r={R} className="ring-fill" strokeDasharray={C} strokeDashoffset={C * (1 - fill)} transform="rotate(-90 50 50)" />
        </svg>
        <div>
          {p.mode === 'blackout' ? <TriangleAlert size={22} /> : <b className="mono">{duration(p.remainingMs)}</b>}
          <small>{p.mode === 'closes' ? 'window closes' : p.mode === 'opens' ? 'next window' : 'no link'}</small>
        </div>
      </div>
    </div>
  )
}
