import { Box, Download, House, Play, RotateCcw, Square, Volume2, VolumeX } from 'lucide-react'
import { useId, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useSound } from '../audio/sfx'
import { DEMO_MAX_STEPS, resetDemo, useDemo } from '../sim/demoRun'
import { BackdropChoices } from './BackdropPicker'
import { OVERFLOW_ICON } from './nav'
import { usePopover } from './usePopover'

/** The `⋯` menu at the end of the top bar: Run demo, 3D mode, sound, the backdrop, Install and the way back to the landing page. */
export function Overflow({ crewId, crewName, install, onDemo }:
  { crewId: string; crewName: string; install: (() => Promise<void>) | null; onDemo: () => void }) {
  const btn = useRef<HTMLButtonElement>(null)
  const panel = useRef<HTMLDivElement>(null)
  const [open, setOpen] = usePopover(btn, panel)
  const id = useId()
  const demo = useDemo()
  const sound = useSound()
  const Icon = OVERFLOW_ICON
  const run = (fn: () => void) => () => { setOpen(false); fn() }
  return (
    <div className="ovf">
      <button
        ref={btn} type="button" className="tb-icon" aria-label="More options" title="More options"
        aria-expanded={open} aria-controls={open ? id : undefined} onClick={() => setOpen(!open)}
      >
        <Icon size={20} strokeWidth={1.9} aria-hidden="true" />
      </button>
      {open && (
        <div ref={panel} id={id} className="ovf-panel" role="dialog" aria-label="More options">
          {demo.phase === 'idle' ? (
            <button type="button" className="ovf-item" onClick={run(onDemo)}>
              <Play size={16} aria-hidden="true" /><span>Run demo<small>CO₂ scrubber fault, about 20 s</small></span>
            </button>
          ) : (
            <button type="button" className="ovf-item" onClick={run(() => void resetDemo())}>
              {demo.phase === 'running' ? <Square size={16} aria-hidden="true" /> : <RotateCcw size={16} aria-hidden="true" />}
              <span>{demo.phase === 'running' ? `Stop demo (${demo.step}/${DEMO_MAX_STEPS})` : 'Reset demo'}<small>Restore the demo mission data</small></span>
            </button>
          )}
          <Link to="/cabin" className="ovf-item" onClick={() => setOpen(false)}>
            <Box size={16} aria-hidden="true" /><span>3D mode<small>Walk through the crew module</small></span>
          </Link>
          <button type="button" className="ovf-item" aria-pressed={sound.on} onClick={sound.toggle}>
            {sound.on ? <Volume2 size={16} aria-hidden="true" /> : <VolumeX size={16} aria-hidden="true" />}
            <span>{sound.on ? 'Sound on' : 'Sound off'}<small>{sound.on ? 'Tap to mute console and cabin sound' : 'Tap to hear alerts and the cabin'}</small></span>
          </button>
          {install && (
            <button type="button" className="ovf-item" onClick={run(() => void install())}>
              <Download size={16} aria-hidden="true" /><span>Install<small>Use the console offline as an app</small></span>
            </button>
          )}
          <a href="/" className="ovf-item">
            <House size={16} aria-hidden="true" /><span>Back to landing<small>The AstroDocX landing page</small></span>
          </a>
          <BackdropChoices crewId={crewId} crewName={crewName} />
        </div>
      )}
    </div>
  )
}
