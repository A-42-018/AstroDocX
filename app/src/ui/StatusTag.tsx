import type { Status } from '../data/types'
import { STATUS_SHORT, STATUS_WORD } from './status'

/**
 * Status tag: a lit rectangle with a square lamp and the word. Never colour alone: the word is always there.
 * The Act lamp blinks (≤ 1 Hz) unless the crew asked for reduced motion.
 */
export function StatusTag({ status, label, short }: { status: Status; label?: string; short?: boolean }) {
  return <span className={`tag st-${status}`}>{label ?? (short ? STATUS_SHORT : STATUS_WORD)[status]}</span>
}
