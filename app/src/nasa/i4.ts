import raw from './i4-labs.json'

/*
 * Real crew lab values from NASA's Open Science Data Repository: the SpaceX Inspiration4 mission (Sep 2021).
 * Four anonymised crew (C001..C004), blood and serum drawn three times before launch (L-92, L-44, L-3 days)
 * and four times after landing (R+1, R+45, R+82, R+194 days). Baked by tools/bake-i4-labs.mjs from OSD-569 and OSD-575.
 *
 * This is the one place the console uses measured astronaut data. Everything else on the Status Board is synthetic.
 * It is shown as context for the personal-baseline idea, never as a diagnosis.
 */

export type CrewCode = 'C001' | 'C002' | 'C003' | 'C004'
export type TimepointId = 'L-92' | 'L-44' | 'L-3' | 'R+1' | 'R+45' | 'R+82' | 'R+194'

export interface Timepoint {
  id: TimepointId
  /** Days relative to launch (L-) or landing (R+); the chart axis is "days from landing" with launch at about −3. */
  day: number
  /** Before launch? */
  pre: boolean
  label: string
}

/** Axis position is days from landing: the flight lasted about three days, so L-n sits at −(n + 3). */
export const TIMEPOINTS: readonly Timepoint[] = [
  { id: 'L-92', day: -95, pre: true, label: '92 days before launch' },
  { id: 'L-44', day: -47, pre: true, label: '44 days before launch' },
  { id: 'L-3', day: -6, pre: true, label: '3 days before launch' },
  { id: 'R+1', day: 1, pre: false, label: '1 day after landing' },
  { id: 'R+45', day: 45, pre: false, label: '45 days after landing' },
  { id: 'R+82', day: 82, pre: false, label: '82 days after landing' },
  { id: 'R+194', day: 194, pre: false, label: '194 days after landing' },
]

export interface Marker {
  id: string
  label: string
  unit: string
  /** The OSDR study the values come from. */
  osd: string
  source: string
  /** Lab reference range, where the source table gives one. */
  refMin?: number
  refMax?: number
  /** null: left out because the source row is not a plausible measurement (see EXCLUDED). */
  values: Record<CrewCode, Record<TimepointId, number | null>>
}

export interface Exclusion { crew: CrewCode; tp: TimepointId; panel: string; reason: string }

interface Baked {
  fetched: string
  crew: CrewCode[]
  timepoints: TimepointId[]
  studies: string[]
  excluded: Exclusion[]
  markers: Marker[]
}

const data = raw as unknown as Baked

export const CREW: readonly CrewCode[] = data.crew
export const MARKERS: readonly Marker[] = data.markers
export const EXCLUDED: readonly Exclusion[] = data.excluded
export const FETCHED = data.fetched
export const STUDIES: readonly string[] = data.studies

/** Number of measured values drawn (excluded rows are not counted). */
export const VALUE_COUNT = MARKERS.reduce((n, m) => n + CREW.reduce((k, c) => k + TIMEPOINTS.filter((t) => m.values[c][t.id] !== null).length, 0), 0)

/** The paper behind the mission data, and the studies used as data. */
export const I4_PAPER = { doi: '10.1038/s41586-024-07639-y', url: 'https://doi.org/10.1038/s41586-024-07639-y' }
export const osdUrl = (osd: string) => `https://osdr.nasa.gov/bio/repo/data/studies/${osd}`

/** The change that counts as worth a mention, as a share of the person's own baseline. */
export const NOTABLE_PCT = 10

/** Mean of a crew member's pre-flight values (L-92, L-44, L-3 where measured), or null with none. */
export function preflightBaseline(m: Marker, crew: CrewCode): number | null {
  const v = TIMEPOINTS.filter((t) => t.pre).map((t) => m.values[crew][t.id]).filter((x): x is number => x !== null)
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null
}

/** Lowest and highest pre-flight value, for the baseline band. */
export function preflightSpan(m: Marker, crew: CrewCode): [number, number] | null {
  const v = TIMEPOINTS.filter((t) => t.pre).map((t) => m.values[crew][t.id]).filter((x): x is number => x !== null)
  return v.length ? [Math.min(...v), Math.max(...v)] : null
}

/** Percent change of a timepoint against the person's own pre-flight mean; null when either is missing. */
export function changeAt(m: Marker, crew: CrewCode, tp: TimepointId): number | null {
  const base = preflightBaseline(m, crew), v = m.values[crew][tp]
  return base === null || v === null || base === 0 ? null : (v / base - 1) * 100
}

/** Inside the lab's reference range? undefined when the table gives none or the value is missing. */
export function inRange(m: Marker, value: number | null): boolean | undefined {
  if (value === null || m.refMin === undefined || m.refMax === undefined) return undefined
  return value >= m.refMin && value <= m.refMax
}

export interface LandingSummary {
  /** R+1 change for each crew member, null when it cannot be computed. */
  changes: Record<CrewCode, number | null>
  /** Crew whose R+1 value moved at least NOTABLE_PCT in the dominant direction. */
  movers: CrewCode[]
  direction: 'up' | 'down' | 'mixed' | 'flat'
  /** Of the movers, how many R+1 values still sit inside the lab's reference range (undefined without a range). */
  moversInRange?: number
  lo: number
  hi: number
}

