import { rng } from '../data/synthetic'

/*
 * Cabin sweep: several Wi-Fi nodes around the cabin, every pair of them a "link". A person standing near a link
 * disturbs it, in proportion to how much they move. From the disturbance on all links the scanner paints a heat map
 * (back-projection, the idea behind radio tomography), finds the blobs, follows them and sorts each one into an
 * activity from how strongly and how fast it moves. The crew here are simulated; the scanner only ever sees link
 * disturbances, never the crew's true positions.
 */

export const CABIN_W = 10 // metres, top-down
export const CABIN_H = 5
export const GW = 40
export const GH = 20
const CELL = CABIN_W / GW

export interface Pt { x: number; y: number }
export type Activity = 'Sleeping' | 'Working' | 'Eating' | 'Exercising' | 'Moving'

export interface Zone { id: string; label: string; x: number; y: number; w: number; h: number; anchor: Pt }
export const ZONES: Zone[] = [
  { id: 'sleep', label: 'Sleep quarters', x: 0, y: 0, w: 2.6, h: 5, anchor: { x: 1.2, y: 1.2 } },
  { id: 'lab', label: 'Lab', x: 2.6, y: 0, w: 4, h: 2.4, anchor: { x: 4.6, y: 1.1 } },
  { id: 'galley', label: 'Galley', x: 2.6, y: 2.4, w: 4, h: 2.6, anchor: { x: 4.6, y: 3.8 } },
  { id: 'gym', label: 'Exercise', x: 6.6, y: 0, w: 3.4, h: 5, anchor: { x: 8.4, y: 2.6 } },
]
export const zoneAt = (p: Pt): Zone => ZONES.find((z) => p.x >= z.x && p.x < z.x + z.w && p.y >= z.y && p.y < z.y + z.h) ?? ZONES[1]

/** Wi-Fi nodes: the access point and seven receivers. */
export const NODES: Pt[] = [
  { x: 0.3, y: 0.3 }, { x: 5, y: 0.3 }, { x: 9.7, y: 0.3 }, { x: 9.7, y: 2.5 }, { x: 9.7, y: 4.7 }, { x: 5, y: 4.7 }, { x: 0.3, y: 4.7 }, { x: 0.3, y: 2.5 },
]
export const LINKS: [number, number][] = NODES.flatMap((_, i) => NODES.slice(i + 1).map((__, j): [number, number] => [i, i + 1 + j]))

const SIGMA = 0.6 // how far from a link's line a person still disturbs it, in metres
const BP = 0.55 // spread used when painting the map

function distToSegment(p: Pt, a: Pt, b: Pt): number {
  const dx = b.x - a.x, dy = b.y - a.y
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy)))
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy))
}

/* ------------------------------------------------------------------ simulated crew */

interface Agent {
  id: string; name: string; p: Pt; activity: Activity | 'Transit'; zone: Zone; until: number; target: Pt | null; next: Zone
}

/** How much each activity moves the body, 0 to 1. */
const ENERGY: Record<string, number> = { Sleeping: 0.12, Working: 0.3, Eating: 0.36, Exercising: 0.9, Transit: 0.7 }
const FOR_ZONE: Record<string, Activity> = { sleep: 'Sleeping', lab: 'Working', galley: 'Eating', gym: 'Exercising' }
const SPEED = 0.7 // m/s while walking... floating, between handholds

export interface TruePerson { id: string; name: string; p: Pt; activity: Activity; moving: boolean }

export class CabinSim {
  t = 0
  private agents: Agent[]
  private rand: ReturnType<typeof rng>
  private lastLinks: number[] = LINKS.map(() => 0)

  constructor(crew: { id: string; name: string }[], seed = 5) {
    this.rand = rng(seed)
    const start = ['sleep', 'lab', 'lab', 'gym', 'galley', 'sleep']
    this.agents = crew.map((c, i) => {
      const zone = ZONES.find((z) => z.id === start[i % start.length])!
      const p = this.spot(zone, i)
      return { id: c.id, name: c.name, p, activity: FOR_ZONE[zone.id], zone, until: 10 + this.rand.next() * 40, target: null, next: zone }
    })
  }

