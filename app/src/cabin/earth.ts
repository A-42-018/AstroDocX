import * as THREE from 'three'

/*
 * Space outside the forward window: Earth as a real sphere (day, night lights, clouds, atmosphere rim), the sun
 * and a starfield. Earth uses NASA Visible Earth maps (public domain) in public/textures/ when they are there and
 * falls back to a procedural globe, so the scene never waits on them. Nothing here takes fog.
 */

/** Where the sun is seen from the hall: just above the limb at the window's upper right, behind the station on EVA. */
export const SUN_DIR = new THREE.Vector3(0.158, 0.045, -1).normalize()
export const SUN_AT = SUN_DIR.clone().multiplyScalar(900)
/** The light on Earth itself: from above and behind the ship, so the side we see is in daylight (artistic, like the references). */
const EARTH_SUN = new THREE.Vector3(0.55, 0.5, 0.65).normalize()
const R = 600
/**
 * Starting longitude turned toward the ship: with the tilt below, the views look down on the US east coast at about
 * 33-40 N, green land, blue Atlantic and the cloud bands over it (the day map is a winter one: further north is snow).
 */
const SPIN0 = 2.62
/**
 * Below and ahead of the ship, in a low orbit (about 0.08 R up): the horizon sits just above eye level ahead, so
 * the limb crosses the upper window and curves away down the sides, and on EVA Earth fills the lower frame.
 */
export const EARTH_CENTER = new THREE.Vector3(0, -591, -251)

export function mulberry(a: number) {
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
}

const NOISE = /* glsl */ `
  float hash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
  float noise(vec3 x) {
    vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x), mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
               mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x), mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z);
  }
  float fbm(vec3 p) { float v = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { v += a * noise(p); p *= 2.03; a *= 0.5; } return v; }
`

const surfaceVert = /* glsl */ `
  varying vec3 vN; varying vec3 vObj; varying vec2 vUv; varying vec3 vW;
  void main() { vUv = uv; vObj = normalize(position); vN = normalize(mat3(modelMatrix) * normal); vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }
`
const surfaceFrag = /* glsl */ `
  uniform sampler2D day; uniform sampler2D night; uniform float maps; uniform vec3 sun;
  varying vec3 vN; varying vec3 vObj; varying vec2 vUv; varying vec3 vW;
  ${NOISE}
  void main() {
    float l = dot(normalize(vN), sun);
    float lit = smoothstep(-0.12, 0.25, l);
    vec3 dayC, nightC;
    if (maps > 0.5) { dayC = texture2D(day, vUv).rgb; nightC = texture2D(night, vUv).rgb * vec3(1.0, 0.8, 0.55); }
    else {
      float land = smoothstep(0.52, 0.56, fbm(vObj * 3.2));
      float ice = smoothstep(0.82, 0.9, abs(vObj.y));
      vec3 sea = mix(vec3(0.02, 0.11, 0.28), vec3(0.05, 0.25, 0.5), fbm(vObj * 9.0));
      vec3 ground = mix(vec3(0.16, 0.24, 0.1), vec3(0.42, 0.36, 0.22), fbm(vObj * 7.0 + 3.0));
      dayC = pow(mix(mix(sea, ground, land), vec3(0.9), ice), vec3(2.2)); // authored in sRGB
      nightC = land * step(0.66, fbm(vObj * 40.0)) * vec3(1.0, 0.72, 0.4) * 0.7;
    }
    // like the references: deep saturated blue oceans, land a muted green-brown rather than lime
    float dl = dot(dayC, vec3(0.2126, 0.7152, 0.0722));
    float ocean = smoothstep(0.0, 0.04, dayC.b - max(dayC.r, dayC.g));
    dayC = mix(mix(vec3(dl), dayC, 0.7) * vec3(1.06, 0.97, 0.86), max(mix(vec3(dl), dayC, 1.35), 0.0) * vec3(0.8, 1.0, 1.25), ocean);
    // fine detail the 4K map lacks up close (EVA is a few km up): breaks the blur into texture
    dayC *= 0.82 + 0.36 * fbm(vObj * 1400.0);
    vec3 c = dayC * (0.03 + 1.3 * max(l, 0.0)) * lit + nightC * (1.0 - lit) * 0.9;
    vec3 v = normalize(cameraPosition - vW);
    // a little sun glint on the oceans
    c += pow(max(dot(reflect(-sun, normalize(vN)), v), 0.0), 40.0) * 0.25 * lit;
    // aerial haze: thicker the more edge-on the ground is seen, so the land fades into a blue-white limb
    float graze = 1.0 - max(dot(v, normalize(vN)), 0.0);
    vec3 haze = vec3(0.32, 0.56, 1.0) * (0.06 + 0.85 * max(l, 0.0));
    c = mix(c, haze, clamp(0.01 + 0.7 * pow(graze, 12.0), 0.0, 0.7));
    gl_FragColor = vec4(c, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`
