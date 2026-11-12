import type { Status } from '../data/types'

export type ExamId = 'cardiac' | 'vascular' | 'lung' | 'muscle' | 'ocular'

/**
 * How a measurement becomes a status. `abs`: compare the value with fixed limits. `rel`: compare it with the crew
 * member's own preflight value, because normal differs from person to person (muscle size, vessel size).
 * `dir` is the direction that is worrying.
 */
export type Rule =
  | { mode: 'abs'; dir: 'low' | 'high'; watchAt: number; actAt: number }
  | { mode: 'rel'; dir: 'low' | 'high' | 'both'; watch: number; act: number }

export interface Measure {
  id: string
  label: string
  unit: string
  dec: number
  /** A typical healthy preflight value; each crew member's own baseline sits close to it. */
  typical: number
  /** A yes/no finding stored as 1 or 0. */
  flag?: boolean
  rule: Rule
}

export interface Exam {
  id: ExamId
  label: string
  mode: string
  /** Where the probe goes, as a point on the body map (0..100 wide, 0..200 tall). */
  site: { x: number; y: number }
  siteName: string
  probe: string
  checks: string
  why: string
  measures: Measure[]
  /** The real spaceflight work this exam copies. */
  research: string
}

export const EXAMS: Exam[] = [
  {
    id: 'cardiac', label: 'Heart', mode: 'B-mode + M-mode', site: { x: 57, y: 58 }, siteName: 'Left chest, between the ribs',
    probe: 'Phased-array probe on the left side of the chest, marker toward the shoulder. Aim at the middle of the heart.',
    checks: 'Pumping strength and chamber size.',
    why: 'Fluid shifts and long weightlessness change heart shape and workload.',
    research: 'NASA Vascular Echo and CIPHER follow astronaut heart structure and function with ultrasound.',
    measures: [
      { id: 'lvef', label: 'Ejection fraction', unit: '%', dec: 0, typical: 62, rule: { mode: 'abs', dir: 'low', watchAt: 52, actAt: 40 } },
      { id: 'lvedd', label: 'LV end-diastolic size', unit: 'mm', dec: 0, typical: 48, rule: { mode: 'rel', dir: 'both', watch: 0.08, act: 0.15 } },
    ],
  },
  {
    id: 'vascular', label: 'Vessels', mode: 'B-mode + Doppler', site: { x: 54, y: 33 }, siteName: 'Side of the neck',
    probe: 'Linear probe flat across the side of the neck, just above the collarbone. Carotid artery and jugular vein show as two dark circles.',
    checks: 'Jugular vein size and blood speed in the carotid artery.',
    why: 'Fluid moves toward the head in weightlessness; a swollen jugular vein or slow flow can mean venous stagnation or clots.',
    research: 'NASA Vascular Echo found jugular flow changes in astronauts, and some had clots.',
    measures: [
      { id: 'ijv', label: 'Jugular vein area', unit: 'cm²', dec: 2, typical: 0.85, rule: { mode: 'abs', dir: 'high', watchAt: 1.2, actAt: 1.8 } },
      { id: 'cpv', label: 'Carotid peak velocity', unit: 'cm/s', dec: 0, typical: 85, rule: { mode: 'rel', dir: 'both', watch: 0.2, act: 0.4 } },
    ],
  },
  {
    id: 'lung', label: 'Lungs', mode: 'B-mode', site: { x: 41, y: 58 }, siteName: 'Right chest, between the ribs',
    probe: 'Probe along a rib space on the right side of the chest, marker toward the head. The bright line is the lung surface.',
    checks: 'Whether the lung surface slides with each breath, and whether fluid lines (B-lines) appear.',
    why: 'Sliding shows the lung is expanding; many B-lines point to fluid.',
    research: 'Crew on the ISS have used lung ultrasound, guided from the ground, in the NASA ADUM work.',
    measures: [
      { id: 'sliding', label: 'Lung sliding', unit: '', dec: 0, typical: 1, flag: true, rule: { mode: 'abs', dir: 'low', watchAt: 0.5, actAt: 0.5 } },
      { id: 'blines', label: 'B-lines', unit: 'count', dec: 0, typical: 0, rule: { mode: 'abs', dir: 'high', watchAt: 3, actAt: 6 } },
    ],
  },
  {
    id: 'muscle', label: 'Muscle', mode: 'B-mode', site: { x: 41, y: 128 }, siteName: 'Front of the thigh',
    probe: 'Linear probe across the middle of the thigh, no pressure. Muscle sits between the bright fascia lines, above the bone.',
    checks: 'Muscle thickness, compared with before launch.',
    why: 'Without load, muscle thins within weeks; thickness shows whether exercise is enough.',
    research: 'NASA muscle ultrasound work tracks thigh and calf thickness during missions.',
    measures: [
      { id: 'thickness', label: 'Thigh muscle thickness', unit: 'mm', dec: 1, typical: 24, rule: { mode: 'rel', dir: 'low', watch: 0.08, act: 0.15 } },
    ],
  },
  {
    id: 'ocular', label: 'Eye', mode: 'B-mode', site: { x: 50, y: 18 }, siteName: 'Closed eyelid, with gel',
    probe: 'Linear probe gently on the closed eyelid over gel, no pressure. The dark disc is the eye; the dark tube behind it is the optic nerve.',
    checks: 'Width of the sheath around the optic nerve.',
    why: 'Head-ward fluid can raise pressure behind the eye (spaceflight-associated neuro-ocular syndrome); a wider sheath is an early sign.',
    research: 'NASA studies SANS with eye ultrasound; a sheath wider than about 5.7 mm suggests raised pressure.',
    measures: [
      { id: 'onsd', label: 'Optic nerve sheath', unit: 'mm', dec: 1, typical: 4.6, rule: { mode: 'abs', dir: 'high', watchAt: 5.0, actAt: 5.7 } },
    ],
  },
]

export const examById = (id: string | null | undefined): Exam | undefined => EXAMS.find((e) => e.id === id)

/** Status of one value against its rule (and, for relative rules, the crew member's preflight baseline). */
export function statusOf(m: Measure, value: number, baseline: number): Status {
  const r = m.rule
  if (r.mode === 'abs') {
    const bad = (limit: number) => (r.dir === 'high' ? value >= limit : value < limit)
    if (m.flag) return value < 0.5 ? 'act' : 'nominal'
    return bad(r.actAt) ? 'act' : bad(r.watchAt) ? 'watch' : 'nominal'
  }
  if (!baseline) return 'nominal'
  const change = (value - baseline) / baseline
  const worse = r.dir === 'low' ? -change : r.dir === 'high' ? change : Math.abs(change)
  return worse >= r.act ? 'act' : worse >= r.watch ? 'watch' : 'nominal'
}

export const worst = (a: Status, b: Status): Status => (a === 'act' || b === 'act' ? 'act' : a === 'watch' || b === 'watch' ? 'watch' : 'nominal')
