import { DAY, MISSION_START, rng } from '../data/synthetic'
import { hashSeed } from '../live/telemetry'
import { EXAMS, statusOf, worst, type Exam, type ExamId, type Measure } from './exams'
import type { Status } from '../data/types'

/*
 * What the simulated scanner measures. Each crew member has a preflight baseline (a small, fixed offset from a typical
 * healthy value). In flight the numbers drift the way long-duration studies describe (muscle thins, the optic nerve
 * sheath widens, the jugular vein swells, the heart shrinks a little), plus a few percent of measurement noise.
 * `concerning` swaps in a clearly abnormal set so the alert path can be shown.
 */

export type Finding = 'expected' | 'concerning'

/** Per-day drift as a fraction of the baseline (positive = grows). */
const DRIFT_PER_DAY: Record<string, number> = {
  lvef: -0.0006, lvedd: -0.001, ijv: 0.003, cpv: -0.001, blines: 0, sliding: 0, thickness: -0.0012, onsd: 0.001,
}
const MAX_DRIFT = 0.22

/** What the concerning case looks like, as the absolute value to report. */
const CONCERNING: Record<string, number> = { lvef: 38, lvedd: 41, ijv: 1.95, cpv: 52, blines: 7, sliding: 0, thickness: 19.5, onsd: 5.9 }

export const missionDay = (now: number) => Math.max(0, (now - MISSION_START) / DAY)

const round = (n: number, dec: number) => { const k = 10 ** dec; return Math.round(n * k) / k }

/** The crew member's own preflight value for one measure: within about 6 % of typical, always the same. */
export function baselineFor(crewId: string, m: Measure): number {
  if (m.flag) return 1
  if (m.typical === 0) return 0
  const r = rng(hashSeed(`${crewId}:${m.id}`))
  return round(m.typical * (1 + 0.06 * Math.max(-1, Math.min(1, r.gauss() / 2))), m.dec + 1)
}

export interface MeasuredValue {
  id: string
  value: number
  baseline: number
  status: Status
}

export interface ScanResult {
  exam: ExamId
  values: MeasuredValue[]
  status: Status
}

/** One scan's numbers. `seed` varies the noise from scan to scan; the same inputs always give the same result. */
export function measure(exam: Exam, crewId: string, day: number, finding: Finding, seed: number): ScanResult {
  const r = rng(hashSeed(`${crewId}:${exam.id}:${seed}`))
  const values = exam.measures.map((m): MeasuredValue => {
    const base = baselineFor(crewId, m)
    let v: number
    if (finding === 'concerning') v = CONCERNING[m.id] ?? base
    else if (m.flag) v = 1
    else {
      const drift = Math.max(-MAX_DRIFT, Math.min(MAX_DRIFT, (DRIFT_PER_DAY[m.id] ?? 0) * day))
      v = base * (1 + drift) * (1 + 0.012 * r.gauss())
      if (m.id === 'blines') v = Math.max(0, Math.round(0.4 + 0.5 * r.gauss()))
    }
    v = round(v, m.dec)
    return { id: m.id, value: v, baseline: base, status: statusOf(m, v, base) }
  })
  return { exam: exam.id, values, status: values.reduce<Status>((s, v) => worst(s, v.status), 'nominal') }
}

/** Plain words for the on-board log, so Ground sees what was measured. */
export function logLine(exam: Exam, res: ScanResult, quality: number, flagged = false): string {
  const parts = res.values.map((v) => {
    const m = exam.measures.find((x) => x.id === v.id)!
    if (m.flag) return `${m.label.toLowerCase()} ${v.value >= 0.5 ? 'present' : 'ABSENT'}`
    return `${m.label.toLowerCase()} ${v.value}${m.unit ? ' ' + m.unit : ''} (preflight ${v.baseline})`
  })
  const head = flagged ? 'FLAGGED for flight surgeon. ' : ''
  return `${head}Ultrasound, ${exam.label.toLowerCase()} (simulated imagery, guided scan): ${parts.join('; ')}; image quality ${Math.round(quality * 100)}%. Not diagnostic; not used for alerts.`
}

export { EXAMS }
