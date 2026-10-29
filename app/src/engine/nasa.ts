import { METRICS, type Hazard, type MetricId } from '../data/types'
import { evidenceFor, type Evidence } from './evidence'
import { CAREER_DOSE_MSV, CO2_LIMIT_MMHG, SPE_DOSE_MSV } from './limits'

/*
 * The NASA basis of the console, in one place: NASA's five hazards of human spaceflight (the RIDGE groups the board
 * is built on), the NASA-STD-3001 limits the engine checks, and the NASA studies and Human Research Program reports
 * cited under each alert. The NASA Data page, the source tags and the README read from here. Every link was checked
 * (Oct 2026); limits without a NASA citation are labelled illustrative where they are used, and are not listed here.
 */

export const FIVE_HAZARDS_URL = 'https://www.nasa.gov/hrp/hazards/'

/** A NASA-STD-3001 limit the engine checks against, with the NASA technical brief that states it. */
export interface NasaStandard {
  /** Short tag, e.g. "STD-3001 V2 6004". */
  tag: string
  title: string
  value: string
  /** How AstroDocX applies it. */
  use: string
  url: string
}

const CO2_BRIEF = 'https://www.nasa.gov/wp-content/uploads/2023/12/ochmo-tb-004-carbon-dioxide.pdf'
const RADIATION_BRIEF = 'https://www.nasa.gov/wp-content/uploads/2023/03/radiation-protection-technical-brief-ochmo.pdf'

export const STANDARDS = {
  co2: {
    tag: 'STD-3001 V2 6004', title: 'NASA-STD-3001 Vol. 2 [V2 6004]: habitat carbon dioxide',
    value: `${CO2_LIMIT_MMHG} mmHg ppCO₂, 1-hour average`,
    use: 'Watch after 3 consecutive hours over the limit, Act after 6.', url: CO2_BRIEF,
  },
  spe: {
    tag: 'STD-3001 V1', title: 'NASA-STD-3001 Vol. 1: solar particle event dose',
    value: `${SPE_DOSE_MSV} mSv effective dose per event`,
    use: `Rolling 24-hour dose: Watch at ${SPE_DOSE_MSV / 2} mSv, Act at ${SPE_DOSE_MSV} mSv.`, url: RADIATION_BRIEF,
  },
  career: {
    tag: 'STD-3001 V1', title: 'NASA-STD-3001 Vol. 1: career radiation dose',
    value: `${CAREER_DOSE_MSV} mSv effective dose, career`,
    use: 'The ceiling the cumulative dose is read against.', url: RADIATION_BRIEF,
  },
} satisfies Record<string, NasaStandard>

/** The standard behind a metric's absolute limit, if it has one. */
export function standardFor(metric: MetricId): NasaStandard | undefined {
  return metric === 'co2' ? STANDARDS.co2 : metric === 'dose' ? STANDARDS.spe : undefined
}

/** One of NASA's five hazards, with what the console tracks for it and the NASA sources behind it. */
export interface HazardBasis {
  id: Hazard
  /** NASA's name for the hazard. */
  nasaName: string
  /** What NASA says the hazard does to the crew, in one line. */
  risk: string
  metrics: MetricId[]
  /** How AstroDocX responds to it. */
  response: string
  standards: NasaStandard[]
  evidence: Evidence[]
}

const metricsOf = (h: Hazard) => (Object.keys(METRICS) as MetricId[]).filter((m) => METRICS[m].hazard === h)
const evidenceOf = (ms: MetricId[]) => [...new Map(ms.flatMap(evidenceFor).map((e) => [e.url, e])).values()]

export const HAZARD_BASIS: HazardBasis[] = ([
  {
    id: 'R', nasaName: 'Space Radiation',
    risk: 'Outside Earth’s protective field, radiation raises long-term risks such as cancer and damage to the nervous system.',
    response: 'Tracks dose rate and cumulative dose, and checks the last 24 hours against the NASA per-event limit.',
    standards: [STANDARDS.spe, STANDARDS.career],
  },
  {
    id: 'I', nasaName: 'Isolation & Confinement',
    risk: 'Long missions in a small crew and a closed space wear on sleep, mood and performance.',
    response: 'Tracks sleep, mood and a psychomotor vigilance (reaction time) test against each person’s own baseline.',
    standards: [],
  },
  {
    id: 'D', nasaName: 'Distance from Earth',
    risk: 'Far from Earth, help and communication are delayed, so the crew must handle problems on board.',
    response: 'Works fully offline; action cards guide the crew, and Ground Sync flags data not yet sent to Earth (Watch at 24 h, Act at 72 h).',
    standards: [],
  },
  {
    id: 'G', nasaName: 'Gravity Fields',
    risk: 'Weightlessness unloads muscle and bone and changes how the heart works.',
    response: 'Tracks exercise load, heart rate and heart rate variability against each person’s own baseline.',
    standards: [],
  },
  {
    id: 'E', nasaName: 'Hostile/Closed Environments',
    risk: 'The cabin is a closed system: its air, temperature and noise affect crew health directly.',
    response: 'Tracks cabin CO₂ against the NASA habitat limit, plus SpO₂, temperature and noise.',
    standards: [STANDARDS.co2],
  },
] satisfies Omit<HazardBasis, 'metrics' | 'evidence'>[]).map((h) => {
  const metrics = metricsOf(h.id)
  return { ...h, metrics, evidence: evidenceOf(metrics) }
})

/** The short source tag for a hazard on the board: its NASA standard, else the kind of NASA evidence, else the hazard framework. */
export function hazardTag(id: Hazard): string {
  const h = HAZARD_BASIS.find((x) => x.id === id)
  if (h?.standards.length) return 'STD-3001'
  const kinds = [...new Set(h?.evidence.map((e) => e.source.replace('NASA ', '')) ?? [])]
  return kinds.length ? kinds.join(' · ') : 'HRP'
}

/** The NASA open-data services and programmes the project draws on. */
export interface NasaResource { name: string; what: string; url: string }
export const RESOURCES: NasaResource[] = [
  { name: 'NASA Human Research Program: the five hazards', what: 'The RIDGE framework the Status Board and readiness score are organised by.', url: FIVE_HAZARDS_URL },
  { name: 'NASA Open Science Data Repository (OSDR)', what: 'Spaceflight and analogue studies cited as evidence for heart, muscle and radiation alerts.', url: 'https://osdr.nasa.gov/bio/' },
  { name: 'NASA Technical Reports Server (NTRS)', what: 'Human Research Program evidence reports on heart rhythm, sleep loss, behavioural health and CO₂.', url: 'https://ntrs.nasa.gov/' },
  { name: 'NASA Office of the Chief Health & Medical Officer', what: 'Publishes NASA-STD-3001 and the technical briefs behind the CO₂ and radiation limits.', url: 'https://www.nasa.gov/ochmo/' },
  { name: 'NASA Human Research Roadmap', what: 'Where each Human Research Program risk and its evidence are tracked.', url: 'https://humanresearchroadmap.nasa.gov/' },
  { name: 'NASA Visible Earth', what: 'Earth imagery seen from the 3D cabin window.', url: 'https://visibleearth.nasa.gov/' },
  { name: 'NASA 3D Resources', what: 'The Z2 spacesuit, Orion and TDRS models on the landing page.', url: 'https://science.nasa.gov/3d-resources/' },
]

/** Every NASA citation the console makes, for counts and the README. */
export const NASA_SOURCE_COUNT = new Set([
  ...HAZARD_BASIS.flatMap((h) => [...h.evidence.map((e) => e.url), ...h.standards.map((s) => s.title)]),
]).size
