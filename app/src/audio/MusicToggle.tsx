import { Music, Music2 } from 'lucide-react'
import { startMusic, stopMusic, useMusic } from './music'

/** Turns the cabin's background score on or off (it streams from YouTube). */
export function MusicToggle({ className }: { className?: string }) {
  const { on, failed } = useMusic()
  const Icon = on ? Music2 : Music
  return (
    <button type="button" className={className} aria-pressed={on} onClick={() => (on ? stopMusic() : void startMusic())}
      title={failed ? 'The score could not load (offline or blocked)' : on ? 'Stop the score' : 'Play the score'}>
      <Icon size={14} strokeWidth={2} aria-hidden="true" /><span>{failed ? 'Music unavailable' : on ? 'Music on' : 'Music'}</span>
    </button>
  )
}
