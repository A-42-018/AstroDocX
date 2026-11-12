import { Mic, MicOff } from 'lucide-react'
import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import '../styles/pages/voice.css'
import { bindVoice, micTap, resumeVoiceMode, setVoiceMode, useVoice, voiceModeOff, voiceSupported } from './store'

/** The persistent voice control: tap = one command, long label = voice mode (keeps listening), plus what was heard. */
export function VoiceNav() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const { state, handsFree, line } = useVoice()
  const supported = voiceSupported()

  bindVoice({ go: (p) => navigate(p), history: (d) => navigate(d), pathname, voiceOff: voiceModeOff })

  useEffect(() => { resumeVoiceMode() }, [])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!e.altKey || e.code !== 'KeyV' || e.ctrlKey || e.metaKey) return
      const t = e.target as HTMLElement | null
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return
      e.preventDefault(); micTap()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  if (!supported) return null
  const listening = state === 'listening'
  const status = state === 'denied' ? 'Microphone blocked' : listening ? (handsFree ? 'Voice mode: listening' : 'Listening') : handsFree ? 'Voice mode: waiting' : ''
  return (
    <div className={`voice-nav${pathname.startsWith('/cabin') ? ' in-cabin' : ''}`}>
      {(line || status) && <p className={`voice-line${listening ? ' live' : ''}`} role="status" aria-live="polite">{line || status}</p>}
      <div className="voice-ctl">
        <button type="button" className={`voice-mic${listening ? ' listening' : ''}`} onClick={micTap} aria-keyshortcuts="Alt+V"
          aria-label={listening ? 'Stop listening' : 'Speak a command'} title="Speak a command, like “open alerts” (Alt+V)">
          {state === 'denied' ? <MicOff size={16} aria-hidden="true" /> : <Mic size={16} aria-hidden="true" />}
        </button>
        <button type="button" className="voice-mode" aria-pressed={handsFree} onClick={() => setVoiceMode(!handsFree)}
          title="Voice mode keeps listening until you say “stop listening”">Voice mode</button>
      </div>
    </div>
  )
}
