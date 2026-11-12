import * as THREE from 'three'
import { describe, expect, it, vi } from 'vitest'
import { GuideRun, measureFrame, met, STEPS, yawOf, type Measure } from './guide'
import { BONES, handPose, type HandMeta } from './hand'
import { alignMode, DEFAULT_FIT, DEFAULTS, loadSettings, normalize, PRESETS, saveSettings } from './settings'
import { layoutTags, type TagGroup } from './labels'
import { snapshotName } from './snapshot'
import { coverRect, videoFilter } from './view'

const face = (o: Partial<NonNullable<Measure['face']>> = {}): Measure => ({ face: { cx: 0.5, cy: 0.5, size: 0.12, yaw: 0, jaw: 0, ...o }, hands: 0 })

describe('guided start', () => {
  it('ticks each step off once it is held, in order', () => {
    const g = new GuideRun()
    expect(g.feed({ face: null, hands: 0 }, 0)).toBe(false)
    g.feed(face(), 100)
    expect(g.feed(face(), 400)).toBe(false) // not held long enough yet
    expect(g.feed(face(), 650)).toBe(true)
    expect(STEPS[g.step].id).toBe('turn')
    g.feed(face({ yaw: 0.5 }), 700); g.feed(face({ yaw: 0.5 }), 950)
    g.feed(face({ jaw: 0.7 }), 1000); g.feed(face({ jaw: 0.7 }), 1250)
    g.feed({ face: null, hands: 1 }, 1300); g.feed({ face: null, hands: 1 }, 1750)
    expect(g.done).toBe(true)
  })

  it('restarts the hold when the pose is lost', () => {
    const g = new GuideRun()
    g.feed(face(), 0)
    g.feed(face({ cx: 0.9 }), 300) // moved off centre
    expect(g.feed(face(), 600)).toBe(false)
    expect(g.feed(face(), 1150)).toBe(true)
  })

  it('needs the face near the middle and close enough', () => {
    expect(met('center', face())).toBe(true)
    expect(met('center', face({ cx: 0.8 }))).toBe(false)
    expect(met('center', face({ size: 0.03 }))).toBe(false)
    expect(met('hand', { face: null, hands: 2 })).toBe(true)
  })

  it('skips to the end', () => { const g = new GuideRun(); g.skip(); expect(g.done).toBe(true); expect(g.feed(face(), 0)).toBe(false) })

  it('measures a frame from the eye corners and the face transform', () => {
    const lm = Array.from({ length: 478 }, () => ({ x: 0.5, y: 0.5 }))
    lm[33] = lm[133] = { x: 0.4, y: 0.45 }
    lm[263] = lm[362] = { x: 0.6, y: 0.45 }
    const turn = 0.4, m = new THREE.Matrix4().makeRotationY(turn).toArray()
    const r = measureFrame({ face: { lm, matrix: m, jaw: 0.3 }, hands: [{}] })
    expect(r.face?.cx).toBeCloseTo(0.5); expect(r.face?.cy).toBeCloseTo(0.45); expect(r.face?.size).toBeCloseTo(0.2)
    expect(r.face?.yaw).toBeCloseTo(turn); expect(r.face?.jaw).toBe(0.3); expect(r.hands).toBe(1)
    expect(measureFrame({ face: null, hands: [] })).toEqual({ face: null, hands: 0 })
    expect(yawOf(null)).toBe(0)
  })
})

