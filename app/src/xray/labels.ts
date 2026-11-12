/**
 * Anatomy name tags in the style of a textbook plate: a thin ring around the head, and each name set in a column down
 * the left or right with a leader line to the part it names. Pure layout + one 2D drawing routine, used by the live
 * overlay and by the snapshot, so both show the same plate.
 */
import type { Layer } from './settings'

/** One name tag: where it points, in the screen's own pixels (already mirrored). */
export interface Tag { id: string; text: string; x: number; y: number }

/** A set of tags around one centre: the head, or one hand. */
export interface TagGroup { cx: number; cy: number; r: number; tags: Tag[] }

/** A tag placed in its column. `side` is the column it sits in; (tx, ty) is where its text meets the leader line. */
export interface Placed { text: string; ax: number; ay: number; tx: number; ty: number; side: -1 | 1 }

export interface HeadTag { id: string; text: string; layer: Layer; p: [number, number, number] }

/**
 * Where each head tag points, in the head's own frame (metres from between the eyes; x to the body's left, y up,
 * z forward). A sharper model carries its own, measured from the parts; these are for a model that does not.
 */
export const HEAD_TAGS: readonly HeadTag[] = [
  { id: 'frontal-bone', text: 'Frontal bone', layer: 'skull', p: [0.01, 0.065, -0.012] },
  { id: 'parietal-bone', text: 'Parietal bone', layer: 'skull', p: [0.045, 0.075, -0.07] },
  { id: 'temporal-bone', text: 'Temporal bone', layer: 'skull', p: [0.07, 0.005, -0.06] },
  { id: 'occipital-bone', text: 'Occipital bone', layer: 'skull', p: [-0.02, 0.03, -0.13] },
  { id: 'nasal-bone', text: 'Nasal bone', layer: 'skull', p: [0, -0.005, 0.012] },
  { id: 'zygomatic-bone', text: 'Zygomatic bone (cheekbone)', layer: 'skull', p: [0.055, -0.02, -0.012] },
  { id: 'maxilla', text: 'Maxilla (upper jaw)', layer: 'skull', p: [-0.022, -0.045, 0.0] },
  { id: 'teeth', text: 'Teeth', layer: 'skull', p: [0.012, -0.063, 0.008] },
  { id: 'mandible', text: 'Mandible (lower jaw)', layer: 'skull', p: [-0.04, -0.09, -0.03] },
  { id: 'frontal-lobe', text: 'Frontal lobe', layer: 'brain', p: [-0.015, 0.05, -0.03] },
  { id: 'parietal-lobe', text: 'Parietal lobe', layer: 'brain', p: [0.03, 0.06, -0.085] },
  { id: 'temporal-lobe', text: 'Temporal lobe', layer: 'brain', p: [0.055, 0.0, -0.06] },
  { id: 'cerebellum', text: 'Cerebellum', layer: 'brain', p: [-0.01, -0.012, -0.11] },
  { id: 'eyeball', text: 'Eyeball', layer: 'eyes', p: [-0.032, 0, -0.01] },
  { id: 'orbicularis', text: 'Orbicularis oculi', layer: 'muscles', p: [0.045, 0.012, 0.0] },
  { id: 'zygomaticus', text: 'Zygomaticus major', layer: 'muscles', p: [-0.035, -0.05, 0.0] },
  { id: 'masseter', text: 'Masseter', layer: 'muscles', p: [0.06, -0.06, -0.05] },
  { id: 'temporalis', text: 'Temporalis', layer: 'muscles', p: [0.065, 0.03, -0.05] },
  { id: 'sternocleidomastoid', text: 'Sternocleidomastoid', layer: 'muscles', p: [-0.05, -0.12, -0.08] },
]

/** Hand tags: each is a point between two of MediaPipe's 21 hand points. */
export const HAND_TAGS: readonly { id: string; text: string; a: number; b: number; t: number }[] = [
  { id: 'carpals', text: 'Carpal bones', a: 0, b: 9, t: 0.12 },
  { id: 'metacarpal', text: 'Metacarpal', a: 0, b: 13, t: 0.6 },
  { id: 'proximal', text: 'Proximal phalanx', a: 9, b: 10, t: 0.5 },
  { id: 'middle', text: 'Middle phalanx', a: 10, b: 11, t: 0.5 },
  { id: 'distal', text: 'Distal phalanx', a: 11, b: 12, t: 0.5 },
  { id: 'thumb', text: 'Thumb metacarpal', a: 1, b: 2, t: 0.5 },
]