  private spot(z: Zone, slot: number): Pt {
    // people do not stack: spread over the zone by slot, with a little jitter
    const col = slot % 2, row = Math.floor(slot / 2) % 3
    const x = z.x + z.w * (0.25 + 0.5 * col) + (this.rand.next() - 0.5) * 0.3
    const y = z.y + z.h * (0.2 + 0.3 * row) + (this.rand.next() - 0.5) * 0.3
    return { x: Math.max(z.x + 0.3, Math.min(z.x + z.w - 0.3, x)), y: Math.max(z.y + 0.3, Math.min(z.y + z.h - 0.3, y)) }
  }

  people(): TruePerson[] {
    return this.agents.map((a) => ({ id: a.id, name: a.name, p: { ...a.p }, activity: a.activity === 'Transit' ? 'Moving' : a.activity, moving: a.activity === 'Transit' }))
  }

  /** Advance by dt seconds; returns the disturbance on each link (what the receivers would report). */
  step(dt: number): number[] {
    this.t += dt
    this.agents.forEach((a, i) => {
      if (a.activity === 'Transit' && a.target) {
        const dx = a.target.x - a.p.x, dy = a.target.y - a.p.y
        const d = Math.hypot(dx, dy)
        if (d < 0.15) { a.p = { ...a.target }; a.zone = a.next; a.activity = FOR_ZONE[a.zone.id]; a.target = null; a.until = this.t + 30 + this.rand.next() * 40 }
        else { const s = Math.min(d, SPEED * dt); a.p = { x: a.p.x + (dx / d) * s, y: a.p.y + (dy / d) * s } }
      } else if (this.t >= a.until) {
        // pick a different zone; sleepers wake up first, so the crew circulates
        const room = (z: Zone) => this.agents.filter((o) => o !== a && (o.activity === 'Transit' ? o.next : o.zone) === z).length < (z.id === 'sleep' ? 3 : 2)
        const others = ZONES.filter((z) => z.id !== a.zone.id && room(z))
        if (!others.length) { a.until = this.t + 5; return }
        a.next = others[Math.floor(this.rand.next() * others.length)]
        a.target = this.spot(a.next, i + Math.floor(this.rand.next() * 3))
        a.activity = 'Transit'
      }
    })
    const raw = LINKS.map(([i, j]) => {
      let sum = 0
      for (const a of this.agents) {
        const d = distToSegment(a.p, NODES[i], NODES[j])
        let e = ENERGY[a.activity]
        if (a.activity === 'Exercising') e *= 0.65 + 0.35 * Math.sin(2 * Math.PI * 1.3 * this.t) ** 2 * 1.4 // repetitive: rises and falls each stroke
        sum += e * Math.exp(-((d / SIGMA) ** 2))
      }
      return sum + 0.012 * this.rand.gauss()
    })
    // receivers report over about a second, so smooth
    this.lastLinks = this.lastLinks.map((v, k) => v * 0.7 + Math.max(0, raw[k]) * 0.3)
    return this.lastLinks.slice()
  }
}

/* ------------------------------------------------------------------ scanner */

/** How much heat a unit of movement at each cell paints at that same cell: used to turn heat back into movement. */
const GAIN = (() => {
  const g = new Float32Array(GW * GH)
  const k = 1 / (SIGMA * SIGMA) + 1 / (BP * BP)
  for (let r = 0; r < GH; r++) for (let c = 0; c < GW; c++) {
    const p = { x: (c + 0.5) * CELL, y: (r + 0.5) * CELL }
    let s = 0
    for (const [i, j] of LINKS) s += Math.exp(-(distToSegment(p, NODES[i], NODES[j]) ** 2) * k)
    g[r * GW + c] = s
  }
  return g
})()