describe('hand bones', () => {
  const meta: HandMeta = { handLen: 0.1, dorsalSign: 1, bones: Object.fromEntries(BONES.map((b) => [b.name, { len: 0.03, ...(b.base ? { from: 0.3 } : {}) }])) }
  // a flat hand in the picture plane, fingers up, wrist at the origin
  const flat = () => {
    const p = Array.from({ length: 21 }, () => new THREE.Vector3())
    p[1].set(-30, 20, 0); p[2].set(-45, 45, 0); p[3].set(-55, 65, 0); p[4].set(-60, 80, 0)
    ;[5, 9, 13, 17].forEach((k, i) => { const x = -15 + i * 12; for (let j = 0; j < 4; j++) p[k + j].set(x, 100 + j * 30, 0) })
    return p
  }

  it('covers 19 bones and the carpus', () => {
    expect(BONES).toHaveLength(19)
    expect(handPose(flat(), true, meta).size).toBe(20)
  })

  it('puts each bone on its two points', () => {
    const p = flat(), m = handPose(p, true, meta)
    const pp2 = m.get('pp2')!
    const base = new THREE.Vector3().applyMatrix4(pp2)
    expect(base.distanceTo(p[5])).toBeLessThan(1e-6)
    // the bone's tip (y = its length) lands on the next point
    expect(new THREE.Vector3(0, 0.03, 0).applyMatrix4(pp2).distanceTo(p[6])).toBeLessThan(1e-6)
    // a metacarpal starts part-way from the wrist
    expect(new THREE.Vector3().applyMatrix4(m.get('mc3')!).distanceTo(p[9].clone().multiplyScalar(0.3))).toBeLessThan(1e-6)
  })

  it('mirrors the right-hand model for a left hand', () => {
    const p = flat()
    expect(handPose(p, true, meta).get('pp3')!.determinant()).toBeGreaterThan(0)
    expect(handPose(p, false, meta).get('pp3')!.determinant()).toBeLessThan(0)
  })

  it('gives nothing for too few points', () => { expect(handPose([], true, meta).size).toBe(0) })
})

describe('view', () => {
  it('crops the video like object-fit: cover', () => {
    // a 4:3 video on a wide screen: the top and bottom are cut
    const c = coverRect(640, 480, 1920, 1080)
    expect(c.k).toBe(3); expect(c.ox).toBe(0); expect(c.oy).toBe(60)
    // on a tall phone the sides are cut
    const t = coverRect(1280, 720, 390, 844)
    expect(t.oy).toBeCloseTo(0); expect(t.ox).toBeGreaterThan(400)
    expect(coverRect(0, 0, 10, 10)).toEqual({ k: 1, ox: 0, oy: 0 })
  })

  it('darkens more with a stronger X-ray', () => {
    expect(videoFilter(0)).toContain('brightness(1.00)')
    expect(videoFilter(1)).toContain('grayscale(1.00)')
    expect(videoFilter(5)).toBe(videoFilter(1))
  })

  it('names snapshots by the time they were taken', () => {
    expect(snapshotName(new Date(2026, 10, 12, 9, 5, 7))).toBe('astrodocx-xray-20261112-090507.png')
  })
})

describe('settings', () => {
  it('fills missing and clamps bad values', () => {
    expect(normalize(null)).toEqual(DEFAULTS)
    const s = normalize({ look: 'nope', strength: 9, fit: { size: 5, dx: -99, dy: 'x' }, layers: { brain: false }, reveal: 'left' })
    expect(s.look).toBe('xray'); expect(s.strength).toBe(1); expect(s.fit.size).toBe(1.3); expect(s.fit.dx).toBe(-5); expect(s.fit.dy).toBe(0)
    expect(s.layers.brain).toBe(false); expect(s.layers.skull).toBe(true); expect(s.reveal).toBe('left')
  })

  it('round-trips through storage and survives broken storage', () => {
    const store = new Map<string, string>()
    vi.stubGlobal('localStorage', { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) })
    const s = normalize({ ...DEFAULTS, look: 'solid', realThrough: 0.4, fit: { ...DEFAULT_FIT, dz: 1.5 } })
    saveSettings(s)
    expect(loadSettings()).toEqual(s)
    localStorage.setItem('astrodocx.xray.v1', '{broken')
    expect(loadSettings()).toEqual(DEFAULTS)
    vi.stubGlobal('localStorage', { getItem: () => { throw new Error('blocked') }, setItem: () => { throw new Error('blocked') } })
    expect(() => saveSettings(s)).not.toThrow()
    expect(loadSettings()).toEqual(DEFAULTS)
    vi.unstubAllGlobals()
  })

  it('has presets that only change layers, and an align recipe', () => {
    expect(PRESETS.map((p) => p.id)).toContain('skull')
    const a = alignMode(DEFAULTS)
    expect(a.look).toBe('solid'); expect(a.realThrough).toBe(0.5); expect(a.layers.skull).toBe(true)
  })

  it('lets some of the real picture through', () => {
    expect(videoFilter(1, 1)).toBe(videoFilter(0, 0))
    expect(videoFilter(1, 0.5)).not.toBe(videoFilter(1, 0))
  })
})

