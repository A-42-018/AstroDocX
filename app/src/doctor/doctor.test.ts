import 'fake-indexeddb/auto'
import { beforeAll, describe, expect, it } from 'vitest'
import { ConsoleDB } from '../data/db'
import type { Alert } from '../data/types'
import { stepsFor } from '../engine/actions'
import { seedDemo } from '../data/demo'
import { examine, lc, loadCrewExam, loadCrewInputs, names, type CrewInput, type DoctorReport } from './analyze'
import { answer, crewIn, DECLINE } from './answer'
import { actAlert, cabinBrief, cabinHello, crewNote, narrate, narrativeText } from './brief'

describe('the crew exam on the demo mission', () => {
  const d = new ConsoleDB('doctor-demo')
  let input: CrewInput[]
  let all: DoctorReport, pilot: DoctorReport
  beforeAll(async () => {
    await seedDemo(undefined, d)
    input = await loadCrewInputs(d)
    all = examine(input)
    pilot = (await loadCrewExam('pilot', d))!
  }, 120_000)

  it('puts the two affected crew first and clears the rest for EVA', () => {
    expect(all.overall).toBe('act')
    expect(all.crew.slice(0, 2).map((c) => c.id).sort()).toEqual(['eng', 'pilot'])
    expect(all.crew.slice(2).every((c) => c.status === 'nominal' && c.evaFit)).toBe(true)
    expect(all.crew.find((c) => c.id === 'pilot')!.evaFit).toBe(false)
    expect(all.headline).toMatch(/^2 of 6 crew need attention/)
    expect(all.roster).toHaveLength(6)
  })

  it('turns open alerts into ranked findings with the engine’s explanation and a NASA source', () => {
    expect(all.findings[0].status).toBe('act')
    const sleep = all.findings.find((f) => f.id === 'sleep:pilot')!
    expect(sleep.why).toMatch(/baseline/)
    expect(sleep.ref?.url).toMatch(/^https:\/\/ntrs\.nasa\.gov/)
    expect(all.findings.some((f) => f.cabinWide)).toBe(false)
  })

  it('orders advice now → today → next link, and briefs the flight surgeon on ACT findings', () => {
    const order = { now: 0, today: 1, 'next-link': 2 }
    const p = all.advice.map((a) => order[a.priority])
    expect(p).toEqual([...p].sort((a, b) => a - b))
    expect(all.advice[0].priority).toBe('now')
    expect(all.advice.some((a) => a.priority === 'next-link' && /flight surgeon/.test(a.text))).toBe(true)
    expect(new Set(all.advice.map((a) => a.text)).size).toBe(all.advice.length)
  })

  it('narrows to one crew member', () => {
    expect(pilot.scope).toBe('pilot')
    expect(pilot.crew.map((c) => c.id)).toEqual(['pilot'])
    expect(pilot.findings.every((f) => f.crewIds.includes('pilot'))).toBe(true)
    expect(pilot.headline).toMatch(/^Pilot: /)
  })

  it('has one check per RIDGE hazard', () => {
    expect(all.checks.map((c) => c.hazard)).toEqual(['R', 'I', 'D', 'G', 'E'])
    expect(all.checks.find((c) => c.hazard === 'G')!.status).toBe('act')
  })

  it('turns sleep trouble on two people into a schedule change', () => {
    const sleep = input.find((c) => c.member.id === 'pilot')!.snap.alerts.find((a) => a.ruleId === 'sleep')!
    const twin = input.map((c) => (c.member.id === 'cmdr' ? { ...c, snap: { ...c.snap, alerts: [{ ...sleep, crewId: 'cmdr' }] } } : c))
    const r = examine(twin)
    expect(r.advice.find((a) => /Re-plan/.test(a.text))?.crewIds.sort()).toEqual(['cmdr', 'pilot'])
  })

  it('writes the three report styles from the same report', () => {
    const b = narrate(all, 'brief'), c = narrate(all, 'clinical'), h = narrate(all, 'handoff')
    expect(b.paragraphs.length).toBeLessThanOrEqual(3)
    expect(narrativeText(b)).toMatch(/Right now:/)
    expect(c.paragraphs.some((p) => p.label?.startsWith('ACT · '))).toBe(true)
    expect(h.paragraphs.map((p) => p.label)).toEqual(['Situation', 'Background', 'Assessment', 'Recommendation'])
    expect(narrativeText(h)).toMatch(/Flight surgeon to confirm/)
  })

  it('answers follow-up questions from the report', () => {
    expect(answer('Who needs attention first?', all).intent).toBe('triage')
    expect(answer('Who needs attention first?', all).text).toMatch(/^In order: 1\. /)
    expect(answer('Is the crew fit for EVA tomorrow?', all).text).toMatch(/Cleared for EVA: .*Commander/)
    expect(answer('How is the pilot doing?', all)).toMatchObject({ intent: 'crew', crewId: 'pilot' })
    expect(answer('and the engineer?', all).crewId).toBe('eng')
    expect(answer('Any radiation concern?', all).intent).toBe('radiation')
    expect(answer('Write the handoff for the flight surgeon', all).text).toMatch(/^Situation: /)
    expect(answer('Summarise the mission', all).intent).toBe('summary')
    expect(answer('What should I take for my headache?', all)).toEqual({ intent: 'decline', text: DECLINE })
    expect(answer('tell me a joke', all).intent).toBe('fallback')
  })

  it('gives VITA short spoken lines for the 3D cabin', () => {
    expect(cabinHello(all)).toMatch(/^Hello, I am VITA, your crew doctor\. 2 of 6 crew need attention/)
    expect(cabinBrief(all)).toMatch(/Crew Doctor screen\.$/)
    expect(crewNote(all, 'pilot')).toBe('Medical note: Pilot, sleep last night at ACT. Swap safety-critical tasks to a rested crewmate.')
    expect(crewNote(all, 'cmdr')).toMatch(/^Medical note: Commander is within baseline on every hazard, readiness \d+\. Cleared for EVA\.$/)
    expect(crewNote(all, 'nobody')).toBe('')
    expect(actAlert(all, 'exercise:eng')).toBe('Crew doctor alert. Flight Engineer: exercise load is at ACT. Schedule a full exercise block with the commander today.')
  })

  it('finds crew names without mistaking everyday words for them', () => {
    expect(crewIn('how is the medical officer', all)).toBe('med')
    expect(crewIn('summary of the mission', all)).toBeUndefined()
    expect(crewIn('the specialist', all)).toBeUndefined()
  })
})

