import { Volume2, VolumeX } from 'lucide-react'
import { useSound } from './sfx'

/** Sound on or off, remembered in this browser. */
export function SoundToggle({ className }: { className?: string }) {
  const { on, toggle } = useSound()
  const Icon = on ? Volume2 : VolumeX
  return (
    <button type="button" className={className} aria-pressed={on} onClick={toggle} title={on ? 'Mute sound' : 'Turn sound on'}>
      <Icon size={14} strokeWidth={2} aria-hidden="true" /><span>{on ? 'Sound on' : 'Muted'}</span>
    </button>
  )
}