describe('name tags', () => {
  const g: TagGroup = {
    cx: 500, cy: 300, r: 100,
    tags: [
      { id: 'a', text: 'Parietal bone', x: 440, y: 250 }, { id: 'b', text: 'Temporal bone', x: 430, y: 255 },
      { id: 'c', text: 'Maxilla', x: 560, y: 330 }, { id: 'd', text: 'Nasal bone', x: 500, y: 300 },
    ],
  }
  const placed = layoutTags(g, 1000, 600, 12, (t) => t.length * 7)

  it('sends tags left of the centre left and right of it right', () => {
    expect(placed.find((p) => p.text === 'Parietal bone')?.side).toBe(-1)
    expect(placed.find((p) => p.text === 'Maxilla')?.side).toBe(1)
    expect(placed).toHaveLength(4)
  })

  it('keeps a column of tags a line apart, inside the screen', () => {
    for (const side of [-1, 1]) {
      const ys = placed.filter((p) => p.side === side).map((p) => p.ty).sort((a, b) => a - b)
      for (let i = 1; i < ys.length; i++) expect(ys[i] - ys[i - 1]).toBeGreaterThanOrEqual(12)
      for (const y of ys) { expect(y).toBeGreaterThan(0); expect(y).toBeLessThan(600) }
    }
  })

  it('evens out the columns when every tag is on one side', () => {
    const one: TagGroup = { cx: 500, cy: 300, r: 100, tags: Array.from({ length: 10 }, (_, i) => ({ id: `t${i}`, text: `Part ${i}`, x: 450 - i * 3, y: 200 + i * 20 })) }
    const sides = layoutTags(one, 1000, 600, 12, (t) => t.length * 7).map((p) => p.side)
    expect(Math.abs(sides.filter((x) => x < 0).length - sides.filter((x) => x > 0).length)).toBeLessThanOrEqual(2)
  })

  it('points every leader line at the part it names', () => {
    const a = placed.find((p) => p.text === 'Parietal bone')!
    expect([a.ax, a.ay]).toEqual([440, 250])
  })
})

describe('vital-sign patches', () => {
  const pts = (): { x: number; y: number }[] => {
    const lm = Array.from({ length: 478 }, () => ({ x: 0, y: 0 }))
    lm[151] = { x: 0.5, y: 0.3 }; lm[10] = { x: 0.5, y: 0.22 }; lm[152] = { x: 0.5, y: 0.8 }
    lm[205] = { x: 0.42, y: 0.55 }; lm[425] = { x: 0.58, y: 0.55 }; lm[234] = { x: 0.36, y: 0.5 }; lm[454] = { x: 0.64, y: 0.5 }
    return lm
  }
  it('places forehead and cheek patches on the face, inside the frame', async () => {
    const { faceRegions } = await import('./vitals')
    const r = faceRegions(pts())
    expect(r?.rois).toHaveLength(3)
    for (const q of r?.rois ?? []) { expect(q.x1).toBeGreaterThan(q.x0); expect(q.y1).toBeGreaterThan(q.y0); expect(q.x0).toBeGreaterThanOrEqual(0); expect(q.x1).toBeLessThanOrEqual(1) }
    expect(r?.rois[1].x1).toBeLessThan(0.5) // the first cheek is left of centre
    expect(r?.area.y0).toBeLessThan(0.22)
  })
  it('gives up on a missing or degenerate face', async () => {
    const { faceRegions } = await import('./vitals')
    expect(faceRegions([])).toBeNull()
    const lm = pts(); lm[454] = lm[234]
    expect(faceRegions(lm)).toBeNull()
  })
})
