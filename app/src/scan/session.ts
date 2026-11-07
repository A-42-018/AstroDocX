import { HR_BAND, SCAN_SECONDS, analyze, bandpass, pos, resample, type Sample, type ScanAnalysis } from './rppg'
import { HINT, judge, newTracker, type FrameMeasure, type Verdict } from './roi'

/** Good frames needed in a row before the clock starts. */
const AIM_MS = 1500
/** A bad stretch longer than this throws the run away: filling a gap would invent a pulse. */
const GAP_MS = 700
/** Live heart rate appears after this many seconds. */
const LIVE_FROM_S = 10

export type Phase = 'aiming' | 'measuring' | 'done'

export interface SessionView {
  phase: Phase
  verdict: Verdict
  hint: string
  /** Seconds of clean video collected in this run. */
  seconds: number
  /** 0 to 1 */
  progress: number
  /** Band-passed pulse over the last few seconds, for drawing. */
  trace: Float64Array
  /** The running estimate, from 10 s on. */
  live: ScanAnalysis | null
  /** How many times a lost signal restarted the run. */
  restarts: number
  /** The full result, once the run is done. */
  final: ScanAnalysis | null
}

/**
 * One scan: wait for a steady, well-lit face, collect `SCAN_SECONDS` of continuous clean video, then analyse it.
 * Fed one `FrameMeasure` per camera frame. No camera, no DOM: tests drive it with synthetic frames.
 */
export class ScanSession {
  private samples: Sample[] = []
  private tracker = newTracker()
  private goodSince: number | null = null
  private lastGood = 0
  private view: SessionView = ScanSession.initial()
  private lastTick = -Infinity
  private lastLive = -Infinity

  static initial(): SessionView {
    return { phase: 'aiming', verdict: 'no-face', hint: HINT['no-face'], seconds: 0, progress: 0, trace: new Float64Array(0), live: null, restarts: 0, final: null }
  }

  get state(): SessionView { return this.view }

  /** Feed one frame; returns true when the view changed enough to redraw. */
  feed(m: FrameMeasure, t: number): boolean {
    const v = this.view
    if (v.phase === 'done') return false
    const verdict = judge(m, t, this.tracker)
    let changed = verdict !== v.verdict
    const next: SessionView = { ...v, verdict, hint: HINT[verdict] }

    if (verdict === 'ok') {
      this.lastGood = t
      if (v.phase === 'aiming') {
        this.goodSince ??= t
        if (t - this.goodSince >= AIM_MS) { next.phase = 'measuring'; this.samples = []; changed = true }
      }
      if (next.phase === 'measuring') this.samples.push({ t, r: m.r, g: m.g, b: m.b })
    } else if (v.phase === 'aiming') {
      this.goodSince = null
    } else if (t - this.lastGood > GAP_MS) {
      this.samples = []; this.goodSince = null
      Object.assign(next, { phase: 'aiming', seconds: 0, progress: 0, trace: new Float64Array(0), live: null, restarts: v.restarts + 1 })
      this.lastTick = -Infinity; this.lastLive = -Infinity
      changed = true
    }

    if (next.phase === 'measuring' && this.samples.length > 1) {
      const sec = (this.samples[this.samples.length - 1].t - this.samples[0].t) / 1000
      if (Math.floor(sec) !== Math.floor(v.seconds)) changed = true
      next.seconds = sec
      next.progress = Math.min(1, sec / SCAN_SECONDS)
      if (sec >= SCAN_SECONDS) {
        next.phase = 'done'; next.final = analyze(this.samples); next.live = next.final; changed = true
      } else {
        if (t - this.lastTick >= 250 && sec >= 3) { next.trace = this.trace(); this.lastTick = t; changed = true }
        if (sec >= LIVE_FROM_S && t - this.lastLive >= 1000) { next.live = analyze(this.samples.filter((s) => s.t > t - 20_000)); this.lastLive = t; changed = true }
      }
    }
    this.view = next
    return changed
  }

  /** Band-passed pulse of the last 8 s. */
  private trace(): Float64Array {
    const tail = this.samples.filter((s) => s.t > this.samples[this.samples.length - 1].t - 8000)
    return bandpass(pos(resample(tail)), HR_BAND[0], HR_BAND[1])
  }
}
