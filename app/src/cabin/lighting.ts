import * as THREE from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { mulberry } from './earth'
import { FLOOR, HALF, LEN, TOP } from './hall'
import { C } from './panels'

/*
 * One light story: a warm sun through the forward window (shadows, a visible beam, dust in it) against cool,
 * dim cabin fill and the cyan of the HUD. Quality tiers drop the costly parts on small or slow devices.
 */

export type Quality = 'high' | 'mid' | 'low'

/** A first guess from the device; the scene steps down a tier if the first seconds run slow. */
export function pickQuality(): Quality {
  const cores = navigator.hardwareConcurrency || 4
  if (innerWidth < 768 || matchMedia('(pointer: coarse)').matches || cores <= 4) return 'low'
  return devicePixelRatio > 1.5 && cores < 8 ? 'mid' : 'high'
}

/** The sunlight's direction into the hall: down and a little to the left, so it lands on the forward floor. */
export const BEAM_DIR = new THREE.Vector3(-0.25, -0.45, 1).normalize()
/** The window opening in the forward bulkhead. */
const WIN = { x: HALF - 2.2, y0: FLOOR + 1.2, y1: TOP - 1.8, z: -LEN + 0.15 }

export function addLights(scene: THREE.Scene, quality: Quality) {
  scene.add(new THREE.HemisphereLight('#9fb8d2', '#0d1218', 0.32))
  // cool ceiling fill, kept low so the sun reads as the key
  for (const z of [11, 4, -3, -9]) {
    const l = new THREE.PointLight('#cfe3ff', 5.5, 13, 1.6); l.position.set(0, TOP - 0.6, z); scene.add(l)
  }
  // warm bounce off the sunlit floor
  const bounce = new THREE.PointLight('#ffbf80', 4.5, 14, 1.4); bounce.position.set(-1, FLOOR + 0.8, -10); scene.add(bounce)

  const sun = new THREE.DirectionalLight('#ffe2b8', 3.6)
  const target = new THREE.Vector3(-1.5, FLOOR, -8)
  sun.position.copy(target).addScaledVector(BEAM_DIR, -40); sun.target.position.copy(target)
  scene.add(sun, sun.target)
  if (quality !== 'low') {
    sun.castShadow = true
    sun.shadow.mapSize.setScalar(quality === 'high' ? 2048 : 1024)
    Object.assign(sun.shadow.camera, { left: -12, right: 12, top: 12, bottom: -12, near: 1, far: 90 })
    sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03
  }

  const alarm = new THREE.PointLight(C.watch, 0, 5, 1.6)
  scene.add(alarm)
  return { alarm, sun }
}

const beamVert = /* glsl */ `
  attribute float along; varying float vAlong; varying vec2 vUv; varying vec3 vN; varying vec3 vW;
  void main() { vAlong = along; vUv = uv; vN = normalize(mat3(modelMatrix) * normal); vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }
`
const beamFrag = /* glsl */ `
  uniform float time; uniform vec3 color; uniform float strength;
  varying float vAlong; varying vec2 vUv; varying vec3 vN; varying vec3 vW;
  void main() {
    float fade = pow(1.0 - vAlong, 1.6) * smoothstep(0.0, 0.06, vAlong);
    float edge = abs(dot(normalize(cameraPosition - vW), normalize(vN))); // edge-on faces vanish, so the beam has no hard outline
    float shafts = 0.55 + 0.45 * sin(vUv.x * 38.0 + time * 0.35) * sin(vUv.x * 17.0 - time * 0.2);
    gl_FragColor = vec4(color * fade * edge * shafts * strength, 1.0);
  }
`
const dustVert = /* glsl */ `
  uniform float time; uniform float px; attribute float seed; varying float vA;
  void main() {
    vec3 p = position + vec3(sin(time * 0.11 + seed * 6.3), sin(time * 0.07 + seed * 4.1), cos(time * 0.09 + seed * 5.7)) * 0.35;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_PointSize = px * (0.6 + seed) * (6.0 / -mv.z);
    vA = smoothstep(0.4, 2.0, -mv.z) * (0.4 + 0.6 * fract(seed * 7.0));
    gl_Position = projectionMatrix * mv;
  }
`
const dustFrag = /* glsl */ `
  varying float vA;
  void main() { float d = length(gl_PointCoord - 0.5); gl_FragColor = vec4(vec3(1.0, 0.86, 0.66) * smoothstep(0.5, 0.0, d) * vA * 0.7, 1.0); }
`

