import '../styles/pages/doctor.css'
import { BrainCircuit, Check, ClipboardPlus, Dumbbell, Mic, Moon, Radiation, Radio, SendHorizontal, ShieldCheck, Sparkles, Square, Stethoscope, Users, Volume2, WifiOff, Wind, type LucideIcon } from 'lucide-react'
import { Fragment, useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useSound } from '../audio/sfx'
import { useVitaVoice, vitaSay, vitaStop } from '../audio/voice'
import { useBoard } from '../board/store'
import { db } from '../data/db'
import type { Hazard } from '../data/types'
import { met } from '../engine/actions'
import { useShellContext } from '../shell/useShellData'
import { Button, HudPanel, NasaRef, StateView, StatusTag } from '../ui'
import { SR, type Recognition } from '../vita/speech'
import { VitaAvatar } from '../vita/VitaAvatar'
import { names, type DoctorReport, type Priority } from './analyze'
import { narrate, narrativeText, STYLES, whoOf, type Paragraph, type Style } from './brief'
import { consult, type ChatLine, type Consult } from './live'
import { Pedestal } from './Pedestal'
import { useDoctorBrief, useDoctorReport } from './useDoctorReport'

const STYLE_KEY = 'adx-doctor-style'
const HAZARD_ICON: Record<Hazard, LucideIcon> = { R: Radiation, I: Moon, D: Radio, G: Dumbbell, E: Wind }
const ASK = ['Who needs attention first?', 'Is the crew fit for EVA tomorrow?', 'Write the handoff for the flight surgeon', 'How is the pilot sleeping?']
const PRIORITY: { id: Priority; label: string }[] = [{ id: 'now', label: 'Now' }, { id: 'today', label: 'Today' }, { id: 'next-link', label: 'Next link window' }]
const BADGES: { icon: LucideIcon; label: string; title: string }[] = [
  { icon: BrainCircuit, label: 'Explainable', title: 'Every line traces back to a reading and the person’s own baseline' },
  { icon: WifiOff, label: 'Offline-first', title: 'The exam runs on this device; live wording is optional' },
  { icon: ShieldCheck, label: 'Advisory only', title: 'Decision support, not a diagnosis: the flight surgeon decides' },
]

/** The only markup VITA's text may carry is <em>…</em>; it becomes elements, never injected HTML. */
function Rich({ text }: { text: string }) {
  return <>{text.split(/(<em>.*?<\/em>)/gi).map((p, i) => (/^<em>/i.test(p) ? <em key={i}>{p.replace(/<\/?em>/gi, '')}</em> : <Fragment key={i}>{p.replace(/<[^>]*>/g, '')}</Fragment>))}</>
}

/** A live reply as paragraphs: one per line, with an SBAR or "ACT ·" label pulled out when there is one. */
const toParagraphs = (text: string): Paragraph[] => text.split(/\n+/).filter((l) => l.trim()).map((l) => {
  const m = /^(Situation|Background|Assessment|Recommendation|Watching|EVA|Mission|(?:ACT|WATCH) · [^:]+):\s*(.*)$/.exec(l.trim())
  return m ? { label: m[1], text: m[2] } : { text: l.trim() }
})

type Bubble =
  | { kind: 'exam'; consult?: Consult }
  | { kind: 'answer'; question: string; consult: Consult }
/** What VITA said, the follow-up chat and the log note belong to one exam: a scope and a style, and for a worded
    exam the headline it was worded from. A new exam simply does not match and shows the fresh offline narrative. */
interface Said { exam: string; headline?: string; bubble: Bubble; chat: ChatLine[]; logged: string }
const FRESH: Omit<Said, 'exam'> = { bubble: { kind: 'exam' }, chat: [], logged: '' }

const savedStyle = (): Style => { try { const s = localStorage.getItem(STYLE_KEY); return s === 'clinical' || s === 'handoff' ? s : 'brief' } catch { return 'brief' } }

/**
 * VITA, the crew doctor (laid out after the reference "AI assistant" design): crew and report style on the left, VITA's
 * hologram on its pedestal in the middle with what she says, what she checks and what to ask her on the right, the
 * consult bar under it and the full consultation (findings, advice, fitness) below. The exam is the console's own
 * rules over the live database; the live layer only words it (doctor/live.ts).
 */
