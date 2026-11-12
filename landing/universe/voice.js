/* Voice navigation on the story page: a small mic pill (no guide lives here, so there is no Q&A). It uses the same
   grammar and recognizer as NOVA and VITA (vita/commands.js, vita/listen.js). "scroll to the health twin", "open the
   console", "walk the station", "home". Hidden where the browser has no speech recognition. */
import { parseCommand } from '../vita/commands.js'
import { createListener, voiceModePref } from '../vita/listen.js'

const HINT = 'Try: “health twin”, “astrodocx”, “scroll down”, “open the console”, “walk the station”'
let mic, line
const say = (t) => { line.textContent = t; line.hidden = !t }
const smooth = () => (matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth')

function run(c) {
  if (c.type === 'action') {
    const { kind, target } = c.action
    if (kind === 'tour') return window.ADX_TOUR?.start()
    if (kind === 'library') return void (location.href = '/#library' + (target ? '/' + target : ''))
    location.href = kind === 'cabin' ? '/app/cabin' + (target ? '?shot=' + encodeURIComponent(target) : '') : '/app' + (target || '/')
    return
  }
  const by = (n) => scrollBy({ top: n * innerHeight * 0.8, behavior: smooth() })
  switch (c.name) {
    case 'scroll-down': return by(1)
    case 'scroll-up': return by(-1)
    case 'scroll-top': return scrollTo({ top: 0, behavior: smooth() })
    case 'scroll-bottom': return (document.getElementById('footer') ?? document.body).scrollIntoView({ behavior: smooth() })
    case 'section': return document.getElementById(c.arg)?.scrollIntoView({ behavior: smooth() })
    case 'home': return void (location.href = '/')
    case 'back': return history.back()
    case 'forward': return history.forward()
    case 'voice-off': return stopMode()
    case 'tour-skip': case 'tour-exit': case 'tour-pause': case 'tour-resume': return
    default: say(HINT)
  }
}

const listener = createListener({
  onInterim: (t) => say(t),
  onFinal: (t) => {
    const c = parseCommand(t, { where: 'story' })
    if (!c) return say(`“${t}” — ${HINT}`)
    say(c.say || `“${t}”`); run(c)
  },
  onState: (s) => {
    mic.classList.toggle('on', s === 'listening')
    mic.setAttribute('aria-pressed', String(listener.handsFree))
    if (s === 'denied') { voiceModePref.set(false); say('Microphone blocked. Allow it in the browser, then try again.') }
  },
  onError: (c) => { if (c !== 'not-allowed' && c !== 'service-not-allowed') say('I could not hear that. Try again.') },
})
function stopMode() { voiceModePref.set(false); listener.setHandsFree(false); say('Voice mode off.') }

if (listener.supported) {
  const css = document.createElement('style')
  css.textContent = `.voice-pill{position:fixed;z-index:60;left:14px;bottom:14px;display:flex;flex-direction:column;align-items:flex-start;gap:6px;max-width:min(380px,calc(100vw - 150px));font:12px system-ui,sans-serif}
.voice-pill button{height:36px;padding:0 14px;border:0;border-radius:18px;cursor:pointer;color:#36e2f5;background:rgba(8,18,30,.82);box-shadow:inset 0 0 0 1px rgba(54,226,245,.35);backdrop-filter:blur(8px);font:inherit;letter-spacing:.1em;text-transform:uppercase}
.voice-pill button.on{color:#ff8a3d;box-shadow:inset 0 0 0 1px #ff8a3d}.voice-pill button[aria-pressed=true]{background:rgba(54,226,245,.22)}
.voice-pill button:focus-visible{outline:2px solid #36e2f5;outline-offset:2px}
.voice-pill p{margin:0;padding:6px 10px;border-radius:10px;color:#e8f6ff;background:rgba(8,18,30,.82);box-shadow:inset 0 0 0 1px rgba(54,226,245,.35)}`
  document.head.append(css)
  const box = document.createElement('div')
  box.className = 'voice-pill'
  box.innerHTML = '<p role="status" aria-live="polite" hidden></p><div><button type="button" aria-pressed="false" aria-keyshortcuts="Alt+V" aria-label="Speak a command" title="Say a command (Alt+V). Double-click for voice mode.">Voice</button></div>'
  document.body.append(box)
  line = box.querySelector('p'); mic = box.querySelector('button')
  mic.addEventListener('click', () => { if (listener.state === 'listening') { listener.handsFree ? stopMode() : listener.stop() } else listener.once() })
  mic.addEventListener('dblclick', () => { voiceModePref.set(true); listener.setHandsFree(true); say('Voice mode on. Say a command.') })
  addEventListener('keydown', (e) => { if (e.altKey && e.code === 'KeyV' && !e.ctrlKey && !e.metaKey) { e.preventDefault(); mic.click() } })
  if (voiceModePref.get()) { listener.setHandsFree(true); say('Voice mode on. Say a command.') }
}
