import * as THREE from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { glowTexture, mulberry } from './earth'
import { FLOOR, TOP, WIN } from './hall'
import { C } from './panels'

/*
 * One light story, after the golden helmet-view reference: a golden sun through the forward window (hard shadows, a
 * visible beam, dust in it) that turns the floor and the ceiling above it gold, while the walls in shade stay a
 * near-neutral metal falling to deep shadow in the pipework; the cyan of the HUD kept as an accent. Quality tiers
 * drop the costly parts on small or slow devices.
 */

export type Quality = 'high' | 'mid' | 'low'

/**
 * What the metal reflects: a darker room with one blazing window ahead (-z), a sunlit floor and a dim ceiling. Lit
 * this way the pipes get bright streaks on the window side and fall dark on the other, instead of the even studio
 * light a generic environment gives. Rendered once into a PMREM by the scene.
 */
export function windowEnvironment() {
  const env = new THREE.Scene()
  const box = (w: number, h: number, d: number, color: string, at: [number, number, number]) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshBasicMaterial({ color, side: THREE.BackSide }))
    m.position.set(...at); env.add(m)
  }
  // This is most of the hall's ambient light (the ceiling gets almost all of its light from here), so it is kept dark
  // but for the window: crevices stay deep and only the surfaces that see the window catch its gold.
  box(16, 8, 32, '#171615', [0, 0, 0]) // the walls round the probe
  const panel = (w: number, h: number, color: string, intensity: number, at: [number, number, number], rx: number, ry = 0) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(intensity) }))
    m.position.set(...at); m.rotation.set(rx, ry, 0); env.add(m)
  }
  panel(12, 4.5, '#ffe6c4', 12, [0, 0.6, -15.9], 0) // the forward window: Earth light and the low golden sun
  panel(14, 30, '#d8c2a4', 0.26, [0, -3.9, 0], -Math.PI / 2) // the sunlit floor bouncing warm light up
  panel(5, 30, '#c8c4bc', 0.35, [0, 3.9, 0], Math.PI / 2) // the ceiling strip
  for (const x of [-7.9, 7.9]) panel(30, 1.2, '#d4d0c8', 0.45, [x, 1.5, 0], 0, -Math.sign(x) * Math.PI / 2) // light running along the walls
  return env
}

/** A first guess from the device; the scene steps down a tier if the first seconds run slow. */
export function pickQuality(): Quality {
  const cores = navigator.hardwareConcurrency || 4
  if (innerWidth < 768 || matchMedia('(pointer: coarse)').matches || cores <= 4) return 'low'
  return devicePixelRatio > 1.5 && cores < 8 ? 'mid' : 'high'
}

/** The sunlight's direction into the hall: down and a little to the left, so it lands on the forward floor. */
export const BEAM_DIR = new THREE.Vector3(-0.25, -0.45, 1).normalize()