export default function DoctorPage() {
  const [params, setParams] = useSearchParams()
  const shell = useShellContext()
  const boot = useBoard((s) => s.boot)
  const me = useBoard((s) => s.crewId)
  const asked = params.get('crew')
  const scope = asked && shell?.crew.some((c) => c.id === asked) ? asked : 'all'
  const report = useDoctorReport(scope)
  const [style, setStyleState] = useState<Style>(savedStyle)
  const [said, setSaid] = useState<Said>({ exam: '', ...FRESH })
  const [busy, setBusy] = useState(false)
  const [text, setText] = useState('')
  const [listening, setListening] = useState(false)
  const speaking = useVitaVoice((s) => s.speaking)
  const sound = useSound()
  const rec = useRef<Recognition | null>(null)
  const input = useRef<HTMLInputElement>(null)

  const exam = `${scope}|${style}`
  const current = said.exam === exam && !(said.bubble.kind === 'exam' && said.bubble.consult && said.headline !== report?.headline) ? said : { exam, ...FRESH }
  const { bubble, chat, logged } = current
  const update = (p: Partial<Said>) => setSaid({ ...current, ...p })
  useEffect(() => () => vitaStop(), [])

  const narrative = useMemo(() => (report ? narrate(report, style) : null), [report, style])

  if (boot.state === 'error') return <StateView kind="error" title="Could not open the local database"><p>{boot.error}</p></StateView>
  if (report === undefined || !shell) return <StateView kind="loading" label="VITA is examining the crew" />
  if (report === null || !narrative) return <StateView kind="empty" label="No crew data yet." />
  const r: DoctorReport = report

  const setStyle = (s: Style) => { setStyleState(s); try { localStorage.setItem(STYLE_KEY, s) } catch { /* not kept */ } }
  const setScope = (id: string) => { vitaStop(); setParams(id === 'all' ? {} : { crew: id }, { replace: true }) }

  const shown: { paragraphs: Paragraph[]; source: 'live' | 'offline'; citations: Consult['citations']; question?: string } =
    bubble.kind === 'answer' ? { paragraphs: toParagraphs(bubble.consult.text), source: bubble.consult.source, citations: bubble.consult.citations, question: bubble.question }
      : bubble.consult ? { paragraphs: toParagraphs(bubble.consult.text), source: bubble.consult.source, citations: bubble.consult.citations }
        : { paragraphs: narrative.paragraphs, source: 'offline', citations: [] }
  const spoken = shown.paragraphs.map((p) => (p.label ? `${p.label}. ${p.text}` : p.text)).join(' ')

  const runExam = async () => {
    if (busy) return
    vitaStop(); setBusy(true)
    const c = await consult(r, style)
    setBusy(false)
    update({ bubble: { kind: 'exam', consult: c }, headline: r.headline })
    if (scope === 'all' && style === 'brief') useDoctorBrief.setState({ text: c.text, headline: r.headline })
    void vitaSay(c.text)
  }
  const ask = async (q: string) => {
    const question = q.trim()
    if (!question || busy) return
    vitaStop(); setBusy(true); setText('')
    const c = await consult(r, style, question, chat)
    setBusy(false)
    update({ bubble: { kind: 'answer', question, consult: c }, chat: [...chat, { role: 'user' as const, text: question }, { role: 'assistant' as const, text: c.text.replace(/<[^>]*>/g, '') }].slice(-6) })
    void vitaSay(c.text)
  }
  const submit = (e: FormEvent) => { e.preventDefault(); void ask(text) }
  const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { vitaStop(); setText('') } }
  const mic = () => {
    if (!SR) return
    if (rec.current) { rec.current.stop(); return }
    vitaStop()
    const s = new SR()
    s.lang = 'en-US'; s.interimResults = true; s.maxAlternatives = 1
    setListening(true)
    s.onresult = (e) => {
      const res = e.results[e.results.length - 1]
      setText(res[0].transcript)
      if (res.isFinal) { s.stop(); void ask(res[0].transcript) }
    }
    s.onend = s.onerror = () => { rec.current = null; setListening(false) }
    rec.current = s
    try { s.start() } catch { rec.current = null; setListening(false) }
  }
  const addToLog = async () => {
    const who = scope === 'all' ? (me && shell.crew.some((c) => c.id === me) ? me : shell.crew[0].id) : scope
    const body = narrativeText(narrate(r, 'handoff')).replace(/\n/g, ' ')
    await db.actionLog.add({ crewId: who, kind: 'note', ts: r.at, sync: 'pending', text: `VITA crew doctor (${scope === 'all' ? 'whole crew' : names([scope], r.roster)}): ${body}`.slice(0, 1400) })
    update({ logged: `Added to the ground log at ${met(r.at)}. It goes down with the next sync.` })
  }

  const flagged = shell.crew.filter((c) => c.status !== 'nominal').length
  const fit = r.crew.filter((c) => c.evaFit).length
  return (
    <div className="dr">
      <header className="dr-head">
        <p className="dr-eyebrow"><Stethoscope size={14} aria-hidden="true" /> AI crew doctor · {r.met}</p>
        <h1 className="dr-h1">VITA, <span>Crew Doctor</span></h1>
        <p className="dr-lede">Reads every crew member’s data together and tells you what matters and what to do next.</p>
      </header>

      <div className="dr-grid">
        <div className="dr-col dr-left">
          <HudPanel title="Crew" meta={`${flagged} flagged`} className="dr-crew">
            <ul role="list">
              <li>
                <button type="button" className={`dr-pick${scope === 'all' ? ' on' : ''}`} aria-pressed={scope === 'all'} onClick={() => setScope('all')}>
                  <span className="dr-pick-ic"><Users size={16} aria-hidden="true" /></span>
                  <span className="dr-pick-t"><b>Whole crew</b><small>{shell.crew.length} aboard · cabin-wide view</small></span>
                  {scope === 'all' && <Check className="dr-pick-ok" size={16} aria-hidden="true" />}
                </button>
              </li>
              {shell.crew.map((c) => (
                <li key={c.id}>
                  <button type="button" className={`dr-pick st-${c.status}${scope === c.id ? ' on' : ''}`} aria-pressed={scope === c.id} onClick={() => setScope(c.id)}>
                    <span className="dr-pick-ic dr-ring" aria-hidden="true">{c.name.split(/\s+/).map((w) => w[0]).join('').slice(0, 2)}</span>
                    <span className="dr-pick-t"><b>{c.name}</b><small>{c.worstHazard ? `${c.worstHazard} · ` : ''}readiness {c.readiness}</small></span>
                    {c.status !== 'nominal' ? <StatusTag status={c.status} short /> : scope === c.id ? <Check className="dr-pick-ok" size={16} aria-hidden="true" /> : null}
                  </button>
                </li>
              ))}
            </ul>
          </HudPanel>
          <HudPanel title="Report style" className="dr-style">
            <ul role="list">
              {STYLES.map((s) => (
                <li key={s.id}>
                  <button type="button" className={`dr-pick${style === s.id ? ' on' : ''}`} aria-pressed={style === s.id} onClick={() => setStyle(s.id)}>
                    <span className="dr-pick-t"><b>{s.label}</b><small>{s.hint}</small></span>
                    {style === s.id && <Check className="dr-pick-ok" size={16} aria-hidden="true" />}
                  </button>
                </li>
              ))}
            </ul>
          </HudPanel>
        </div>

        <HudPanel hero aria-label="VITA" className="dr-stage">
          <p className="dr-badge"><Sparkles size={15} aria-hidden="true" /> VITA · AI crew doctor</p>
          <div className="dr-holo">
            <div className="dr-bubble" role="log" aria-live="polite" aria-label="What VITA says">
              {shown.question && <p className="dr-q">“{shown.question}”</p>}
              {busy ? <p className="dr-thinking" role="status">VITA is reading the crew data<span className="vita-dots"><i /><i /><i /></span></p>
                : shown.paragraphs.map((p, i) => <p key={i}>{p.label && <b>{p.label}: </b>}<Rich text={p.text} /></p>)}
              {!busy && !!shown.citations.length && (
                <p className="dr-cites">{shown.citations.map((c) => <a key={c.url} href={c.url} target="_blank" rel="noopener noreferrer">{c.label}</a>)}</p>
              )}
              <p className="dr-src">{busy ? '' : shown.source === 'live' ? 'Worded live by VITA from the console’s exam' : 'From the console’s exam, on this device'}</p>
            </div>
            <div className="dr-figure">
              <VitaAvatar talking={speaking || busy} size={270} />
              <Pedestal talking={speaking || busy} width={440} height={180} />
            </div>
          </div>
          <ul className="dr-badges" role="list">
            {BADGES.map(({ icon: Icon, label, title }) => <li key={label} title={title}><Icon size={14} aria-hidden="true" /> {label}</li>)}
          </ul>
        </HudPanel>

        <div className="dr-col dr-right">
          <HudPanel title="What I check" meta={r.scope === 'all' ? 'whole crew' : names([r.scope], r.roster)} className="dr-checks">
            <ul role="list">
              {r.checks.map((c) => {
                const Icon = HAZARD_ICON[c.hazard]
                return (
                  <li key={c.hazard} className={`st-${c.status}`}>
                    <span className="dr-chk-ic"><Icon size={16} aria-hidden="true" /></span>
                    <span className="dr-chk-t"><b>{c.name}</b><small>{c.line}</small></span>
                    <StatusTag status={c.status} short />
                  </li>
                )
              })}
            </ul>
          </HudPanel>
          <HudPanel title="Ask me" className="dr-asks">
            <ul role="list">
              {ASK.map((q) => <li key={q}><button type="button" onClick={() => void ask(q)} disabled={busy}>{q}</button></li>)}
            </ul>
          </HudPanel>
        </div>
      </div>

      <form className="dr-ask hp" onSubmit={submit} autoComplete="off" aria-label="Consult VITA">
        <p className="dr-ask-h">Consult VITA</p>
        <div className="dr-ask-row">
          <label className="dr-field">
            <span>Question</span>
            <input ref={input} value={text} onChange={(e) => setText(e.target.value)} onKeyDown={onKey} maxLength={500} placeholder="Ask about the crew: “Who is cleared for EVA?”" />
          </label>
          {SR && <button type="button" className={`dr-icon${listening ? ' listening' : ''}`} onClick={mic} aria-label={listening ? 'Stop listening' : 'Speak your question'}><Mic size={16} aria-hidden="true" /></button>}
          <button type="submit" className="dr-icon" disabled={busy || !text.trim()} aria-label="Ask VITA"><SendHorizontal size={16} aria-hidden="true" /></button>
          <span className="dr-ask-sep" aria-hidden="true" />
          <Button onClick={() => void runExam()} busy={busy}><Stethoscope size={16} aria-hidden="true" /> Run exam</Button>
          {speaking
            ? <Button variant="ghost" onClick={vitaStop}><Square size={14} aria-hidden="true" /> Stop</Button>
            : <Button variant="ghost" onClick={() => void vitaSay(spoken)} disabled={busy}><Volume2 size={16} aria-hidden="true" /> Read aloud</Button>}
          <Button variant="ghost" onClick={() => void addToLog()} disabled={busy}><ClipboardPlus size={16} aria-hidden="true" /> Add to ground log</Button>
        </div>
        <p className="dr-ask-note" aria-live="polite">{logged || (!sound.on ? 'Sound is off, so VITA answers in text. Turn the speaker on at the top of the screen to hear her.' : `${fit} of ${r.crew.length} cleared for EVA on today’s data.`)}</p>
      </form>

      <div className="dr-consult">
        <HudPanel title="Findings" meta={`${r.findings.length} open · ${r.watchlist.length} watching`} className="dr-findings" tone={r.overall}>
          {!r.findings.length && <p className="dr-empty">Nothing open. Every metric is within the person’s own baseline.</p>}
          <ol role="list">
            {r.findings.map((f) => (
              <li key={f.id} className={`st-${f.status}`}>
                <p className="dr-f-t"><StatusTag status={f.status} short /> <b>{f.title}</b>{f.cabinWide && <span className="dr-chip">cabin-wide</span>}</p>
                <p className="dr-f-why">{f.why}</p>
                <p className="dr-f-m">since {met(f.since)}{f.ref && <> · <NasaRef label={f.ref.label} href={f.ref.url} /></>}</p>
              </li>
            ))}
            {r.watchlist.map((w) => (
              <li key={w.id} className="dr-watch">
                <p className="dr-f-t"><span className="dr-chip">watching</span> <b>{w.title}</b></p>
                <p className="dr-f-why">{w.why}</p>
              </li>
            ))}
          </ol>
        </HudPanel>
        <HudPanel title="What VITA suggests" meta={`${r.advice.length} steps`} className="dr-advice">
          {!r.advice.length && <p className="dr-empty">No steps needed. Keep to the daily check-in and exercise plan.</p>}
          {PRIORITY.map((p) => {
            const xs = r.advice.filter((a) => a.priority === p.id)
            if (!xs.length) return null
            return (
              <section key={p.id} className={`dr-adv dr-adv-${p.id}`} aria-label={p.label}>
                <h3>{p.label}</h3>
                <ul role="list">{xs.map((a) => <li key={a.text}><b>{a.text}</b><small>for {whoOf(a, r)} · {a.why}</small></li>)}</ul>
              </section>
            )
          })}
        </HudPanel>
        <HudPanel title="Crew fitness" meta="triage order" className="dr-fit">
          <ol role="list">
            {r.crew.map((c) => (
              <li key={c.id} className={`st-${c.status}`}>
                <span className="dr-fit-n"><b>{c.name}</b><small>{c.evaWhy}</small></span>
                <span className="dr-fit-r" aria-label={`Readiness ${c.readiness}`}><i style={{ width: `${c.readiness}%` }} />{c.readiness}</span>
                <span className={`dr-eva ${c.evaFit ? 'ok' : 'no'}`}>{c.evaFit ? 'EVA ✓' : 'EVA ✗'}</span>
              </li>
            ))}
          </ol>
        </HudPanel>
      </div>
      <p className="dr-note">VITA is decision support for a concept prototype, not a medical device. She reads the console’s own alerts and baselines; the flight surgeon makes every medical call.</p>
    </div>
  )
}