const cloudFrag = /* glsl */ `
  uniform sampler2D clouds; uniform float maps; uniform vec3 sun; uniform float time;
  varying vec3 vN; varying vec3 vObj; varying vec2 vUv; varying vec3 vW;
  ${NOISE}
  void main() {
    float a = maps > 0.5 ? texture2D(clouds, vUv).r : smoothstep(0.6, 0.85, fbm(vObj * 5.0 + vec3(time * 0.01, 0.0, 0.0)));
    // crisp, bright cloud tops with broken edges, not a soft grey veil
    a = smoothstep(0.28, 0.7, a * (0.75 + 0.5 * fbm(vObj * 900.0)));
    float l = dot(normalize(vN), sun);
    float face = abs(dot(normalize(cameraPosition - vW), normalize(vN))); // seen edge-on, cloud layers stack up: thin them there
    gl_FragColor = vec4(vec3(1.0) * (0.05 + 1.15 * max(l, 0.0)), a * smoothstep(-0.2, 0.15, l) * (0.45 + 0.5 * smoothstep(0.0, 0.35, face)));
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`
const atmoVert = /* glsl */ `
  varying vec3 vN; varying vec3 vW;
  void main() { vN = normalize(mat3(modelMatrix) * normal); vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }
`
/** The air above the limb: for each view ray, how close it passes to the ground; brightest there, fading with height. */
const atmoFrag = /* glsl */ `
  uniform vec3 sun; uniform vec3 center; uniform float radius; varying vec3 vN; varying vec3 vW;
  void main() {
    vec3 d = normalize(vW - cameraPosition);
    float t = dot(center - cameraPosition, d);
    vec3 p = cameraPosition + d * max(t, 0.0);
    float h = max(length(p - center) - radius, 0.0) / radius;
    float glow = exp(-h / 0.0075), core = exp(-h / 0.0018);
    float day = smoothstep(-0.3, 0.4, dot(normalize(p - center), sun));
    vec3 col = mix(vec3(0.22, 0.48, 1.0), vec3(0.78, 0.9, 1.0), core);
    gl_FragColor = vec4(col * (glow * 0.55 + core * 0.35) * (0.15 + 1.1 * day), 1.0);
  }
`

export function glowTexture(stops: [number, string][]) {
  const c = document.createElement('canvas'); c.width = c.height = 256
  const g = c.getContext('2d')!, gr = g.createRadialGradient(128, 128, 0, 128, 128, 128)
  for (const [o, col] of stops) gr.addColorStop(o, col)
  g.fillStyle = gr; g.fillRect(0, 0, 256, 256)
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace
  return t
}

export interface Space { group: THREE.Group; sun: THREE.Vector3; update: (t: number, still: number) => void }

