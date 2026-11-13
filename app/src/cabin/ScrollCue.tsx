import { ChevronsDown } from 'lucide-react'

/** What decides whether the scroll cue is up (CabinPage): the helmet stop, HUD booted, for a visitor who has not moved yet. */
export interface CueState {
  /** Loaded, loading screen gone, arrival over. */
  settled: boolean
  /** The visor glass is down and the HUD has booted. */
  visorDown: boolean
  stop: number
  /** The visitor has already moved on (or scrolled): the cue is for the first move only. */
  moved: boolean
  floating: boolean
  /** A wall screen is in use or a crew card is open. */
  busy: boolean
  /** The guided tour is steering the camera (or waiting for its first click). */
  touring: boolean
}

export const showScrollCue = (s: CueState) =>
  s.settled && s.visorDown && s.stop === 0 && !s.moved && !s.floating && !s.busy && !s.touring

/**
 * The one thing to do on arriving in the helmet: scroll. It sits low and centred, in the app's "do this" orange against the
 * cyan HUD so it is the brightest thing there, and is gone for good once the visitor has moved.
 * With a mouse or trackpad it is only a hint (pointer-events are off, so the wheel passes through to the cabin); on a touch
 * screen there is no wheel, so it is the button that floats forward.
 */
export function ScrollCue({ touch, onGo }: { touch: boolean; onGo: () => void }) {
  return (
    <button type="button" className="cabin-scroll-cue" onClick={onGo}>
      {touch || <span className="cue-mouse" aria-hidden="true" />}
      <span>{touch ? 'Tap to float forward' : 'Scroll to float forward'}</span>
      <ChevronsDown className="cue-arrows" size={20} aria-hidden="true" />
    </button>
  )
}