const GAP = 1.55
const MARGIN = 14

/**
 * Puts a group's tags in two columns, one each side of the ring, in the order of the points they name, with at least a
 * line of space between neighbours. `width` measures a tag's text; (cw, ch) is the screen.
 */
export function layoutTags(g: TagGroup, cw: number, ch: number, font: number, width: (text: string) => number): Placed[] {
  const wide = g.tags.reduce((m, t) => Math.max(m, width(t.text)), 0)
  const sorted = [...g.tags].sort((a, b) => a.y - b.y)
  // a tag left of the centre goes in the left column; ones near the middle share out alternately
  let flip: -1 | 1 = 1
  const side = (t: Tag): -1 | 1 => {
    if (Math.abs(t.x - g.cx) > g.r * 0.18) return t.x < g.cx ? -1 : 1
    flip = flip === 1 ? -1 : 1
    return flip
  }
  const sides = new Map(sorted.map((t) => [t, side(t)] as const))
  // a model's tags all sit on one side of the head: move the ones nearest the middle across until the columns are about even
  for (;;) {
    const left = sorted.filter((t) => sides.get(t) === -1), right = sorted.filter((t) => sides.get(t) === 1)
    if (Math.abs(left.length - right.length) <= 2) break
    const from = left.length > right.length ? left : right
    const t = from.reduce((best, x) => (Math.abs(x.x - g.cx) < Math.abs(best.x - g.cx) ? x : best))
    sides.set(t, left.length > right.length ? 1 : -1)
  }
  const out: Placed[] = []
  for (const s of [-1, 1] as const) {
    const col = sorted.filter((t) => sides.get(t) === s)
    const x = Math.min(cw - MARGIN - wide, Math.max(MARGIN + wide, g.cx + s * g.r * 1.55))
    const ys = col.map((t) => Math.min(ch - MARGIN, Math.max(MARGIN + font, t.y)))
    const gap = font * GAP
    for (let i = 1; i < ys.length; i++) if (ys[i] < ys[i - 1] + gap) ys[i] = ys[i - 1] + gap
    // pushed past the bottom: shift the pile back up
    for (let i = ys.length - 1; i >= 0; i--) {
      const cap = i === ys.length - 1 ? ch - MARGIN : ys[i + 1] - gap
      if (ys[i] > cap) ys[i] = cap
    }
    col.forEach((t, i) => out.push({ text: t.text, ax: t.x, ay: t.y, tx: x, ty: ys[i], side: s }))
  }
  return out
}

/** Draws the ring and tags of every group onto a 2D canvas whose units are the screen's own pixels. */
export function drawTags(ctx: CanvasRenderingContext2D, groups: readonly TagGroup[], cw: number, ch: number, font = 12) {
  ctx.save()
  ctx.font = `500 ${font}px ui-monospace, "JetBrains Mono", monospace`
  ctx.textBaseline = 'middle'
  const width = (t: string) => ctx.measureText(t).width + 8
  for (const g of groups) {
    if (!g.tags.length) continue
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.28)'; ctx.lineWidth = 1
    ctx.beginPath(); ctx.arc(g.cx, g.cy, g.r * 1.35, 0, Math.PI * 2); ctx.stroke()
    for (const p of layoutTags(g, cw, ch, font, width)) {
      const stub = p.tx + p.side * -6 // the line leaves the text on the side facing the head
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.75)'; ctx.lineWidth = 1
      ctx.beginPath(); ctx.moveTo(stub, p.ty); ctx.lineTo(stub + p.side * -14, p.ty); ctx.lineTo(p.ax, p.ay); ctx.stroke()
      ctx.fillStyle = '#fff'
      ctx.beginPath(); ctx.arc(p.ax, p.ay, 2.2, 0, Math.PI * 2); ctx.fill()
      // text sits outside the line: right-aligned in the left column, left-aligned in the right one
      ctx.textAlign = p.side < 0 ? 'right' : 'left'
      ctx.shadowColor = 'rgba(0, 0, 0, 0.9)'; ctx.shadowBlur = 3
      ctx.fillText(p.text, p.tx, p.ty)
      ctx.shadowBlur = 0
    }
  }
  ctx.restore()
}
