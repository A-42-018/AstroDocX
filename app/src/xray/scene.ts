/**
 * The X-ray overlay: a transparent three.js canvas over the camera picture. It is laid out in the video's own pixels
 * (x right, y up, z towards the viewer), so tracked points land on it directly; an orthographic camera shows the part
 * of the video that covers the screen. Both the video and this canvas are flipped by CSS to make the mirror.
 *
 * - Head (head.glb): skull, teeth, eyes and brain follow the face's pose (MediaPipe's face transform) and sit on the eye
 *   centres; the jaw swings on its hinge with the "jawOpen" face shape; the neck muscles follow the head part of the way.
 *   A "fit" group between the pose and the anatomy lets the person nudge size, shape and position to their own head.
 * - Face muscles: the face's own tracked mesh (478 points), in red, so every expression shows.
 * - Hands (hand.glb): each bone is laid between two tracked hand points (hand.ts).
 * Two looks: "xray" glows at the edges (a rim shader, added light, no depth) so the far side shows through; "solid" is
 * lit, depth-sorted bone. A mask in the shader can show only a half, the top, the lower face, or a circle at a fingertip.
 */
import * as THREE from 'three'
import { startTier } from '../shell/perf'
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import type { NormalizedLandmark } from '@mediapipe/tasks-vision'
import { BONES, handPose, type HandMeta } from './hand'
import { HAND_TAGS, HEAD_TAGS, type HeadTag, type TagGroup } from './labels'
import type { Layers, Reveal, XraySettings } from './settings'
import type { TrackFrame } from './useTracker'
import { coverRect } from './view'

export type { Layer, Layers } from './settings'

export interface XrayScene {
  resize(cw: number, ch: number): void
  /** Draws the frame and returns the name tags (empty unless labels are on), in screen pixels. */
  update(f: TrackFrame): TagGroup[]
  apply(s: XraySettings): void
  /** Draws now and returns the canvas, still holding the frame (for a snapshot taken in the same task). */
  draw(): HTMLCanvasElement
  dispose(): void
}

const MODELS = `${import.meta.env.BASE_URL}xray/models`
/** How far (radians) the jaw opens at a full "jawOpen". */
const JAW_MAX = 0.42
/** How much of the head's turn the neck muscles follow. */
const NECK_FOLLOW = 0.35
/** Fits the skull snugly inside the real head (the model ran a little large). */
const HEAD_FIT = 0.9
/** Smoothing per frame (1 = none): a little, so the bones do not shiver, not so much that they lag. */
const EASE = { pos: 0.55, rot: 0.5, jaw: 0.5, hand: 0.6 }
const REVEAL_CODE: Record<Reveal, number> = { whole: 0, left: 1, right: 2, top: 3, lower: 4, lens: 5 }
/** Shared by every tissue's material, so one write changes them all. */
function sharedUniforms() {
  return {
    strength: { value: 0.7 }, brightness: { value: 1 }, mode: { value: 0 }, opacity: { value: 1 },
    reveal: { value: 0 }, feather: { value: 0.2 }, lens: { value: new THREE.Vector3() }, toHead: { value: new THREE.Matrix4() },
  }
}
type Shared = ReturnType<typeof sharedUniforms>

/**
 * One tissue's look. "xray": bright where a surface turns away (its outline), faint where it faces you. "solid": a simple
 * lit surface. `useMask` is 0 for things that are not part of the head (hand bones), so a head reveal does not touch them.
 */
