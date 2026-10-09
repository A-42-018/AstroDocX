import type { MetricId } from '../data/types'

/**
 * Published NASA sources behind each alert's interpretation, shown under "Why this fired".
 * They give context for what a change in the metric can mean on a mission; the detection itself is the
 * engine's own rule against the personal baseline. Nothing here diagnoses.
 * Every id and title was checked against the OSDR and NTRS APIs (Oct 2026); OSDR studies carry their DOI.
 */
export interface Evidence {
  source: 'NASA OSDR' | 'NASA NTRS'
  id: string
  title: string
  /** Why this source is relevant to the metric, in one line. */
  why: string
  url: string
}

const osd = (n: number, title: string, doi: string, why: string): Evidence =>
  ({ source: 'NASA OSDR', id: `OSD-${n} · doi:${doi}`, title, why, url: `https://osdr.nasa.gov/bio/repo/data/studies/OSD-${n}` })
const ntrs = (id: string, title: string, why: string): Evidence =>
  ({ source: 'NASA NTRS', id, title, why, url: `https://ntrs.nasa.gov/citations/${id}` })

const CARDIAC_RHYTHM = ntrs('20170005625', 'Risk of Cardiac Rhythm Problems During Spaceflight',
  'Human Research Program evidence on heart rate and rhythm changes in flight.')
const ASTRONAUT_PLASMA = osd(484, 'Astronauts plasma-derived exosomes induced gene expression in AC16 cells', '10.26030/semj-9y19',
  'Astronaut blood after flight changes gene expression in human heart cells.')
const SLEEP_LOSS = ntrs('20160003864', 'Risk of Performance Decrements and Adverse Health Outcomes Resulting from Sleep Loss, Circadian Desynchronization, and Work Overload',
  'Human Research Program evidence linking short sleep to slower reactions and errors.')
const BEHAVIOURAL = ntrs('20160004365', 'Risk of Adverse Cognitive or Behavioral Conditions and Psychiatric Disorders: Evidence Report',
  'Human Research Program evidence on mood and behavioural health in isolation and confinement.')
const BED_REST_EXERCISE = osd(942, 'Exercise Training Attenuates the Muscle Mitochondria Genomic Response to Bed Rest (microarray data)', '10.26030/2ngb-7470',
  'Without exercise, unloaded muscle loses mitochondrial gene activity; training limits the loss.')
const SPACE_RADIATION = osd(993, 'Space radiation induces distinct senescent phenotypes: Implications for space travel [bulk RNA-Seq]', '10.26030/4kkv-z246',
  'Space-like radiation drives human cells into senescence, a long-term health risk of dose.')
const CO2_HEADACHES = ntrs('20160012725', 'Relationship Between Carbon Dioxide Levels and Reported Congestion and Headaches on the International Space Station',
  'ISS crew reports of headache and congestion rise with cabin CO₂.')

const BY_METRIC: Partial<Record<MetricId, Evidence[]>> = {
  hr: [CARDIAC_RHYTHM, ASTRONAUT_PLASMA],
  hrv: [CARDIAC_RHYTHM, ASTRONAUT_PLASMA],
  exercise: [BED_REST_EXERCISE],
  sleep: [SLEEP_LOSS],
  reaction: [SLEEP_LOSS],
  mood: [BEHAVIOURAL],
  dose: [SPACE_RADIATION],
  co2: [CO2_HEADACHES],
}

/** Sources for an alert's metric; the two-signal sleep + reaction rule cites the sleep-loss evidence once. Empty when none is mapped. */
export function evidenceFor(metric: MetricId): Evidence[] {
  return BY_METRIC[metric] ?? []
}

/** Every distinct source, for the README and the project page. */
export const ALL_EVIDENCE: Evidence[] = [...new Map(Object.values(BY_METRIC).flat().map((e) => [e.url, e])).values()]