/** A sunburst: thin rays of random length round a hot centre. */
function raysTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 512
  const g = c.getContext('2d')!, r = mulberry(11)
  g.translate(256, 256); g.globalCompositeOperation = 'lighter'
  for (let i = 0; i < 28; i++) {
    const a = (i / 28) * Math.PI * 2 + r() * 0.12, len = 90 + r() * 166 * (i % 2 ? 0.55 : 1), w = 1.2 + r() * 2.4
    const gr = g.createLinearGradient(0, 0, Math.cos(a) * len, Math.sin(a) * len)
    gr.addColorStop(0, 'rgba(255,236,200,0.75)'); gr.addColorStop(1, 'rgba(255,200,130,0)')
    g.fillStyle = gr; g.beginPath(); g.moveTo(-Math.sin(a) * w, Math.cos(a) * w); g.lineTo(Math.cos(a) * len, Math.sin(a) * len); g.lineTo(Math.sin(a) * w, -Math.cos(a) * w); g.fill()
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace
  return t
}

/** The Milky Way: a soft, mottled band of light behind the stars. */
const bandVert = /* glsl */ `varying vec3 vP; void main() { vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`
const bandFrag = /* glsl */ `
  uniform vec3 axis; varying vec3 vP;
  ${NOISE}
  void main() {
    float b = dot(vP, axis);
    float n = fbm(vP * 6.0), dust = smoothstep(0.45, 0.7, fbm(vP * 11.0 + 4.0));
    float band = exp(-b * b / 0.018) * (0.45 + 0.9 * n) * (1.0 - 0.6 * dust * exp(-b * b / 0.004));
    vec3 col = mix(vec3(0.5, 0.55, 0.75), vec3(0.95, 0.85, 0.7), n);
    gl_FragColor = vec4(col * band * 0.2, 1.0);
  }
`
/** The band's pole: the band runs up from the lower right of the EVA view across the sky behind the astronaut. */
const BAND_AXIS = new THREE.Vector3(0.45, 0.35, 0.82).normalize()

/**
 * Builds Earth, sun and stars; `textures` is the folder the Earth maps would be in. `sharp` picks the 4K day map
 * ("Earth" by kongle, CC BY-SA 4.0) over NASA's 2K one; phones and small GPUs keep the 2K. `rich` adds the
 * Milky Way glow and more stars.
 */