/** What happened at the first post-flight draw (R+1), measured against each person's own pre-flight baseline. */
export function landingSummary(m: Marker): LandingSummary {
  const changes = Object.fromEntries(CREW.map((c) => [c, changeAt(m, c, 'R+1')])) as LandingSummary['changes']
  const notable = CREW.filter((c) => Math.abs(changes[c] ?? 0) >= NOTABLE_PCT)
  const up = notable.filter((c) => (changes[c] ?? 0) > 0), down = notable.filter((c) => (changes[c] ?? 0) < 0)
  const direction: LandingSummary['direction'] = !notable.length ? 'flat' : up.length && down.length ? 'mixed' : up.length ? 'up' : 'down'
  const movers = notable
  const mags = movers.map((c) => Math.abs(changes[c] ?? 0))
  const hasRange = m.refMin !== undefined && m.refMax !== undefined
  return {
    changes, movers, direction,
    moversInRange: hasRange ? movers.filter((c) => inRange(m, m.values[c]['R+1'])).length : undefined,
    lo: mags.length ? Math.min(...mags) : 0,
    hi: mags.length ? Math.max(...mags) : 0,
  }
}

/** One plain sentence for the selected marker; says what the data show, not what it means medically. */
export function landingSentence(m: Marker): string {
  const s = landingSummary(m)
  // lower-case the name mid-sentence, but not an initialism such as "C-reactive protein"
  const name = /^[A-Z]-/.test(m.label) ? m.label : m.label.toLowerCase()
  if (s.direction === 'flat') return `One day after landing, ${name} stayed within ${NOTABLE_PCT} % of every crew member's own pre-flight baseline.`
  const n = s.movers.length
  const dir = s.direction === 'mixed' ? 'moved' : s.direction === 'up' ? 'rose' : 'fell'
  const span = s.lo === s.hi ? `${Math.round(s.lo)} %` : `${Math.round(s.lo)}–${Math.round(s.hi)} %`
  const range = s.moversInRange === undefined ? '' : s.moversInRange === n
    ? ' All of those values still sit inside the lab’s reference range.'
    : s.moversInRange === 0 ? ' None of those values fall inside the lab’s reference range.'
      : ` ${s.moversInRange} of those ${n} values still sit inside the lab’s reference range.`
  return `One day after landing, ${name} ${dir} ${span} against their own pre-flight baseline in ${n} of 4 crew.${range}`
}

/** The ten public SpaceX Inspiration4 records in NASA OSDR (all released 14 May 2024). Titles are NASA's own. */
export interface I4Study { osd: string; title: string; what: string }
export const I4_STUDIES: readonly I4Study[] = [
  { osd: 'OSD-569', title: 'Whole Blood Measurements from the SpaceX Inspiration4 Mission (RNA-seq, epitranscriptome, WGS, clonal hematopoiesis, CBC)', what: 'Complete blood count and whole-blood sequencing' },
  { osd: 'OSD-570', title: 'SpaceX Inspiration4 PBMC Profiling: snRNA-seq, snATAC-seq, and T-cell and B-cell repertoire profiling', what: 'Immune-cell gene expression and receptor repertoires' },
  { osd: 'OSD-571', title: 'SpaceX Inspiration4 Plasma Profiling: Proteomics, EVPs, Metabolomics, cfDNA Sequencing and cfRNA Sequencing', what: 'Plasma proteins, metabolites, cell-free DNA and RNA' },
  { osd: 'OSD-572', title: 'SpaceX Inspiration4 Oral, Nasal, and Skin Metagenomic and Metatranscriptomic Microbial Swabs', what: 'Crew oral, nasal and skin microbiome' },
  { osd: 'OSD-573', title: 'SpaceX Inspiration4 Dragon Capsule Metagenomic and Metatranscriptomic Microbial Swabs', what: 'Microbes on the Dragon capsule surfaces (environment, not crew health)' },
  { osd: 'OSD-574', title: 'SpaceX Inspiration4 Deltoid Skin and Microbiome Data: Spatial Transcriptomics (NanoString GeoMx), Metageomics, and Metatranscriptomics', what: 'Skin biopsy gene expression and skin microbiome' },
  { osd: 'OSD-575', title: 'SpaceX Inspiration4 Blood Serum Metabolic Panel and Immune/Cardiac Cytokine Arrays (Comprehensive Metabolic Panel and Multiplex)', what: 'Blood chemistry, immune and cardiovascular markers' },
  { osd: 'OSD-630', title: 'SpaceX Inspiration4 Stool Metagenome Profiling', what: 'Gut microbiome' },
  { osd: 'OSD-656', title: 'SpaceX Inspiration4 Urine Inflammation Panel (Multiplex, NULISAseq)', what: 'Inflammatory proteins in urine' },
  { osd: 'OSD-687', title: 'SpaceX Inspiration4 T-Cell Histone Modification Profiling (H3K4me1, H3K4me3, H3K27ac)', what: 'T-cell epigenetics (one crew member; raw files restricted)' },
]

export interface UsedTable { osd: string; file: string; markers: string[]; values: number }

/** The source tables the panel actually draws from, with the markers taken from each. */
export const USED_TABLES: readonly UsedTable[] = [...new Set(MARKERS.map((m) => m.source))].map((file) => {
  const ms = MARKERS.filter((m) => m.source === file)
  return {
    osd: ms[0].osd, file, markers: ms.map((m) => m.label),
    values: ms.reduce((n, m) => n + CREW.reduce((k, c) => k + TIMEPOINTS.filter((t) => m.values[c][t.id] !== null).length, 0), 0),
  }
})