describe('a CO₂ scrubber fault on the whole crew', () => {
  // the same exam over the demo crew, with the CO₂ alert the engine would open on every member (no second seed)
  const d = new ConsoleDB('doctor-co2')
  let r: DoctorReport
  beforeAll(async () => {
    await seedDemo(undefined, d)
    const input = await loadCrewInputs(d)
    const tmpl = input.find((c) => c.member.id === 'pilot')!.snap.alerts[0]
    const co2 = (crewId: string): Alert => ({
      ...tmpl, id: undefined, crewId, ruleId: 'co2', kind: 'limit', hazard: 'E', metric: 'co2', status: 'act', peakStatus: 'act', value: 3.8,
      explanation: 'CO₂ has exceeded the 3 mmHg habitat limit (NASA-STD-3001 Vol. 2, V2 6004) for 6 consecutive hours (latest 3.80 mmHg).', steps: stepsFor('co2', 'act'),
    })
    r = examine(input.map((c) => ({ ...c, snap: { ...c.snap, alerts: [...c.snap.alerts, co2(c.member.id)] } })))
  }, 120_000)

  it('is one cabin-wide finding, not six personal ones, with whole-crew steps', () => {
    const co2 = r.findings.filter((f) => f.metric === 'co2')
    expect(co2).toHaveLength(1)
    expect(co2[0]).toMatchObject({ cabinWide: true, hazard: 'E', status: 'act' })
    expect(co2[0].crewIds).toHaveLength(6)
    expect(co2[0].ref?.label).toBe('STD-3001 V2 6004')
    expect(r.advice.some((a) => a.crewIds.length === 0 && /scrubber/i.test(a.text))).toBe(true)
    expect(r.crew.every((c) => !c.evaFit)).toBe(true)
    expect(r.checks.find((c) => c.hazard === 'E')!.line).toMatch(/^Cabin CO₂ .*\(6 crew\) ACT/)
    expect(answer('how is the cabin air?', r).text).toMatch(/^On cabin air/)
  })
})

describe('helpers', () => {
  it('keeps acronyms when lower-casing labels', () => {
    expect(lc('Sleep last night')).toBe('sleep last night')
    expect(lc('HRV')).toBe('HRV')
    expect(lc('SpO₂')).toBe('SpO₂')
  })
  it('joins names', () => {
    const roster = [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }, { id: 'c', name: 'C' }]
    expect(names([], roster)).toBe('the whole crew')
    expect(names(['a', 'b', 'c'], roster)).toBe('A, B and C')
  })
})
