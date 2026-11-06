import { CAREER_DOSE_MSV } from '../engine/limits'
import { met } from '../engine/actions'
import { lc, names, type Advice, type DoctorReport } from './analyze'

/*
 * VITA's report in words, in three styles (the "tone" of the reference design): a short spoken brief, a clinical
 * read-out with every number, and an SBAR handoff for the flight surgeon on the ground. All of it is built from the
 * report, so the live layer can only re-word it, never add to it.
 */

export type Style = 'brief' | 'clinical' | 'handoff'

export const STYLES: { id: Style; label: string; hint: string }[] = [
  { id: 'brief', label: 'Brief', hint: 'Two or three lines, spoken' },
  { id: 'clinical', label: 'Clinical', hint: 'Every finding, with numbers' },
  { id: 'handoff', label: 'Ground handoff', hint: 'SBAR for the flight surgeon' },
]

export interface Paragraph { label?: string; text: string }
export interface Narrative { style: Style; paragraphs: Paragraph[] }

/** "for Pilot" / "for the whole crew". */
export const whoOf = (a: Advice, r: DoctorReport) => names(a.crewIds, r.roster)
const step = (a: Advice, r: DoctorReport, low = false) => `${low ? lc(a.text) : a.text}${a.crewIds.length ? ` (${whoOf(a, r)})` : ''}`
const list = (xs: string[]) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join('; ')}; and ${xs[xs.length - 1]}`)
const sentence = (s: string) => (/[.!?]$/.test(s) ? s : `${s}.`)

/** The first step for each of the top two people or problems, so a short brief covers more than one person. */
function firstPerFinding(xs: Advice[]): Advice[] {
  const seen = new Set<string>(), out: Advice[] = []
  for (const a of xs) {
    const who = a.crewIds.join('+')
    if (seen.has(who)) continue
    seen.add(who); out.push(a)
    if (out.length === 2) break
  }
  return out
}

function brief(r: DoctorReport): Paragraph[] {
  const out: Paragraph[] = [{ text: r.headline }]
  const now = firstPerFinding(r.advice.filter((a) => a.priority === 'now'))
  const today = firstPerFinding(r.advice.filter((a) => a.priority === 'today'))
  if (now.length) out.push({ text: sentence(`Right now: ${list(now.map((a) => step(a, r, true)))}`) })
  else if (today.length) out.push({ text: sentence(`Today: ${list(today.map((a) => step(a, r, true)))}`) })
  if (r.scope === 'all') {
    const fit = r.crew.filter((c) => c.evaFit).length
    const watch = r.watchlist[0]
    const tail = [
      r.crew.length > 1 ? (fit === r.crew.length ? 'Everyone is cleared for EVA' : `${fit} of ${r.crew.length} crew are cleared for EVA`) : '',
      watch ? `I am also keeping an eye on ${watch.title.replace(': ', '’s ').replace(' drifting', '')}` : '',
    ].filter(Boolean)
    if (tail.length) out.push({ text: sentence(tail.join('. ')) })
  } else if (r.crew[0]) {
    out.push({ text: sentence(r.crew[0].evaWhy.replace(/^Cleared:/, 'Cleared for EVA:').replace(/^Not cleared:/, 'Not cleared for EVA:')) })
  }
  return out
}

function clinical(r: DoctorReport): Paragraph[] {
  const out: Paragraph[] = [{ text: r.headline }]
  for (const f of r.findings) out.push({ label: `${f.status.toUpperCase()} · ${f.title}`, text: f.why + (f.cabinWide ? ` Seen in ${names(f.crewIds, r.roster)}: treat it as a cabin problem.` : '') })
  if (r.watchlist.length) out.push({ label: 'Watching', text: r.watchlist.map((w) => w.why).join(' ') })
  const fit = r.crew.filter((c) => c.evaFit), not = r.crew.filter((c) => !c.evaFit)
  out.push({ label: 'EVA', text: [fit.length ? `Cleared: ${fit.map((c) => c.name).join(', ')}.` : '', ...not.map((c) => `${c.name}: ${c.evaWhy.replace(/^Not cleared: /, '')}`)].filter(Boolean).join(' ') })
  out.push({ label: 'Mission', text: missionLine(r) })
  return out
}

function missionLine(r: DoctorReport) {
  const m = r.mission
  const sync = m.sinceSyncH === null ? 'never synced with the ground' : `last ground sync ${m.sinceSyncH.toFixed(1)} h ago`
  return `Highest cumulative dose ${m.maxDoseMsv.toFixed(1)} of ${CAREER_DOSE_MSV} mSv; ${sync}, ${m.pendingSync} log entries pending.`
}

function handoff(r: DoctorReport): Paragraph[] {
  const open = r.findings.filter((f) => f.status !== 'nominal')
  const people = new Set(open.flatMap((f) => (f.crewIds.length ? f.crewIds : r.crew.map((c) => c.id))))
  const now = r.advice.filter((a) => a.priority === 'now'), later = r.advice.filter((a) => a.priority !== 'now')
  return [
    { label: 'Situation', text: `${r.met}. ${r.scope === 'all' ? `${r.mission.crewCount} crew aboard` : r.crew[0]?.name ?? 'Crew member'}, overall ${r.overall.toUpperCase()}. ${r.headline}` },
    { label: 'Background', text: `${open.length ? `${open.length} open finding${open.length > 1 ? 's' : ''} across ${people.size} crew` : 'No open findings'}. ${missionLine(r)}` },
    { label: 'Assessment', text: open.length ? open.map((f) => `${f.title} (${f.status.toUpperCase()} since ${met(f.since)})`).join('; ') + '.' : 'Crew within personal baselines on all five hazards.' },
    { label: 'Recommendation', text: [now.length ? `Now: ${now.map((a) => step(a, r)).join('; ')}.` : '', later.length ? `Next: ${later.slice(0, 4).map((a) => step(a, r)).join('; ')}.` : '', 'Flight surgeon to confirm.'].filter(Boolean).join(' ') },
  ]
}

export function narrate(r: DoctorReport, style: Style = 'brief'): Narrative {
  return { style, paragraphs: style === 'clinical' ? clinical(r) : style === 'handoff' ? handoff(r) : brief(r) }
}

/** The narrative as one block of text (spoken, logged, sent to the live layer). */
export const narrativeText = (n: Narrative) => n.paragraphs.map((p) => (p.label ? `${p.label}: ${p.text}` : p.text)).join('\n')

/*
 * What VITA says in the 3D cabin: shorter, spoken lines from the same report.
 */

/** Clicking VITA: the brief for the whole crew, and a nudge to the screen with the rest. */
export function cabinBrief(r: DoctorReport): string {
  return `${narrativeText(narrate(r, 'brief')).replace(/\n/g, ' ')} The full consultation is on the Crew Doctor screen.`
}

/** On arrival, once: who she is and the one line that matters. */
export function cabinHello(r: DoctorReport): string {
  return `Hello, I am VITA, your crew doctor. ${r.headline} Click me any time for the full brief.`
}

/** After a crew member introduces themselves: VITA's one-line medical note on them. */
export function crewNote(r: DoctorReport, id: string): string {
  const c = r.crew.find((x) => x.id === id)
  if (!c) return ''
  const f = r.findings.find((x) => x.crewIds.includes(id) || (x.cabinWide && !x.crewIds.length))
  if (!f) return `Medical note: ${c.name} is within baseline on every hazard, readiness ${c.readiness}.${c.evaFit ? ' Cleared for EVA.' : ''}`
  const step = r.advice.find((a) => a.crewIds.includes(id) || (f.cabinWide && !a.crewIds.length))
  const what = f.cabinWide ? lc(f.title) : f.title.replace(/^[^:]+: /, '')
  return `Medical note: ${c.name}, ${what} at ${f.status.toUpperCase()}.${step ? ` ${sentence(step.text)}` : ''}`
}

/** A new ACT finding while you are in the cabin. */
export function actAlert(r: DoctorReport, findingId: string): string {
  const f = r.findings.find((x) => x.id === findingId)
  if (!f) return ''
  const step = r.advice.find((a) => a.why === f.title && a.priority === 'now')
  return `Crew doctor alert. ${f.title} is at ACT.${step ? ` ${sentence(step.text)}${step.crewIds.length ? '' : ' Whole crew.'}` : ''}`
}