export function createSpace(scene: THREE.Scene, textures: string, sharp: boolean, rich = true): Space {
  const group = new THREE.Group(); scene.add(group)
  const uniforms = {
    day: { value: null as THREE.Texture | null }, night: { value: null as THREE.Texture | null }, clouds: { value: null as THREE.Texture | null },
    maps: { value: 0 }, sun: { value: EARTH_SUN }, time: { value: 0 }, center: { value: EARTH_CENTER }, radius: { value: R },
  }
  // tilted so the ship looks down on the tropics, not a pole; `spin` turns about Earth's own axis
  const earth = new THREE.Group(); earth.position.copy(EARTH_CENTER); earth.rotation.set(1.15, 0, 0.25); group.add(earth)
  const spin = new THREE.Group(); earth.add(spin)
  const geo = new THREE.SphereGeometry(R, 256, 128)
  spin.add(new THREE.Mesh(geo, new THREE.ShaderMaterial({ uniforms, vertexShader: surfaceVert, fragmentShader: surfaceFrag })))
  const clouds = new THREE.Mesh(geo, new THREE.ShaderMaterial({ uniforms, vertexShader: surfaceVert, fragmentShader: cloudFrag, transparent: true, depthWrite: false }))
  clouds.scale.setScalar(1.006); spin.add(clouds)
  const atmo = new THREE.Mesh(geo, new THREE.ShaderMaterial({ uniforms, vertexShader: atmoVert, fragmentShader: atmoFrag, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.BackSide }))
  atmo.scale.setScalar(1.04); atmo.position.copy(EARTH_CENTER); group.add(atmo)

  // the real maps, if they are installed; all three or none
  const loader = new THREE.TextureLoader()
  const load = (name: string) => loader.loadAsync(`${textures}${name}`).then((t) => { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t })
  const day = sharp ? load('earth_day_4k.webp').catch(() => load('earth_day.webp')) : load('earth_day.webp')
  Promise.all([day, load('earth_night.webp'), load('earth_clouds.webp')])
    .then(([d, n, c]) => { uniforms.day.value = d; uniforms.night.value = n; uniforms.clouds.value = c; uniforms.maps.value = 1 })
    .catch(() => { /* procedural Earth stays */ })

  // the sun: a white-hot core (bright enough to bloom), a wide soft halo and a slowly turning starburst
  const sunSprites = ([
    [520, glowTexture([[0, 'rgba(255,240,215,0.55)'], [0.3, 'rgba(255,220,170,0.1)'], [1, 'rgba(255,200,140,0)']]), 0.9, 1],
    [380, raysTexture(), 0.9, 1.6],
    [70, glowTexture([[0, 'rgba(255,255,250,1)'], [0.2, 'rgba(255,244,210,0.95)'], [0.5, 'rgba(255,200,120,0.3)'], [1, 'rgba(255,180,90,0)']]), 1, 4],
  ] as const).map(([size, tex, op, hot]) => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, toneMapped: false, opacity: op }))
    s.material.color.setScalar(hot); s.scale.setScalar(size); s.position.copy(SUN_AT); group.add(s)
    return s
  })
  const rays = sunSprites[1].material

  // the Milky Way glow (not on small GPUs), then the stars: a shell far out, a third of them crowded into the band
  if (rich) {
    const band = new THREE.Mesh(new THREE.SphereGeometry(980, 48, 24), new THREE.ShaderMaterial({ uniforms: { axis: { value: BAND_AXIS } }, vertexShader: bandVert, fragmentShader: bandFrag, side: THREE.BackSide, depthWrite: false, fog: false, blending: THREE.AdditiveBlending, transparent: true }))
    band.renderOrder = -1; group.add(band)
  }
  const r = mulberry(7), n = rich ? 6000 : 3000, pos = new Float32Array(n * 3), col = new Float32Array(n * 3)
  const e1 = new THREE.Vector3(1, 0, 0).cross(BAND_AXIS).normalize(), e2 = BAND_AXIS.clone().cross(e1)
  const p = new THREE.Vector3()
  for (let i = 0; i < n; i++) {
    if (i % 3 === 0) { // in the band: round the great circle, a gaussian spread off it
      const a = r() * Math.PI * 2, off = (r() + r() + r() - 1.5) * 0.12
      p.copy(e1).multiplyScalar(Math.cos(a)).addScaledVector(e2, Math.sin(a)).addScaledVector(BAND_AXIS, off).normalize()
    } else {
      const u = r() * 2 - 1, a = r() * Math.PI * 2, s = Math.sqrt(1 - u * u)
      p.set(Math.cos(a) * s, u, Math.sin(a) * s)
    }
    pos.set(p.multiplyScalar(1000).toArray(), i * 3)
    const b = (i % 3 === 0 ? 0.25 : 0.35) + Math.pow(r(), 4) * 1.1, warm = r()
    col.set([b * (0.9 + warm * 0.1), b * 0.95, b * (1.05 - warm * 0.15)], i * 3)
  }
  const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(pos, 3)); sg.setAttribute('color', new THREE.BufferAttribute(col, 3))
  group.add(new THREE.Points(sg, new THREE.PointsMaterial({ size: 1.7, sizeAttenuation: false, vertexColors: true, fog: false, depthWrite: false, toneMapped: false })))

  return {
    group, sun: SUN_AT,
    update(t, still) {
      uniforms.time.value = t * still
      spin.rotation.y = SPIN0 + t * 0.0012 * still // slow enough that a long visit stays over the same coast
      clouds.rotation.y = t * 0.0015 * still
      rays.rotation = t * 0.01 * still
    },
  }
}