function tissueMaterial(shared: Shared, color: string, power: number, base: number, useMask = 1) {
  return new THREE.ShaderMaterial({
    uniforms: { color: { value: new THREE.Color(color) }, power: { value: power }, base: { value: base }, useMask: { value: useMask }, ...shared },
    vertexShader: /* glsl */`
      uniform mat4 toHead;
      varying vec3 vN; varying vec3 vH;
      void main() {
        vN = normalize(normalMatrix * normal);
        vec4 w = modelMatrix * vec4(position, 1.0);
        vH = (toHead * w).xyz;
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: /* glsl */`
      uniform vec3 color; uniform float power; uniform float base; uniform float useMask;
      uniform float strength; uniform float brightness; uniform float mode; uniform float opacity;
      uniform float reveal; uniform float feather; uniform vec3 lens;
      varying vec3 vN; varying vec3 vH;
      // 1 where this bit of the anatomy is shown, 0 where it is hidden; soft over the feather width
      float shown() {
        if (useMask < 0.5 || reveal < 0.5) return 1.0;
        if (reveal > 4.5) {
          if (lens.z <= 0.0) return 0.0;
          return 1.0 - smoothstep(lens.z * (1.0 - max(feather, 0.02)), lens.z, distance(gl_FragCoord.xy, lens.xy));
        }
        float d = reveal < 1.5 ? vH.x : reveal < 2.5 ? -vH.x : reveal < 3.5 ? vH.y - 0.015 : -0.02 - vH.y;
        float f = max(feather * 0.03, 0.0005);
        return smoothstep(-f, f, d);
      }
      void main() {
        float m = shown();
        if (m <= 0.002) discard;
        vec3 n = normalize(vN);
        if (mode > 0.5) {
          float lit = 0.35 + 0.65 * max(dot(n, normalize(vec3(0.3, 0.5, 0.8))), 0.0);
          float rim = pow(1.0 - abs(n.z), power) * 0.25;
          float a = opacity * m;
          gl_FragColor = vec4(color * (lit + rim) * brightness * a, a);
        } else {
          float f = 1.0 - abs(n.z);
          float rim = pow(f, power);
          // soft, film-like falloff: crisp bright outline, a faint translucent body, no blown-out white
          float a = (base * (0.4 + 0.6 * f) + rim * 0.75) * strength * brightness * m;
          a = 1.0 - exp(-a * 1.6);
          gl_FragColor = vec4(color * a, a * 0.85);
        }
      }`,
    transparent: true, depthWrite: false, depthTest: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
  })
}

const world = (l: NormalizedLandmark, vw: number, vh: number, out = new THREE.Vector3()) => out.set(l.x * vw, (1 - l.y) * vh, -l.z * vw)
const mid = (a: THREE.Vector3, b: THREE.Vector3) => new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5)

/** Wraps a loaded node so we can move it without losing its own (quantisation) transform. */
function holder(node: THREE.Object3D, material: THREE.Material) {
  const h = new THREE.Group()
  node.traverse((o) => { if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).material = material })
  node.removeFromParent()
  h.add(node)
  return h
}

export async function createXray(canvas: HTMLCanvasElement): Promise<XrayScene> {
  const low = startTier() === 'low'
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: !low, premultipliedAlpha: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, low ? 1 : 2))
  renderer.setClearColor(0x000000, 0)
  const scene = new THREE.Scene()
  const camera = new THREE.OrthographicCamera(0, 1, 1, 0, 1, 40000)
  camera.position.z = 20000
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder)
  const [head, hand] = await Promise.all([loader.loadAsync(`${MODELS}/head.glb`), loader.loadAsync(`${MODELS}/hand.glb`)])
  const shared = sharedUniforms()
  const mats = {
    bone: tissueMaterial(shared, '#cfeaf5', 3.0, 0.05), eye: tissueMaterial(shared, '#8fe8f5', 3.0, 0.04),
    brain: tissueMaterial(shared, '#e88fc0', 2.6, 0.04), muscle: tissueMaterial(shared, '#ff5a74', 2.4, 0.03),
    outline: tissueMaterial(shared, '#7fe3ff', 3.2, 0.025), handBone: tissueMaterial(shared, '#cfeaf5', 3.0, 0.05, 0),
  }

  /* ---- head ---- */
  const hx = head.scene.userData as { eyeDist: number; hinge: [number, number, number]; tags?: HeadTag[] }
  // tags measured from the model's own parts replace the stock ones of the same name (the muscles of expression keep theirs)
  const headTags: readonly HeadTag[] = [...new Map([...HEAD_TAGS, ...(hx.tags ?? [])].map((t) => [t.id, t])).values()]
  const get = (root: THREE.Object3D, name: string) => {
    const n = root.getObjectByName(name)
    if (!n) throw new Error(`x-ray model is missing "${name}"`)
    return n
  }
  /** A node a sharper model has and an older one does not. */
  const maybe = (name: string, material: THREE.Material) => { const n = head.scene.getObjectByName(name); return n ? holder(n, material) : null }

  const headRoot = new THREE.Group()
  const fitRoot = new THREE.Group()
  const skull = holder(get(head.scene, 'skull'), mats.bone)
  const eyes = holder(get(head.scene, 'eyes'), mats.eye)
  const brain = holder(get(head.scene, 'brain'), mats.brain)
  const teeth = maybe('teeth', mats.bone)
  const skin = maybe('skin', mats.outline)
  const headMuscles = ['eyeMuscles'].map((n) => maybe(n, mats.muscle)).filter((x): x is THREE.Group => !!x)
  const jaw = new THREE.Group()
  jaw.position.fromArray(hx.hinge)
  const mandible = holder(get(head.scene, 'mandible'), mats.bone)
  mandible.position.fromArray(hx.hinge).negate()
  const teethLower = maybe('teethLower', mats.bone)
  teethLower?.position.fromArray(hx.hinge).negate()
  jaw.add(mandible)
  if (teethLower) jaw.add(teethLower)
  fitRoot.add(skull, eyes, brain, jaw)
  for (const x of [teeth, skin, ...headMuscles]) if (x) fitRoot.add(x)
  headRoot.add(fitRoot)
  const neckRoot = new THREE.Group()
  const neckFit = new THREE.Group()
  neckFit.add(holder(get(head.scene, 'neck'), mats.muscle))
  neckRoot.add(neckFit)
  scene.add(headRoot, neckRoot)

  /* ---- face: the tracked mesh as muscles, and (without a baked skin) as the head's outline ---- */
  const { FaceLandmarker } = await import('@mediapipe/tasks-vision')
  const conn = FaceLandmarker.FACE_LANDMARKS_TESSELATION
  const tri: number[] = []
  // the tessellation lists each triangle's three edges in turn
  for (let i = 0; i + 2 < conn.length; i += 3) {
    const [p, q, r] = [conn[i], conn[i + 1], conn[i + 2]]
    if (p.end === q.start && q.end === r.start && r.end === p.start) tri.push(p.start, q.start, r.start)
  }
  const facePos = new THREE.BufferAttribute(new Float32Array(478 * 3), 3)
  facePos.setUsage(THREE.DynamicDrawUsage)
  const faceGeo = new THREE.BufferGeometry()
  faceGeo.setAttribute('position', facePos)
  faceGeo.setIndex(tri)
  const lineGeo = new THREE.BufferGeometry()
  lineGeo.setAttribute('position', facePos)
  lineGeo.setIndex(conn.flatMap((c) => [c.start, c.end]))
  const fibres = new THREE.LineBasicMaterial({ color: '#ff4d6a', transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false })
  const faceMesh = new THREE.Group()
  faceMesh.add(new THREE.Mesh(faceGeo, mats.muscle), new THREE.LineSegments(lineGeo, fibres))
  const faceOutline = new THREE.Mesh(faceGeo, mats.outline)
  const dotMat = new THREE.PointsMaterial({ color: '#9ff4ff', size: 3, sizeAttenuation: false, depthTest: false, transparent: true, opacity: 0.9 })
  const faceDots = new THREE.Points(faceGeo, dotMat)
  for (const g of [faceMesh, faceOutline, faceDots]) { g.frustumCulled = false; g.traverse((o) => { o.frustumCulled = false }); scene.add(g) }

  /* ---- hands ---- */
  const hxm = hand.scene.userData as { handLen: number; dorsalSign: number }
  const meta: HandMeta = { handLen: hxm.handLen, dorsalSign: hxm.dorsalSign, bones: {} }
  for (const b of BONES) { const n = hand.scene.getObjectByName(b.name); if (n) meta.bones[b.name] = n.userData as { len: number; from?: number } }
  const makeHand = () => {
    const root = new THREE.Group()
    const parts = new Map<string, THREE.Group>()
    const copy = hand.scene.clone(true)
    for (const name of ['carpals', ...BONES.map((b) => b.name)]) {
      const n = copy.getObjectByName(name)
      if (!n) continue
      const h = holder(n, mats.handBone)
      h.matrixAutoUpdate = false
      parts.set(name, h)
      root.add(h)
    }
    const dotPos = new THREE.BufferAttribute(new Float32Array(21 * 3), 3)
    dotPos.setUsage(THREE.DynamicDrawUsage)
    const dotGeo = new THREE.BufferGeometry()
    dotGeo.setAttribute('position', dotPos)
    const dots = new THREE.Points(dotGeo, new THREE.PointsMaterial({ color: '#9ff4ff', size: 4, sizeAttenuation: false, depthTest: false, transparent: true }))
    dots.frustumCulled = false
    root.add(dots)
    root.visible = false
    scene.add(root)
    return { root, parts, dots, dotPos, pts: Array.from({ length: 21 }, () => new THREE.Vector3()), fresh: true }
  }
  const hands = [makeHand(), makeHand()]

  /* ---- state ---- */
  let vw = 640, vh = 480, cw = 1, ch = 1
  let cfg: XraySettings | null = null
  let seen = false
  const pose = { pos: new THREE.Vector3(), q: new THREE.Quaternion(), s: 1, jaw: 0 }
  const tq = new THREE.Quaternion(), tm = new THREE.Matrix4(), tv = new THREE.Vector3(), id = new THREE.Quaternion()
  const pts = Array.from({ length: 478 }, () => new THREE.Vector3())
  const lensPt = new THREE.Vector3()
  const buf = new THREE.Vector2()
  const layersNow = (): Layers => cfg?.layers ?? { skull: true, brain: true, muscles: true, hands: true, eyes: true, outline: false }

  const layout = () => {
    renderer.setSize(cw, ch, false)
    const { ox, oy } = coverRect(vw, vh, cw, ch)
    camera.left = ox; camera.right = vw - ox; camera.bottom = oy; camera.top = vh - oy
    camera.updateProjectionMatrix()
    camera.updateMatrixWorld()
  }

  /** Puts the fit (size, shape, shift) on the head and the neck. Shifts are in the head's own axes; + is towards your right. */
  const applyFit = () => {
    const f = cfg?.fit
    const k = HEAD_FIT * (f?.size ?? 1)
    fitRoot.scale.set(k * (f?.width ?? 1), k * (f?.height ?? 1), k * (f?.depth ?? 1))
    fitRoot.position.set(-(f?.dx ?? 0) / 100, (f?.dy ?? 0) / 100, (f?.dz ?? 0) / 100)
    neckFit.scale.copy(fitRoot.scale)
    neckFit.position.copy(fitRoot.position)
  }

  const applyLook = () => {
    const solid = cfg?.look === 'solid'
    shared.mode.value = solid ? 1 : 0
    shared.opacity.value = solid ? 1 - (cfg?.realThrough ?? 0) * 0.8 : 1
    for (const m of Object.values(mats)) {
      m.blending = solid ? THREE.NormalBlending : THREE.AdditiveBlending
      m.depthTest = solid; m.depthWrite = solid
      m.premultipliedAlpha = solid
      m.needsUpdate = true
    }
    fibres.opacity = (solid ? 0.05 : 0.12) * (cfg?.strength ?? 1)
  }

  const applyLayers = () => {
    const L = layersNow()
    skull.visible = L.skull; jaw.visible = L.skull
    if (teeth) teeth.visible = L.skull
    eyes.visible = L.eyes
    brain.visible = L.brain
    for (const m of headMuscles) m.visible = L.muscles
    if (skin) skin.visible = L.outline
    neckRoot.visible = L.muscles && seen; faceMesh.visible = L.muscles && seen
    faceOutline.visible = L.outline && !skin && seen
    faceDots.visible = !!cfg?.dots && seen
    headRoot.visible = seen
    for (const h of hands) h.dots.visible = !!cfg?.dots
  }

  /** The reveal planes live in the anatomy's own frame, so they follow the head and the fit. */
  const syncToHead = () => { headRoot.updateMatrixWorld(true); shared.toHead.value.copy(fitRoot.matrixWorld).invert() }

  const updateFace = (f: NonNullable<TrackFrame['face']>) => {
    const lm = f.lm
    for (let i = 0; i < Math.min(lm.length, 478); i++) world(lm[i], vw, vh, pts[i])
    // eye centres: halfway between each eye's two corners (steady when the eyes look around)
    const eR = mid(pts[33], pts[133]), eL = mid(pts[263], pts[362])
    const s = eR.distanceTo(eL) / hx.eyeDist
    const at = mid(eR, eL)
    if (f.matrix && f.matrix.length >= 16) tq.setFromRotationMatrix(tm.extractRotation(new THREE.Matrix4().fromArray(Array.from(f.matrix))))
    else {
      // no face transform: build the turn from the eyes and the forehead→chin line
      const x = tv.subVectors(eL, eR).normalize().clone()
      const y = new THREE.Vector3().subVectors(pts[10], pts[152]).addScaledVector(x, -new THREE.Vector3().subVectors(pts[10], pts[152]).dot(x)).normalize()
      tq.setFromRotationMatrix(tm.makeBasis(x, y, new THREE.Vector3().crossVectors(x, y)))
    }
    if (!seen) { pose.pos.copy(at); pose.q.copy(tq); pose.s = s; pose.jaw = f.jaw }
    else {
      pose.pos.lerp(at, EASE.pos); pose.q.slerp(tq, EASE.rot); pose.s += (s - pose.s) * EASE.pos; pose.jaw += (f.jaw - pose.jaw) * EASE.jaw
    }
    seen = true
    headRoot.position.copy(pose.pos); headRoot.quaternion.copy(pose.q); headRoot.scale.setScalar(pose.s)
    jaw.rotation.x = JAW_MAX * Math.min(1, Math.max(0, pose.jaw) / 0.8)
    neckRoot.position.copy(pose.pos); neckRoot.quaternion.copy(id).slerp(pose.q, NECK_FOLLOW); neckRoot.scale.setScalar(pose.s)
    for (let i = 0; i < 478; i++) facePos.setXYZ(i, pts[i].x, pts[i].y, pts[i].z)
    facePos.needsUpdate = true
    faceGeo.computeVertexNormals()
    syncToHead()
  }

  const updateHands = (list: TrackFrame['hands']) => {
    let lens = false
    hands.forEach((h, i) => {
      const t = list[i]
      if (!t || !layersNow().hands) { h.root.visible = false; h.fresh = true; return }
      t.lm.forEach((l, k) => {
        const p = world(l, vw, vh, tv)
        if (h.fresh) h.pts[k].copy(p)
        else h.pts[k].lerp(p, EASE.hand)
        h.dotPos.setXYZ(k, h.pts[k].x, h.pts[k].y, h.pts[k].z)
      })
      h.dotPos.needsUpdate = true
      h.fresh = false
      const poses = handPose(h.pts, t.right, meta)
      for (const [name, part] of h.parts) {
        const m = poses.get(name)
        part.visible = !!m
        if (m) { part.matrix.copy(m); part.matrixWorldNeedsUpdate = true }
      }
      h.root.visible = true
      if (!lens) { lens = true; lensPt.copy(h.pts[8]) }
    })
    // the X-ray lens sits on the first hand's index fingertip, in drawing-buffer pixels
    if (lens) {
      renderer.getDrawingBufferSize(buf)
      const n = tv.copy(lensPt).project(camera)
      shared.lens.value.set((n.x * 0.5 + 0.5) * buf.x, (n.y * 0.5 + 0.5) * buf.y, (cfg?.lensSize ?? 0.18) * buf.y)
    } else shared.lens.value.set(0, 0, 0)
  }

  /** A point in the video's pixels, as a mirrored point on the screen (css pixels). */
  const toScreen = (v: THREE.Vector3) => {
    const n = v.clone().project(camera)
    return { x: cw - (n.x * 0.5 + 0.5) * cw, y: (1 - (n.y * 0.5 + 0.5)) * ch }
  }

  const tags = (): TagGroup[] => {
    const out: TagGroup[] = []
    if (!cfg?.labels) return out
    const L = layersNow()
    const k = coverRect(vw, vh, cw, ch).k
    if (seen) {
      const c = toScreen(fitRoot.localToWorld(new THREE.Vector3(0, 0.01, -0.06)))
      const r = pose.s * HEAD_FIT * cfg.fit.size * 0.1 * k
      const group: TagGroup = { cx: c.x, cy: c.y, r, tags: [] }
      for (const t of headTags) {
        if (!L[t.layer]) continue
        const p = toScreen(fitRoot.localToWorld(new THREE.Vector3().fromArray(t.p)))
        group.tags.push({ id: t.id, text: t.text, x: p.x, y: p.y })
      }
      out.push(group)
    }
    if (L.hands) {
      for (const h of hands) {
        if (!h.root.visible) continue
        const mid9 = toScreen(h.pts[9]), wrist = toScreen(h.pts[0])
        const group: TagGroup = { cx: mid9.x, cy: mid9.y, r: Math.hypot(mid9.x - wrist.x, mid9.y - wrist.y) * 1.2, tags: [] }
        for (const t of HAND_TAGS) {
          const p = toScreen(new THREE.Vector3().lerpVectors(h.pts[t.a], h.pts[t.b], t.t))
          group.tags.push({ id: t.id, text: t.text, x: p.x, y: p.y })
        }
        out.push(group)
      }
    }
    return out
  }

  layout()
  applyFit(); applyLook(); applyLayers()

  return {
    resize(w, h) { cw = Math.max(1, Math.round(w)); ch = Math.max(1, Math.round(h)); layout() },
    update(f) {
      if (f.vw !== vw || f.vh !== vh) { vw = f.vw; vh = f.vh; layout() }
      if (f.face) updateFace(f.face)
      else seen = false
      updateHands(f.hands)
      applyLayers()
      renderer.render(scene, camera)
      return tags()
    },
    apply(s) {
      cfg = s
      shared.strength.value = Math.max(0.15, Math.min(1, s.strength))
      shared.brightness.value = s.brightness
      shared.feather.value = s.feather
      shared.reveal.value = REVEAL_CODE[s.reveal]
      applyFit(); applyLook(); applyLayers()
      if (seen) syncToHead()
      renderer.render(scene, camera)
    },
    draw() { renderer.render(scene, camera); return canvas },
    dispose() {
      renderer.dispose()
      faceGeo.dispose(); lineGeo.dispose(); fibres.dispose(); dotMat.dispose()
      Object.values(mats).forEach((m) => m.dispose())
      scene.traverse((o) => { const g = (o as THREE.Mesh).geometry; if (g) g.dispose() })
    },
  }
}
