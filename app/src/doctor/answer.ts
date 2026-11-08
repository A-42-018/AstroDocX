import type { Hazard, MetricId } from '../data/types'
import { names, type DoctorReport, type Finding } from './analyze'
import { narrate, narrativeText, whoOf } from './brief'

/*
 * VITA answers follow-up questions about the crew from the report alone, offline: who first, who is cleared for a
 * spacewalk, one crew member, or one area (sleep, radiation, air, exercise), or the ground handoff. The same decline
 * as the guide's for personal medical questions: she reads console data, she does not diagnose or prescribe.
 */

export type Intent = 'decline' | 'crew' | 'triage' | 'eva' | 'sleep' | 'radiation' | 'air' | 'exercise' | 'handoff' | 'summary' | 'fallback'
export interface Answer { intent: Intent; text: string; crewId?: string }

export const DECLINE = 'I can’t diagnose or prescribe. I read the crew’s console data and suggest the on-board steps. For your own symptoms, log them in today’s check-in and talk to the Medical Officer or the flight surgeon.'
const HELP = 'You can ask me who needs attention first, who is cleared for EVA, how one crew member is doing, or about sleep, radiation, cabin air or exercise.'

const PERSONAL = /what('?s| is) wrong with me|diagnos|prescri|what (should|can) i take|\b(medicine|medication|pills?|drugs?|painkillers?)\b|\bam i (sick|ill|ok)\b|\bmy (symptoms?|headache|pain|fever)\b/i
const RULES: [Intent, RegExp][] = [
  ['handoff', /hand ?off|flight surgeon|sbar|ground (report|team)|report (for|to) (the )?ground|write .*(report|summary)/i],
  ['triage', /first|priorit|attention|worst|most (urgent|at risk)|triage|who .*(worry|concern)|who needs/i],
  ['eva', /\beva\b|space ?walk|fit (for|to)|cleared|go outside/i],
  ['sleep', /sleep|tired|fatigue|rest\b|reaction|insomnia|mood|isolation/i],
  ['radiation', /radiation|dose|solar|\bspe\b|millisievert|msv|shield/i],
  ['air', /co₂|co2|carbon|air\b|scrubber|oxygen|spo|cabin|temperature|noise|environment/i],
  ['exercise', /exercis|muscle|bone|gravity|heart|hrv|deconditio|workout/i],
  ['summary', /summar|overview|status|how('?s| is| are) (the )?(crew|everyone|everybody|team)|brief|check (the )?crew|exam/i],
]
const AREA: Partial<Record<Intent, { hazard: Hazard[]; metrics?: MetricId[]; noun: string }>> = {
  sleep: { hazard: ['I'], noun: 'sleep and alertness' },
  radiation: { hazard: ['R'], noun: 'radiation' },
  air: { hazard: ['E'], noun: 'cabin air and environment' },
  exercise: { hazard: ['G'], noun: 'exercise, heart and muscle' },
}

const statusWord = (f: Finding) => (f.status === 'nominal' ? 'drifting' : f.status.toUpperCase())

/** Words in crew names that are also everyday words in a question ("the mission", "medical advice"). */
const COMMON = new Set(['mission', 'flight', 'medical', 'specialist', 'crew'])

/** Which crew member a question names: a full name first ("flight engineer"), then a word only one name has ("engineer"). */
export function crewIn(q: string, r: DoctorReport): string | undefined {
  const s = q.toLowerCase()
  const full = r.roster.find((c) => s.includes(c.name.toLowerCase()) || new RegExp(`\\b${c.id}\\b`).test(s))
  if (full) return full.id
  const words = (s.match(/[a-z]{4,}/g) ?? []).filter((w) => !COMMON.has(w))
  for (const w of words) {
    const hit = r.roster.filter((c) => c.name.toLowerCase().split(/\s+/).some((p) => p.startsWith(w) || w.startsWith(p)))
    if (hit.length === 1) return hit[0].id
  }
  return undefined
}

function aboutCrew(r: DoctorReport, id: string): string {
  const c = r.crew.find((x) => x.id === id)
  const name = r.roster.find((x) => x.id === id)?.name ?? id
  if (!c) return `${name} is not in this exam. Pick “Whole crew” to include everyone.`
  const fs = r.findings.filter((f) => !f.crewIds.length || f.crewIds.includes(id))
  const steps = r.advice.filter((a) => !a.crewIds.length || a.crewIds.includes(id)).slice(0, 2).map((a) => a.text)
  if (!fs.length) return `${name} is within baseline on every hazard, readiness ${c.readiness}. ${c.evaFit ? 'Cleared for EVA.' : c.evaWhy}`
  return [
    `${name} is at ${c.status.toUpperCase()}, readiness ${c.readiness}.`,
    `${fs[0].why}`,
    fs.length > 1 ? `Also: ${fs.slice(1, 3).map((f) => `${f.title.replace(/^[^:]+: /, '')} (${statusWord(f)})`).join(', ')}.` : '',
    steps.length ? `What I suggest: ${steps.join('; ')}.` : '',
    c.evaFit ? 'Cleared for EVA.' : c.evaWhy.replace(/^Not cleared:/, 'Not cleared for EVA:'),
  ].filter(Boolean).join(' ')
}

function triage(r: DoctorReport): string {
  const flagged = r.crew.filter((c) => c.status !== 'nominal')
  if (!flagged.length) return `Nobody needs attention right now: all ${r.crew.length} crew are within their baselines.`
  const order = flagged.map((c, i) => `${i + 1}. ${c.name} (${c.status.toUpperCase()}, ${c.worstHazard ?? 'open alert'}, readiness ${c.readiness})`)
  const top = r.advice.find((a) => a.priority === 'now')
  return `In order: ${order.join('; ')}.${top ? ` First step: ${top.text}${top.crewIds.length ? ` for ${whoOf(top, r)}` : ''}.` : ''} Everyone else is within baseline.`
}

function eva(r: DoctorReport): string {
  const fit = r.crew.filter((c) => c.evaFit), not = r.crew.filter((c) => !c.evaFit)
  if (!not.length) return `All ${fit.length} crew in this exam are cleared for EVA on today’s data.`
  return [
    fit.length ? `Cleared for EVA: ${names(fit.map((c) => c.id), r.roster)}.` : 'Nobody in this exam is cleared for EVA today.',
    ...not.map((c) => `${c.name}: ${c.evaWhy.replace(/^Not cleared: /, '')}`),
    'This is a screen on console data; the flight surgeon makes the call.',
  ].join(' ')
}

function area(r: DoctorReport, intent: Intent): string {
  const a = AREA[intent]!
  const fs = [...r.findings, ...r.watchlist].filter((f) => a.hazard.includes(f.hazard))
  const check = r.checks.find((c) => a.hazard.includes(c.hazard))
  if (!fs.length) return `On ${a.noun}: ${check?.line ?? 'nothing flagged'}. Nothing to do there right now.`
  const steps = r.advice.filter((x) => fs.some((f) => f.title === x.why)).slice(0, 2).map((x) => x.text)
  return [
    `On ${a.noun}: ${fs.slice(0, 3).map((f) => `${f.title} (${statusWord(f)})`).join('; ')}.`,
    fs[0].why,
    steps.length ? `What I suggest: ${steps.join('; ')}.` : '',
  ].filter(Boolean).join(' ')
}

const brief = (r: DoctorReport) => narrativeText(narrate(r, 'brief')).replace(/\n/g, ' ')

/** Answer a question about the crew from the report. Never throws. */
export function answer(question: string, r: DoctorReport): Answer {
  const q = String(question ?? '').trim()
  if (!q) return { intent: 'summary', text: brief(r) }
  if (PERSONAL.test(q)) return { intent: 'decline', text: DECLINE }
  const intent = RULES.find(([, re]) => re.test(q))?.[0]
  const who = crewIn(q, r)
  if (who && intent !== 'triage' && intent !== 'handoff') return { intent: 'crew', crewId: who, text: aboutCrew(r, who) }
  switch (intent) {
    case 'triage': return { intent, text: triage(r) }
    case 'eva': return { intent, text: eva(r) }
    case 'handoff': return { intent, text: narrativeText(narrate(r, 'handoff')) }
    case 'summary': return { intent, text: brief(r) }
    case undefined: return { intent: 'fallback', text: `${brief(r)} ${HELP}` }
    default: return { intent, text: area(r, intent) }
  }
}
