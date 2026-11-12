/**
 * The guided start: four short steps a first-time visitor does in front of the mirror. Each one ticks itself off once it
 * has been held for a moment, so nobody has to press "next". Pure logic: XrayPage feeds it one measurement per frame.
 */
export type StepId = 'center' | 'turn' | 'mouth' | 'hand'

export const STEPS: readonly { id: StepId; title: string; hint: string }[] = [
  { id: 'center', title: 'Center your face', hint: 'Look at the screen and move until your face is in the middle.' },
  { id: 'turn', title: 'Turn your head', hint: 'Turn slowly to one side. The skull turns with you.' },
  { id: 'mouth', title: 'Open your mouth', hint: 'Open wide and watch your jaw bone open.' },
  { id: 'hand', title: 'Raise a hand', hint: 'Hold a hand up in front of the camera to see its bones.' },
]

/** What the guide needs from one tracked frame. */
export interface Measure {
  /** null when no face is found. cx and cy run 0–1 across the picture; size is the distance between the eyes over its width. */
  face: { cx: number; cy: number; size: number; yaw: number; jaw: number } | null
  hands: number
}

/** How long (ms) each step must be held before it ticks off. */
const HOLD: Record<StepId, number> = { center: 500, turn: 200, mouth: 200, hand: 400 }

/** Is this step's pose there in this frame? */
export function met(step: StepId, m: Measure): boolean {
  const f = m.face
  switch (step) {
    case 'center': return !!f && Math.abs(f.cx - 0.5) < 0.18 && Math.abs(f.cy - 0.5) < 0.22 && f.size > 0.06
    case 'turn': return !!f && Math.abs(f.yaw) > 0.3
    case 'mouth': return !!f && f.jaw > 0.4
    case 'hand': return m.hands > 0
  }
}

/** One run through the steps. `step` is the index of the current one; STEPS.length means done. */
export class GuideRun {
  step = 0
  private since: number | null = null

  get done() { return this.step >= STEPS.length }

  /** Feeds one frame; true when the step changed. */
  feed(m: Measure, now: number): boolean {
    if (this.done) return false
    const id = STEPS[this.step].id
    if (!met(id, m)) { this.since = null; return false }
    this.since ??= now
    if (now - this.since < HOLD[id]) return false
    this.step++
    this.since = null
    return true
  }

  skip() { this.step = STEPS.length; this.since = null }
}

/** Head yaw (radians, 0 = facing the camera) from MediaPipe's column-major face transform. */
export function yawOf(m: ArrayLike<number> | null | undefined): number {
  if (!m || m.length < 16) return 0
  return Math.atan2(m[8], m[10])
}

interface Pt { x: number; y: number }
/** The guide's measurement of one tracked frame (face points in 0–1 picture coordinates). */
export function measureFrame(f: { face: { lm: readonly Pt[]; matrix: ArrayLike<number> | null; jaw: number } | null; hands: readonly unknown[] }): Measure {
  const lm = f.face?.lm
  if (!f.face || !lm || lm.length < 363) return { face: null, hands: f.hands.length }
  const m = (a: number, b: number) => ({ x: (lm[a].x + lm[b].x) / 2, y: (lm[a].y + lm[b].y) / 2 })
  const r = m(33, 133), l = m(263, 362)
  return {
    face: { cx: (r.x + l.x) / 2, cy: (r.y + l.y) / 2, size: Math.hypot(l.x - r.x, l.y - r.y), yaw: yawOf(f.face.matrix), jaw: f.face.jaw },
    hands: f.hands.length,
  }
}
