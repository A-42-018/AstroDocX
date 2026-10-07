import { rng } from '../data/synthetic'

/**
 * Stylised anatomy for the Health Twin, in the body outline's 300 × 660 coordinate space (centre line x = 150).
 * Illustrative, not to medical scale. Paired parts are generated for both sides from one description.
 */
const X = 150
type Side = 1 | -1
const SIDES: Side[] = [-1, 1]
const x = (s: Side, dx: number) => (X + s * dx).toFixed(1)
const both = (f: (s: Side) => string) => SIDES.map(f).join(' ')

/* ---- Skeleton ---- */
export const SKULL = `M${X - 22} 58 C${X - 25} 14 ${X + 25} 14 ${X + 22} 58 C${X + 21} 70 ${X + 15} 76 ${X + 12} 84 L${X - 12} 84 C${X - 15} 76 ${X - 21} 70 ${X - 22} 58 Z`
export const JAW = `M${X - 13} 80 Q${X} 96 ${X + 13} 80 M${X - 8} 83 H${X + 8}`
export const EYES = SIDES.map((s) => ({ cx: X + s * 9, cy: 54 }))
export const NOSE = `M${X} 60 L${X - 3.5} 70 L${X + 3.5} 70 Z`

/** Vertebrae from the neck to the sacrum: narrower in the neck, wider in the lower back. */
export const VERTEBRAE = Array.from({ length: 26 }, (_, i) => {
  const y = 94 + i * 8.6
  const w = i < 6 ? 5 : i < 18 ? 6.5 : 8
  return { x: X - w / 2, y, w, h: 5 }
})

export const CLAVICLES = both((s) => `M${x(s, 6)} 122 Q${x(s, 34)} 114 ${x(s, 62)} 128`)
export const STERNUM = { x: X - 4, y: 126, w: 8, h: 72 }
/** Ten ribs per side: out from the spine, round, and back toward the sternum. The last two float. */
export const RIBS = both((s) =>
  [30, 38, 44, 48, 51, 52, 51, 48, 43, 36]
    .map((w, i) => {
      const y = 128 + i * 11.5
      const drop = 14 + i * 1.6
      const end = i >= 8 ? w * 0.75 : w * 0.32
      return `M${x(s, 5)} ${y} C${x(s, w * 0.7)} ${y - 9} ${x(s, w + 5)} ${y + drop * 0.35} ${x(s, end)} ${y + drop}`
    })
    .join(' '),
)
export const PELVIS = both((s) => `M${x(s, 7)} 300 C${x(s, 30)} 282 ${x(s, 52)} 290 ${x(s, 47)} 312 C${x(s, 43)} 326 ${x(s, 31)} 334 ${x(s, 22)} 346 C${x(s, 16)} 352 ${x(s, 8)} 348 ${x(s, 6)} 340`)
export const SACRUM = `M${X - 9} 300 L${X + 9} 300 L${X + 4} 332 L${X - 4} 332 Z`

/** Arm bones and joints; hands as a fan of fingers. */
export const ARM_BONES = both((s) =>
  [
    `M${x(s, 62)} 136 L${x(s, 76)} 246`, // humerus
    `M${x(s, 79)} 252 L${x(s, 94)} 350`, // radius
    `M${x(s, 73)} 253 L${x(s, 87)} 352`, // ulna
    ...[0, 1, 2, 3].map((k) => `M${x(s, 88 + k * 3)} 362 L${x(s, 87 + k * 4.2)} 384`),
    `M${x(s, 86)} 358 L${x(s, 82)} 372`, // thumb
  ].join(' '),
)
export const ARM_JOINTS = SIDES.flatMap((s) => [
  { cx: X + s * 62, cy: 134, r: 7 },
  { cx: X + s * 77, cy: 249, r: 4.5 },
  { cx: X + s * 90, cy: 356, r: 4 },
])

/** Leg bones (tinted by the Gravity status: bone and muscle loss). */
export const LEG_BONES = both((s) =>
  [
    `M${x(s, 30)} 338 L${x(s, 31)} 460`, // femur
    `M${x(s, 30)} 476 L${x(s, 28)} 594`, // tibia
    `M${x(s, 38)} 478 L${x(s, 35)} 590`, // fibula
    `M${x(s, 29)} 600 L${x(s, 24)} 612 L${x(s, 22)} 628 M${x(s, 29)} 600 L${x(s, 36)} 614 L${x(s, 42)} 628 M${x(s, 29)} 600 L${x(s, 30)} 628`, // foot
  ].join(' '),
)
export const LEG_JOINTS = SIDES.flatMap((s) => [
  { cx: X + s * 30, cy: 335, r: 6.5 },
  { cx: X + s * 32, cy: 468, r: 6 },
  { cx: X + s * 29, cy: 598, r: 4 },
])

