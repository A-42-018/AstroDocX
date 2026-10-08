import { HOUR, MISSION_START } from '../data/synthetic'
import type { LinkInfo } from '../sync/link'

/** "Flight Engineer" -> "FE"; a single word uses its first two letters. */
export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  return (words.length > 1 ? words[0][0] + words[1][0] : (words[0] ?? '?').slice(0, 2)).toUpperCase()
}

/** The greeting follows the crew's own clock (mission elapsed time), not the viewer's. */
export function greetingFor(now: number): string {
  const h = Math.floor(((now - MISSION_START) % (24 * HOUR)) / HOUR)
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'
}

/** 42 min -> "42m", 80 min -> "1h 20m". */
export function duration(ms: number): string {
  const mins = Math.max(0, Math.ceil(ms / 60000))
  return mins < 60 ? `${mins}m` : `${Math.floor(mins / 60)}h ${String(mins % 60).padStart(2, '0')}m`
}

/** One line for the top-bar link widget: what the link is doing now and when it changes. */
export function linkSummary(link: LinkInfo, now: number, pending: number, sinceSyncH?: number | null): { short: string; long: string } {
  const queue = (pending > 0 ? ` · ${pending} queued` : '') + (sinceSyncH === undefined ? '' : sinceSyncH === null ? ' · no sync yet' : ` · synced ${sinceSyncH.toFixed(1)} h ago`)
  if (link.state === 'blackout') return { short: 'Blackout', long: `Blackout${queue}` }
  if (link.state === 'open') return { short: 'Link open', long: `Link open · closes in ${duration((link.closesAt ?? now) - now)}${queue}` }
  return { short: 'Link closed', long: `Link closed · opens in ${duration(link.nextOpen - now)}${queue}` }
}
