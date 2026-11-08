import { Music, Music2, Volume2, VolumeX } from 'lucide-react'
import { startMusic, stopMusic, useMusic } from './music'
import { useSound } from './sfx'

/**
 * The one sound control on a page: on or off for effects, the crew's voices and VITA, remembered in this browser (and shared
 * with the landing page). `compact` shows just the speaker icon (the console's top bar). `music` adds the score as a
 * small ♪ segment of the same control: it is generated here (no download), but stays opt-in, and muting sound mutes it too.
 */
export function SoundToggle({ className, compact = false, music = false }: { className?: string; compact?: boolean; music?: boolean }) {
  const { on, toggle } = useSound()
  const Icon = on ? Volume2 : VolumeX
  const main = (
    <button type="button" className={className} aria-pressed={on} aria-label={compact ? 'Sound' : undefined} onClick={toggle} title={on ? 'Mute sound' : 'Turn sound on'}>
      <Icon size={compact ? 20 : 14} strokeWidth={compact ? 1.9 : 2} aria-hidden="true" />{!compact && <span>{on ? 'Sound on' : 'Muted'}</span>}
    </button>
  )
  return music ? <span className={className ? `${className}-group` : undefined}>{main}<MusicSegment className={className} compact={compact} /></span> : main
}

/** The score's switch, part of the sound control. Turning it on while muted turns sound on first. */
function MusicSegment({ className, compact = false }: { className?: string; compact?: boolean }) {
  const on = useMusic((s) => s.on)
  const Icon = on ? Music2 : Music
  const label = on ? 'Stop the score' : 'Play the score'
  return (
    <button type="button" className={className} aria-pressed={on} aria-label={label} title={label}
      onClick={() => { if (on) { stopMusic(); return } if (!useSound.getState().on) useSound.getState().toggle(); startMusic() }}>
      <Icon size={compact ? 20 : 14} strokeWidth={compact ? 1.9 : 2} aria-hidden="true" />
    </button>
  )
}