export function addLights(scene: THREE.Scene, quality: Quality) {
  // The references are lit from the window, not the ceiling: a near-neutral, low fill keeps the shaded walls metal grey
  // with deep shadows in the pipework, and the gold comes from the sun and its bounce (low: no sun shadows, more fill)
  scene.add(new THREE.HemisphereLight('#f4eee6', '#1e1c1a', quality === 'low' ? 0.45 : 0.4))
  // ceiling lamps, warm white and kept low: they glint on the pipes but must not out-light the window
  for (const z of [11, 4, -3, -9]) {
    const l = new THREE.PointLight('#fff4ea', 0.3, 8, 2); l.position.set(0, TOP - 0.6, z); scene.add(l)
  }
  // golden bounce off the sunlit floor, carried down the hall
  for (const [z, i] of [[-10, 8], [-2, 5], [6, 3.5]]) {
    const b = new THREE.PointLight('#ffcf9e', i, 16, 1.4); b.position.set(-1, FLOOR + 0.8, z); scene.add(b)
  }
  // the sun runs to the left, so its bounce reaches the aft left corner: the tank by the door catches a warm edge
  const aft = new THREE.PointLight('#ffd8b0', 2.5, 9, 1.6); aft.position.set(-3.2, 0.6, 11.5); scene.add(aft)

  // without shadows (low) the sun would light the whole hall through its walls: kept dim there
  const sun = new THREE.DirectionalLight('#ffc283', quality === 'low' ? 0.5 : 9)
  const target = new THREE.Vector3(-1.5, FLOOR, -2)
  sun.position.copy(target).addScaledVector(BEAM_DIR, -40); sun.target.position.copy(target)
  scene.add(sun, sun.target)
  if (quality !== 'low') {
    sun.castShadow = true
    sun.shadow.mapSize.setScalar(quality === 'high' ? 4096 : 2048) // crisp grating shadows
    // the whole hall, so the sun gets in only through the window
    Object.assign(sun.shadow.camera, { left: -17, right: 17, top: 17, bottom: -17, near: 1, far: 100 })
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
    float near = smoothstep(1.5, 7.0, distance(cameraPosition, vW)); // close up the beam's faces would read as a tinted sheet
    gl_FragColor = vec4(color * fade * edge * shafts * near * strength, 1.0);
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
  void main() { float d = length(gl_PointCoord - 0.5); gl_FragColor = vec4(vec3(1.0, 0.84, 0.6) * smoothstep(0.5, 0.0, d) * vA * 0.8, 1.0); }
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
  const beamU = { time: { value: 0 }, color: { value: new THREE.Color('#ffd4a0') }, strength: { value: 0.14 } }
  const beam = new THREE.Mesh(g, new THREE.ShaderMaterial({ uniforms: beamU, vertexShader: beamVert, fragmentShader: beamFrag, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false }))
  beam.frustumCulled = false; scene.add(beam)

  const n = quality === 'high' ? 1100 : quality === 'mid' ? 600 : 0
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

/** A crisp, contrasty grade, vignette and a whisper of film grain: the lens the references were shot through. */
const LensShader = {
  uniforms: { tDiffuse: { value: null }, time: { value: 0 }, grain: { value: 0.035 }, contrast: { value: 0.36 }, balance: { value: new THREE.Vector3(1.0, 1.0, 0.985) } },
  vertexShader: /* glsl */ `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse; uniform float time; uniform float grain; uniform float contrast; uniform vec3 balance; varying vec2 vUv;
    float h(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      // contrast about mid grey (the input is linear, before tone mapping) and the white balance
      float l = dot(c.rgb, vec3(0.2126, 0.7152, 0.0722));
      c.rgb *= pow(max(l, 1e-4) / 0.18, contrast) * balance; // the references' deep shadows and crisp highlights; a neutral white balance, the gold is in the light
      vec2 d = vUv - 0.5;
      c.rgb *= mix(1.0, 0.72, smoothstep(0.45, 0.9, length(d * vec2(1.25, 1.0))));
      c.rgb += (h(vUv * 911.0 + fract(time)) - 0.5) * grain;
      gl_FragColor = c;
    }
  `,
}

/** Render, ambient occlusion (not on low), bloom, `overlays` (the lens flare), lens, output. */
export function createPost(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.PerspectiveCamera, w: number, h: number, quality: Quality, overlays: RenderPass[] = []) {
  const composer = new EffectComposer(renderer)
  composer.addPass(new RenderPass(scene, camera))
  let gtao: GTAOPass | null = null
  if (quality !== 'low') {
    gtao = new GTAOPass(scene, camera, w, h)
    gtao.blendIntensity = 0.85
    gtao.updateGtaoMaterial({ radius: 0.6, distanceExponent: 1.4, thickness: 1.2, scale: 1.1, samples: quality === 'high' ? 16 : 8 })
    composer.addPass(gtao)
  }
  // a high threshold: the bright hall and screens stay crisp, only the sun and strips glow
  composer.addPass(new UnrealBloomPass(new THREE.Vector2(w, h), 0.5, 0.5, 1.25))
  for (const o of overlays) composer.addPass(o)
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

/** Lens ghosts for the sun, along the line from the sun through the centre of the frame, faded out when the sun is
 * off screen or the hall's walls are between it and the camera. Drawn in a pass of their own after bloom (`pass`),
 * so ambient occlusion never sees them. */
export function createFlare(camera: THREE.PerspectiveCamera, sun: THREE.Vector3) {
  const scene = new THREE.Scene(), group = new THREE.Group(); scene.add(group)
  const pass = new RenderPass(scene, camera); pass.clear = false
  const disc = glowTexture([[0, 'rgba(255,255,255,0.9)'], [0.5, 'rgba(255,255,255,0.25)'], [1, 'rgba(255,255,255,0)']])
  const ring = glowTexture([[0, 'rgba(255,255,255,0)'], [0.72, 'rgba(255,255,255,0.02)'], [0.86, 'rgba(255,255,255,0.5)'], [1, 'rgba(255,255,255,0)']])
  const halo = glowTexture([[0, 'rgba(255,240,210,0.6)'], [0.25, 'rgba(255,200,130,0.18)'], [1, 'rgba(255,170,90,0)']])
  // [where along the line (1 = at the sun, 0 = centre, below 0 = past it), size, texture, colour, opacity]
  const ghosts = ([
    [1, 1.1, halo, '#ffd9a0', 0.55], [0.55, 0.09, disc, '#ffb070', 0.35], [0.25, 0.05, disc, '#c8ff9a', 0.3],
    [-0.2, 0.16, ring, '#8fd0ff', 0.35], [-0.45, 0.07, disc, '#ff9ad0', 0.25], [-0.8, 0.3, ring, '#ffc070', 0.22],
  ] as const).map(([at, size, map, color, op]) => {
    const m = new THREE.SpriteMaterial({ map, color, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false, fog: false, toneMapped: false })
    const sp = new THREE.Sprite(m); sp.renderOrder = 20; group.add(sp)
    return { sp, at, size, op }
  })
  const ndc = new THREE.Vector3(), dir = new THREE.Vector3()
  let seen = 0
  return {
    pass,
    update(reduced: boolean) {
      camera.updateMatrixWorld()
      group.matrixAutoUpdate = false; group.matrix.copy(camera.matrixWorld) // the ghosts sit on the lens
      ndc.copy(sun).project(camera)
      let vis = ndc.z < 1 ? 1 - THREE.MathUtils.smoothstep(Math.max(Math.abs(ndc.x), Math.abs(ndc.y)), 0.85, 1.25) : 0
      const p = camera.position
      if (vis > 0 && p.z > WIN.z) { // inside the hall: only through the window
        dir.copy(sun).sub(p)
        const k = (WIN.z - p.z) / dir.z, x = p.x + dir.x * k, y = p.y + dir.y * k
        if (!(k > 0 && Math.abs(x) < WIN.x && y > WIN.y0 && y < WIN.y1)) vis = 0
      }
      seen += (vis - seen) * (reduced ? 1 : 0.15)
      group.visible = seen > 0.01
      if (!group.visible) return
      const ty = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)), tx = ty * camera.aspect
      for (const g of ghosts) {
        g.sp.position.set(ndc.x * g.at * tx, ndc.y * g.at * ty, -1)
        g.sp.scale.setScalar(g.size * ty)
        ;(g.sp.material as THREE.SpriteMaterial).opacity = g.op * seen
      }
    },
  }
}
