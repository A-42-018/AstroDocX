import '../styles/pages/vita.css'
import { Mic, Route, SendHorizontal, Square, Volume2, VolumeX, X } from 'lucide-react'
import { Fragment, useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useVitaVoice, vitaPrime, vitaSay, vitaStop } from '../audio/voice'
import { useSound } from '../audio/sfx'
import { useTour } from '../tour/store'
import { VitaAvatar } from './VitaAvatar'
import { runAction, sendQuestion, startGuide, useVita, type Msg } from './store'

/** The only markup an answer may carry is <em>…</em>; it is turned into elements, never injected as HTML. */
function Rich({ text }: { text: string }) {
  return <>{text.split(/(<em>.*?<\/em>)/gi).map((p, i) => (/^<em>/i.test(p) ? <em key={i}>{p.replace(/<\/?em>/gi, '')}</em> : <Fragment key={i}>{p.replace(/<[^>]*>/g, '')}</Fragment>))}</>
}

const GREETING = 'Hi, I’m VITA, your mission guide. Ask me anything about astronaut health or this project. Or I can give you the full tour.'
const CHIPS = ['Why does CO₂ matter?', 'What does radiation do to astronauts?', 'How does AstroDocX spot trouble early?']

type Recognition = { lang: string; interimResults: boolean; maxAlternatives: number; start(): void; stop(): void; onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null; onend: (() => void) | null; onerror: (() => void) | null }
const SR: (new () => Recognition) | undefined = typeof window === 'undefined' ? undefined
  : (window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition }).SpeechRecognition
    ?? (window as unknown as { webkitSpeechRecognition?: new () => Recognition }).webkitSpeechRecognition

function Bubble({ m, onAction }: { m: Msg; onAction: (a: NonNullable<Msg['actions']>[number]) => void }) {
  const bot = m.role === 'assistant'
  return (
    <div className={`vita-msg ${bot ? 'bot' : 'me'}`}>
      <span className="vita-who">{bot ? <>VITA{m.source === 'offline' && m.actions ? <span className="vita-src"> · built-in answer</span> : null}</> : <span className="sr-only">You: </span>}</span>
      <p><Rich text={m.text} /></p>
      {!!m.citations?.length && (
        <div className="vita-cites" aria-label="Sources">
          {m.citations.map((c) => <a key={c.url} href={c.url} target="_blank" rel="noopener noreferrer" aria-label={`Source: ${c.label} (opens in a new tab)`}>{c.label}</a>)}
        </div>
      )}
      {!!m.actions?.length && (
        <div className="vita-acts">
          {m.actions.map((a, i) => <button key={a.label + i} type="button" className={i ? 'ghost' : ''} onClick={() => onAction(a)}>{a.label}</button>)}
        </div>
      )}
    </div>
  )
}

/**
 * VITA, the mission guide, at the bottom right of every screen (and the 3D cabin): a small floating drone that opens a
 * chat. Answers come from the same place as on the landing page (landing/vita/ask.js: live, else the offline matcher),
 * are read out when Sound is on, and can act: open a screen, fly to a cabin stop, open the NASA library, or start the tour.
 */
