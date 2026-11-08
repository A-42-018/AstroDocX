import type { ReactNode } from 'react'
import { toggleSound } from '../audio/sfx'

/** On/off switch: a real checkbox with role="switch", so it is announced as on/off and toggles with Space. */
export function Switch({ checked, onChange, children, disabled }: { checked: boolean; onChange: (on: boolean) => void; children: ReactNode; disabled?: boolean }) {
  return (
    <label className="hud-switch">
      <input type="checkbox" role="switch" checked={checked} disabled={disabled} onChange={(e) => { toggleSound(e.target.checked); onChange(e.target.checked) }} />
      <span className="hud-switch-track" aria-hidden="true" />
      <span className="hud-switch-label">{children}</span>
    </label>
  )
}