/** Grid cell centres' weight for each link, computed once. */
/** What one unit of movement at each cell does to each link, and the energy of that pattern. */
const FORWARD: Float32Array[] = Array.from({ length: GW * GH }, (_, n) => {
  const p = { x: ((n % GW) + 0.5) * CELL, y: (Math.floor(n / GW) + 0.5) * CELL }
  return Float32Array.from(LINKS, ([i, j]) => Math.exp(-((distToSegment(p, NODES[i], NODES[j]) / SIGMA) ** 2)))
})
const FF = FORWARD.map((f) => Math.max(1e-6, f.reduce((s, v) => s + v * v, 0)))
/** The roster size is known (six crew aboard), so never look for more people than that. */
const MAX_SOURCES = 6

const WEIGHT: Float32Array[] = LINKS.map(([i, j]) => {
  const w = new Float32Array(GW * GH)
  for (let r = 0; r < GH; r++) for (let c = 0; c < GW; c++) w[r * GW + c] = Math.exp(-((distToSegment({ x: (c + 0.5) * CELL, y: (r + 0.5) * CELL }, NODES[i], NODES[j]) / BP) ** 2))
  return w
})

export interface Track {
  id: number
  p: Pt
  /** m/s */
  speed: number
  /** Estimated movement 0..1, smoothed. */
  energy: number
  zone: Zone
  activity: Activity
  /** Recent positions, one per scan step, for judging how far the blob really travelled. */
  trail: Pt[]
  /** Recent single-step activity readings. */
  votes: Activity[]
  /** Seconds this track has been followed. */
  age: number
  hits: number
  missed: number
}

export class CabinScanner {
  /** Heat map, GW x GH, scaled so 1 is a person exercising. */
  readonly heat = new Float32Array(GW * GH)
  tracks: Track[] = []
  /** The sources found in the latest step, before they are followed over time. */
  lastPeaks: { p: Pt; e: number }[] = []
  private nextId = 1