/** The visible sunbeam from the window and the dust drifting in it. */
export function createSunBeam(scene: THREE.Scene, quality: Quality) {
  const L = 22
  // four open sides of the window prism, extruded along the beam; `along` runs 0 at the glass to 1 at the far end
  const c = [[-WIN.x, WIN.y0], [WIN.x, WIN.y0], [WIN.x, WIN.y1], [-WIN.x, WIN.y1]].map(([x, y]) => new THREE.Vector3(x, y, WIN.z))
  const pos: number[] = [], along: number[] = [], uv: number[] = [], idx: number[] = []
  for (let s = 0; s < 4; s++) {
    const a = c[s], b = c[(s + 1) % 4], base = pos.length / 3
    for (const [p, k] of [[a, 0], [b, 0], [b, 1], [a, 1]] as const) {
      const v = p.clone().addScaledVector(BEAM_DIR, L * k); pos.push(v.x, v.y, v.z); along.push(k)
    }
    uv.push(s, 0, s + 1, 0, s + 1, 1, s, 1)
    idx.push(base, base + 1, base + 2, base, base + 2, base + 3)
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('along', new THREE.Float32BufferAttribute(along, 1))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv.map((u, i) => (i % 2 ? u : u / 4)), 2)); g.setIndex(idx); g.computeVertexNormals()
  const beamU = { time: { value: 0 }, color: { value: new THREE.Color('#ffcf94') }, strength: { value: 0.18 } }
  const beam = new THREE.Mesh(g, new THREE.ShaderMaterial({ uniforms: beamU, vertexShader: beamVert, fragmentShader: beamFrag, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false }))
  beam.frustumCulled = false; scene.add(beam)

  const n = quality === 'high' ? 700 : quality === 'mid' ? 400 : 0
  const r = mulberry(5), dp = new Float32Array(n * 3), seed = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    const p = new THREE.Vector3(THREE.MathUtils.lerp(-WIN.x, WIN.x, r()), THREE.MathUtils.lerp(WIN.y0, WIN.y1, r()), WIN.z).addScaledVector(BEAM_DIR, Math.pow(r(), 0.8) * L * 0.8)
    if (p.y < FLOOR + 0.1) p.y = FLOOR + 0.1 + r() * 2
    dp.set(p.toArray(), i * 3); seed[i] = r()
  }
  const dg = new THREE.BufferGeometry(); dg.setAttribute('position', new THREE.BufferAttribute(dp, 3)); dg.setAttribute('seed', new THREE.BufferAttribute(seed, 1))
  const dustU = { time: { value: 0 }, px: { value: 3 * Math.min(devicePixelRatio, 2) } }
  const dust = new THREE.Points(dg, new THREE.ShaderMaterial({ uniforms: dustU, vertexShader: dustVert, fragmentShader: dustFrag, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }))
  dust.visible = n > 0; scene.add(dust)

  return {
    update(t: number, still: number) { beamU.time.value = t * still; dustU.time.value = t * still },
  }
}

/** Vignette and a whisper of film grain, the lens the references were shot through. */
const LensShader = {
  uniforms: { tDiffuse: { value: null }, time: { value: 0 }, grain: { value: 0.035 } },
  vertexShader: /* glsl */ `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse; uniform float time; uniform float grain; varying vec2 vUv;
    float h(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      vec2 d = vUv - 0.5;
      c.rgb *= mix(1.0, 0.55, smoothstep(0.35, 0.85, length(d * vec2(1.25, 1.0))));
      c.rgb += (h(vUv * 911.0 + fract(time)) - 0.5) * grain;
      gl_FragColor = c;
    }
  `,
}

/** Render, ambient occlusion (not on low), bloom, lens, output. */
export function createPost(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.PerspectiveCamera, w: number, h: number, quality: Quality) {
  const composer = new EffectComposer(renderer)
  composer.addPass(new RenderPass(scene, camera))
  let gtao: GTAOPass | null = null
  if (quality !== 'low') {
    gtao = new GTAOPass(scene, camera, w, h)
    gtao.blendIntensity = 0.85
    gtao.updateGtaoMaterial({ radius: 0.6, distanceExponent: 1.4, thickness: 1.2, scale: 1.1, samples: quality === 'high' ? 16 : 8 })
    composer.addPass(gtao)
  }
  composer.addPass(new UnrealBloomPass(new THREE.Vector2(w, h), 0.5, 0.5, 0.88))
  const lens = new ShaderPass(LensShader)
  composer.addPass(lens)
  composer.addPass(new OutputPass())
  return {
    composer,
    /** Drops ambient occlusion when the device turns out slower than guessed. */
    downgrade() { if (gtao) { gtao.enabled = false; return true } return false },
    update(t: number, still: number) { lens.uniforms.time.value = t * still; lens.uniforms.grain.value = 0.035 * (still || 0.4) },
  }
}