export function VitaDock() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const { open, busy, messages, set } = useVita()
  const speaking = useVitaVoice((s) => s.speaking)
  const sound = useSound()
  const phase = useTour((s) => s.phase)
  const [text, setText] = useState('')
  const [listening, setListening] = useState(false)
  const [perk, setPerk] = useState(0)
  const log = useRef<HTMLDivElement>(null)
  const input = useRef<HTMLInputElement>(null)
  const fab = useRef<HTMLButtonElement>(null)
  const rec = useRef<Recognition | null>(null)
  const inCabin = pathname.startsWith('/cabin')
  const go = (p: string) => navigate(p)

  useEffect(() => { log.current?.scrollTo({ top: log.current.scrollHeight }) }, [messages, busy, open])

  // the first time the chat opens, VITA says hello (out loud with Sound on)
  useEffect(() => {
    if (!open) return
    input.current?.focus({ preventScroll: true })
    if (useVita.getState().messages.length === 0 && useTour.getState().phase !== 'running') {
      useVita.setState({ messages: [{ id: -1, role: 'assistant', text: GREETING }] })
      void vitaSay(GREETING)
    }
  }, [open])

  if (phase === 'gate' || phase === 'end') return null

  const toggle = () => {
    if (open) { vitaStop(); set({ open: false }); return }
    setPerk((n) => n + 1)
    set({ open: true })
  }
  const submit = (e?: FormEvent) => {
    e?.preventDefault()
    const q = text.trim()
    if (!q || busy) return
    setText('')
    setPerk((n) => n + 1)
    void sendQuestion(q, pathname, go)
  }
  const ask = (q: string) => { setPerk((n) => n + 1); void sendQuestion(q, pathname, go) }
  const onKey = (e: KeyboardEvent) => {
    e.stopPropagation() // typing here must not steer the cabin camera or trip the console's shortcuts
    if (e.key === 'Escape') { e.preventDefault(); vitaStop(); set({ open: false }); fab.current?.focus() }
  }
  const mic = () => {
    if (!SR) return
    if (rec.current) { rec.current.stop(); return }
    vitaStop() // don't let the mic hear VITA
    const r = new SR()
    r.lang = 'en-US'; r.interimResults = true; r.maxAlternatives = 1
    setListening(true)
    r.onresult = (e) => {
      const res = e.results[e.results.length - 1]
      setText(res[0].transcript)
      if (res.isFinal) { r.stop(); void sendQuestion(res[0].transcript, pathname, go); setText('') }
    }
    r.onend = r.onerror = () => { rec.current = null; setListening(false) }
    rec.current = r
    try { r.start() } catch { rec.current = null; setListening(false) }
  }
  const toggleSound = () => {
    const wasOn = sound.on
    sound.toggle()
    if (wasOn) vitaStop(); else vitaPrime()
  }

  return (
    <aside className={`vita-dock${inCabin ? ' in-cabin' : ''}${open ? ' is-open' : ''}`} aria-label="VITA, mission guide">
      {open && (
        <section className="vita-panel" role="dialog" aria-label="Chat with VITA" onKeyDown={onKey}>
          <header className="vita-head">
            <div>
              <b>VITA</b>
              <span aria-live="polite">{busy ? 'Looking that up…' : speaking ? 'Speaking' : 'Mission guide'}</span>
            </div>
            <div className="vita-head-ctl">
              {speaking && <button type="button" onClick={vitaStop} aria-label="Stop talking"><Square size={14} aria-hidden="true" /></button>}
              <button type="button" onClick={toggleSound} aria-pressed={sound.on} aria-label={sound.on ? 'Mute VITA’s voice' : 'Let VITA talk out loud'} title={sound.on ? 'Voice on' : 'Voice off'}>
                {sound.on ? <Volume2 size={15} aria-hidden="true" /> : <VolumeX size={15} aria-hidden="true" />}
              </button>
              <button type="button" onClick={toggle} aria-label="Close VITA"><X size={16} aria-hidden="true" /></button>
            </div>
          </header>
          <div className="vita-log" ref={log} role="log" aria-live="polite" aria-label="Conversation with VITA">
            {messages.map((m) => <Bubble key={m.id} m={m} onAction={(a) => runAction(a, go)} />)}
            {busy && <div className="vita-msg bot" role="status" aria-label="VITA is thinking"><span className="vita-dots"><i /><i /><i /></span></div>}
            {messages.length <= 1 && !busy && (
              <div className="vita-chips" role="group" aria-label="Suggested questions">
                {CHIPS.map((c) => <button key={c} type="button" onClick={() => ask(c)}>{c}</button>)}
              </div>
            )}
          </div>
          <div className="vita-foot">
            <button type="button" className="vita-tour" onClick={() => startGuide(go, 'full')}><Route size={15} aria-hidden="true" /> Take the full tour</button>
            <form onSubmit={submit} autoComplete="off">
              <input ref={input} value={text} onChange={(e) => setText(e.target.value)} placeholder="Ask VITA anything…" aria-label="Your question" maxLength={500} />
              {SR && <button type="button" className={listening ? 'listening' : ''} onClick={mic} aria-label={listening ? 'Stop listening' : 'Speak your question'}><Mic size={16} aria-hidden="true" /></button>}
              <button type="submit" disabled={busy || !text.trim()} aria-label="Send"><SendHorizontal size={16} aria-hidden="true" /></button>
            </form>
          </div>
        </section>
      )}
      <button ref={fab} type="button" className="vita-fab" onClick={toggle} aria-expanded={open} aria-label={open ? 'Close VITA' : 'Ask VITA, the mission guide'}>
        <VitaAvatar talking={speaking || busy} size={inCabin ? 84 : 92} perk={perk} />
        {!open && <span className="vita-tip" aria-hidden="true">Ask VITA</span>}
      </button>
    </aside>
  )
}
