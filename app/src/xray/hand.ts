/**
 * Hand bones on tracked hand points. MediaPipe gives 21 points per hand (0 wrist; 1–4 thumb; 5–8 index; 9–12 middle;
 * 13–16 ring; 17–20 little finger). Each baked bone (tools/xray/bake-xray.mjs) sits in its own frame: origin at its base,
 * +y along it to its tip, +z out of the back of the hand. Here every bone gets a matrix that puts its base on one point,
 * stretches it to the next and turns its back to the back of the tracked hand. The model is a right hand: a left hand
 * uses it mirrored.
 */
import * as THREE from 'three'

export interface HandMeta {
  /** Wrist to the third knuckle in the model, metres. */
  handLen: number
  /** Which way cross(index knuckle − wrist, little knuckle − wrist) points on a right hand: +1 out of its back, −1 out of its palm. */
  dorsalSign: number
  /** Each bone's length, and for metacarpals 2–5 how far along wrist→knuckle its base sits. */
  bones: Record<string, { len: number; from?: number }>
}

export interface BoneSpec { name: string; a: number; b: number; base?: boolean }

const KNUCKLES = [5, 9, 13, 17]
/** Every bone and the two hand points it spans. A metacarpal with `base` starts part-way from the wrist to its knuckle. */
export const BONES: readonly BoneSpec[] = [
  { name: 'mc1', a: 1, b: 2 }, { name: 'pp1', a: 2, b: 3 }, { name: 'dp1', a: 3, b: 4 },
  ...KNUCKLES.flatMap((k, i): BoneSpec[] => [
    { name: `mc${i + 2}`, a: 0, b: k, base: true },
    { name: `pp${i + 2}`, a: k, b: k + 1 },
    { name: `mp${i + 2}`, a: k + 1, b: k + 2 },
    { name: `dp${i + 2}`, a: k + 2, b: k + 3 },
  ]),
]

const tmp = { y: new THREE.Vector3(), z: new THREE.Vector3(), x: new THREE.Vector3(), a: new THREE.Vector3() }

/**
 * A matrix per bone (plus "carpals") for one hand. `pts` are the 21 points in the overlay's world space (right-handed, y up).
 * `right` is the subject's own right hand.
 */
export function handPose(pts: readonly THREE.Vector3[], right: boolean, meta: HandMeta): Map<string, THREE.Matrix4> {
  const out = new Map<string, THREE.Matrix4>()
  if (pts.length < 21) return out
  const w = pts[0]
  const dorsal = new THREE.Vector3().subVectors(pts[5], w).cross(new THREE.Vector3().subVectors(pts[17], w))
  if (dorsal.lengthSq() < 1e-12) return out
  dorsal.normalize().multiplyScalar(meta.dorsalSign * (right ? 1 : -1))
  const s = w.distanceTo(pts[9]) / meta.handLen
  const mirror = right ? 1 : -1

  const place = (a: THREE.Vector3, b: THREE.Vector3, stretch: (l: number) => number) => {
    const { x, y, z } = tmp
    y.subVectors(b, a)
    const l = y.length()
    if (l < 1e-9) return null
    y.divideScalar(l)
    z.copy(dorsal).addScaledVector(y, -dorsal.dot(y))
    if (z.lengthSq() < 1e-9) z.set(0, 0, 1).addScaledVector(y, -y.z)
    z.normalize()
    x.crossVectors(y, z)
    return new THREE.Matrix4().makeBasis(x.clone().multiplyScalar(s * mirror), y.clone().multiplyScalar(stretch(l)), z.clone().multiplyScalar(s)).setPosition(a)
  }

  const carpals = place(w, pts[9], () => s)
  if (carpals) out.set('carpals', carpals)
  for (const bone of BONES) {
    const m = meta.bones[bone.name]
    if (!m) continue
    const b = pts[bone.b]
    const a = bone.base ? tmp.a.lerpVectors(w, b, m.from ?? 0.3).clone() : pts[bone.a]
    // follow the points, but never squash or stretch a bone past half or double its true size
    const mat = place(a, b, (l) => Math.min(2 * s, Math.max(0.5 * s, l / m.len)))
    if (mat) out.set(bone.name, mat)
  }
  return out
}