  /** Feed one set of link disturbances. */
  update(links: number[], dt: number) {
    this.heat.fill(0)
    for (let l = 0; l < LINKS.length; l++) {
      const w = WEIGHT[l], v = links[l]
      for (let n = 0; n < this.heat.length; n++) this.heat[n] += v * w[n]
    }
    // divide by the gain at the cell: a cell the links cover well is not hotter just because of where it is
    const est = new Float32Array(this.heat.length)
    for (let n = 0; n < est.length; n++) est[n] = this.heat[n] / Math.max(GAIN[n], 0.8)
    for (let n = 0; n < est.length; n++) this.heat[n] = est[n]

    // sources: pick the cell that explains the most of what the links saw, take its share away, repeat. A ghost where two
    // links cross is explained by the real sources, so it does not survive (this is matching pursuit, a "CLEAN" step).
    const resid = links.slice()
    const peaks: { p: Pt; e: number }[] = []
    for (let k = 0; k < MAX_SOURCES; k++) {
      let bi = -1, bs = 0, be = 0
      for (let n = 0; n < GW * GH; n++) {
        let dot = 0
        const f = FORWARD[n]
        for (let l = 0; l < LINKS.length; l++) dot += resid[l] * f[l]
        if (dot <= 0) continue
        const sc = (dot * dot) / FF[n]
        if (sc > bs) { bs = sc; bi = n; be = dot / FF[n] }
      }
      if (bi < 0 || be < PEAK_MIN) break
      // stop when what is left is mostly noise
      if (k > 0 && resid.reduce((a, v) => a + v * v, 0) < 0.06 * links.reduce((a, v) => a + v * v, 0)) break
      peaks.push({ p: { x: ((bi % GW) + 0.5) * CELL, y: (Math.floor(bi / GW) + 0.5) * CELL }, e: be })
      for (let l = 0; l < LINKS.length; l++) resid[l] -= be * FORWARD[bi][l]
    }

    this.lastPeaks = peaks
    // follow them
    const used = new Set<Track>()
    for (const pk of peaks) {
      let best: Track | null = null, bd = 1.4
      for (const t of this.tracks) {
        const d = Math.hypot(t.p.x - pk.p.x, t.p.y - pk.p.y)
        if (!used.has(t) && d < bd) { bd = d; best = t }
      }
      if (best) {
        used.add(best)
        const nx = best.p.x * 0.8 + pk.p.x * 0.2, ny = best.p.y * 0.8 + pk.p.y * 0.2
        best.p = { x: nx, y: ny }
        best.trail.push(best.p); if (best.trail.length > TRAIL) best.trail.shift()
        // speed = how far the average position of the last second moved from that of the first second of the trail:
        // averaging ignores the peak jittering between neighbouring cells
        if (best.trail.length >= TRAIL) {
          const avg = (a: Pt[]) => ({ x: a.reduce((q, r) => q + r.x, 0) / a.length, y: a.reduce((q, r) => q + r.y, 0) / a.length })
          const h = avg(best.trail.slice(0, 10)), t = avg(best.trail.slice(-10))
          best.speed = Math.hypot(t.x - h.x, t.y - h.y) / ((TRAIL - 10) * dt)
        } else best.speed = 0
        best.energy = best.energy * 0.93 + pk.e * 0.07
        best.age += dt; best.hits++; best.missed = 0
      } else {
        const t: Track = { id: this.nextId++, p: pk.p, speed: 0, energy: pk.e, zone: zoneAt(pk.p), activity: 'Working', trail: [pk.p], votes: [], age: 0, hits: 1, missed: 0 }
        this.tracks.push(t); used.add(t)
      }
    }
    for (const t of this.tracks) if (!used.has(t)) t.missed += dt
    this.tracks = this.tracks.filter((t) => t.missed < 2 && (t.hits > 3 || t.missed < 0.5))
    for (const t of this.tracks) {
      t.zone = zoneAt(t.p)
      // the label is the most common reading of the last few seconds, so one jittery step cannot flip it
      t.votes.push(classify(t)); if (t.votes.length > VOTES) t.votes.shift()
      const count = new Map<Activity, number>()
      for (const v of t.votes) count.set(v, (count.get(v) ?? 0) + 1)
      let top = t.activity, n = count.get(t.activity) ?? 0
      for (const [a, c] of count) if (c > n) { top = a; n = c }
      t.activity = top
    }
  }
}

export const PEAK_MIN = 0.07
export const MOVING_SPEED = 0.25 // m/s
const VOTES = 40 // 4 s
const TRAIL = 30 // scan steps (3 s at 10 Hz)

/**
 * Activity from where a blob is and how it moves. Real systems use the room as context too: the same slow movement is
 * sleep in the sleep quarters and a task in the lab. Travel between places is told by speed alone.
 */
export function classify(t: Pick<Track, 'speed' | 'energy' | 'zone'>): Activity {
  if (t.speed > MOVING_SPEED) return 'Moving'
  switch (t.zone.id) {
    case 'sleep': return t.energy < 0.5 ? 'Sleeping' : 'Working'
    case 'gym': return t.energy >= 0.55 ? 'Exercising' : 'Working'
    case 'galley': return t.energy > 1.2 ? 'Exercising' : 'Eating'
    default: return t.energy > 1.2 ? 'Exercising' : 'Working'
  }
}

/** Pairs each true person with the nearest track within `r` metres: how well the scan did. */
export function score(truth: TruePerson[], tracks: Track[], r = 1.5) {
  const free = [...tracks]
  let found = 0, err = 0, right = 0
  for (const p of truth) {
    let bi = -1, bd = r
    free.forEach((t, i) => { const d = Math.hypot(t.p.x - p.p.x, t.p.y - p.p.y); if (d < bd) { bd = d; bi = i } })
    if (bi >= 0) { found++; err += bd; if (free[bi].activity === p.activity) right++; free.splice(bi, 1) }
  }
  return { found, extra: free.length, meanError: found ? err / found : 0, activityRight: right }
}