/* ---- Organs ---- */
export const BRAIN = `M${X - 19} 46 C${X - 20} 26 ${X + 20} 26 ${X + 19} 46 C${X + 18} 56 ${X - 18} 56 ${X - 19} 46 Z`
export const BRAIN_FOLDS = [
  `M${X - 15} 40 q4 -6 8 -1 t8 0 t8 -1 t6 2`,
  `M${X - 16} 47 q5 -5 9 0 t9 0 t9 0`,
  `M${X} 30 L${X} 54`,
].join(' ')
/** Lungs: the left lung (viewer's right) has the cardiac notch. */
export const LUNGS = both((s) =>
  s === -1
    ? `M${x(s, 10)} 138 C${x(s, 30)} 124 ${x(s, 47)} 148 ${x(s, 47)} 190 C${x(s, 47)} 214 ${x(s, 30)} 222 ${x(s, 12)} 212 C${x(s, 8)} 190 ${x(s, 8)} 162 ${x(s, 10)} 138 Z`
    : `M${x(s, 10)} 138 C${x(s, 30)} 124 ${x(s, 47)} 148 ${x(s, 47)} 190 C${x(s, 47)} 214 ${x(s, 32)} 222 ${x(s, 20)} 214 C${x(s, 26)} 198 ${x(s, 22)} 178 ${x(s, 12)} 172 C${x(s, 9)} 160 ${x(s, 9)} 148 ${x(s, 10)} 138 Z`,
)
export const BRONCHI = `M${X} 112 L${X} 140 M${X} 140 Q${X - 8} 146 ${X - 18} 156 M${X} 140 Q${X + 8} 146 ${X + 18} 156`
/** Heart, drawn around (0, 0) and placed slightly to the body's left. */
export const HEART_AT = { x: X + 8, y: 182 }
/** Anatomical-ish heart: right atrium top left, apex down and to the body's left. */
export const HEART = 'M-9 -11 C-15 -11 -18 -4 -16 4 C-14 11 -6 17 7 20 C13 15 17 7 16 -2 C15 -10 9 -14 3 -13 C0 -15 -5 -14 -9 -11 Z'
export const HEART_VESSELS = 'M-1 -12 C-1 -25 -12 -27 -15 -19 M4 -12 C5 -21 11 -23 14 -20 M-8 -10 L-9 -20'
/** Septum and coronary lines on the heart's surface. */
export const HEART_LINES = 'M-3 -10 C-1 0 2 8 7 19 M-12 2 C-6 4 0 3 5 -2'
export const LIVER = `M${X - 44} 214 C${X - 32} 202 ${X + 2} 205 ${X + 8} 216 C${X - 6} 232 ${X - 30} 240 ${X - 44} 232 Z`
export const STOMACH = `M${X + 14} 218 C${X + 38} 212 ${X + 42} 236 ${X + 27} 246 C${X + 16} 251 ${X + 11} 238 ${X + 14} 218 Z`
export const KIDNEYS = SIDES.map((s) => ({ cx: X + s * 27, cy: 254 }))
export const INTESTINE = `M${X - 26} 262 C${X - 10} 256 ${X + 10} 256 ${X + 26} 262 C${X + 30} 272 ${X + 8} 270 ${X - 6} 272 C${X - 30} 276 ${X - 26} 290 ${X - 8} 288 C${X + 12} 286 ${X + 28} 292 ${X + 18} 302 C${X + 6} 308 ${X - 14} 306 ${X - 20} 300`

/* ---- Vessels: every artery path starts at the heart, so a pulse can travel outward along it ---- */
const H0 = `M${HEART_AT.x - 2} ${HEART_AT.y - 12} C${HEART_AT.x - 2} 150 ${X - 8} 146 ${X - 6} 166`
export const ARTERIES = [
  ...SIDES.map((s) => `${H0} L${X - 5} 298 C${X - 5} 310 ${x(s, 14)} 318 ${x(s, 21)} 344 L${x(s, 23)} 464 L${x(s, 24)} 596 L${x(s, 30)} 618`), // aorta to each leg
  ...SIDES.map((s) => `M${HEART_AT.x - 2} ${HEART_AT.y - 12} C${HEART_AT.x - 2} 152 ${x(s, 8)} 142 ${x(s, 9)} 116 L${x(s, 11)} 92 C${x(s, 13)} 80 ${x(s, 12)} 66 ${x(s, 9)} 52`), // carotids
  ...SIDES.map((s) => `M${HEART_AT.x - 2} ${HEART_AT.y - 12} C${HEART_AT.x - 2} 148 ${x(s, 22)} 138 ${x(s, 42)} 134 L${x(s, 64)} 140 L${x(s, 77)} 250 L${x(s, 90)} 352 L${x(s, 92)} 372`), // arms
]
/** Veins run beside the arteries and flow back toward the heart. */
export const VEINS = [
  ...SIDES.map((s) => `M${x(s, 27)} 616 L${x(s, 19)} 596 L${x(s, 18)} 464 L${x(s, 16)} 346 C${x(s, 10)} 318 ${X + 4} 310 ${X + 4} 298 L${X + 4} 200 L${HEART_AT.x - 6} ${HEART_AT.y - 4}`),
  ...SIDES.map((s) => `M${x(s, 96)} 370 L${x(s, 95)} 350 L${x(s, 82)} 250 L${x(s, 68)} 146 L${x(s, 40)} 140 C${x(s, 20)} 146 ${X} 156 ${HEART_AT.x - 6} ${HEART_AT.y - 6}`),
  ...SIDES.map((s) => `M${x(s, 14)} 54 C${x(s, 17)} 70 ${x(s, 16)} 84 ${x(s, 14)} 96 L${x(s, 12)} 120 C${x(s, 10)} 150 ${X} 160 ${HEART_AT.x - 6} ${HEART_AT.y - 8}`),
]

/* ---- Holographic sparkle: seeded points along the body's centre lines ---- */
const LIMBS: [number, number, number, number, number][] = [
  [X, 30, X, 84, 14], [X, 120, X, 330, 34],
  [X - 66, 150, X - 90, 360, 6], [X + 66, 150, X + 90, 360, 6],
  [X - 31, 350, X - 29, 600, 9], [X + 31, 350, X + 29, 600, 9],
]
export const SPARKS = (() => {
  const r = rng(7)
  return Array.from({ length: 56 }, (_, i) => {
    const [x1, y1, x2, y2, w] = LIMBS[i % LIMBS.length]
    const t = r.next()
    return { cx: x1 + (x2 - x1) * t + (r.next() - 0.5) * 2 * w, cy: y1 + (y2 - y1) * t, r: 0.7 + r.next() * 1.1, delay: r.next() * 4 }
  })
})()
