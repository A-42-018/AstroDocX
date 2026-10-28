import * as THREE from 'three'

/*
 * Space outside the forward window: Earth as a real sphere (day, night lights, clouds, atmosphere rim), the sun
 * and a starfield. Earth uses NASA Visible Earth maps (public domain) in public/textures/ when they are there and
 * falls back to a procedural globe, so the scene never waits on them. Nothing here takes fog.
 */

/** Where the sun is seen from the hall: up and to the right through the window. */
export const SUN_DIR = new THREE.Vector3(14, 4.5, -80).normalize()
/** The light on Earth itself: from above and behind the ship, so the side we see is in daylight (artistic, like the references). */
const EARTH_SUN = new THREE.Vector3(0.55, 0.5, 0.65).normalize()
const R = 300
/** Starting longitude turned toward the ship: Africa and the Atlantic, green and blue rather than polar snow. */
const SPIN0 = 2.2
/** Below and ahead of the ship, so the limb arcs across the upper window. */
export const EARTH_CENTER = new THREE.Vector3(0, -R + 9.5, -340)

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
    vec3 c = dayC * (0.03 + 0.95 * max(l, 0.0)) * lit + nightC * (1.0 - lit) * 0.9;
    // a little sun glint on the oceans
    vec3 v = normalize(cameraPosition - vW);
    c += pow(max(dot(reflect(-sun, normalize(vN)), v), 0.0), 40.0) * 0.25 * lit;
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
    float l = dot(normalize(vN), sun);
    float face = abs(dot(normalize(cameraPosition - vW), normalize(vN))); // seen edge-on, cloud layers stack up: thin them there
    gl_FragColor = vec4(vec3(0.8) * (0.04 + max(l, 0.0)), a * smoothstep(-0.2, 0.15, l) * (0.15 + 0.55 * smoothstep(0.0, 0.35, face)));
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`
const atmoVert = /* glsl */ `
  varying vec3 vN; varying vec3 vW;
  void main() { vN = normalize(mat3(modelMatrix) * normal); vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }
`
const atmoFrag = /* glsl */ `
  uniform vec3 sun; varying vec3 vN; varying vec3 vW;
  void main() {
    vec3 v = normalize(cameraPosition - vW);
    float rim = pow(1.0 - abs(dot(v, normalize(vN))), 3.0);
    float day = smoothstep(-0.3, 0.4, dot(normalize(vN), sun));
    gl_FragColor = vec4(vec3(0.35, 0.65, 1.0) * rim * (0.25 + 1.4 * day), rim);
  }
`

function glowTexture(stops: [number, string][]) {
  const c = document.createElement('canvas'); c.width = c.height = 256
  const g = c.getContext('2d')!, gr = g.createRadialGradient(128, 128, 0, 128, 128, 128)
  for (const [o, col] of stops) gr.addColorStop(o, col)
  g.fillStyle = gr; g.fillRect(0, 0, 256, 256)
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace
  return t
}

export interface Space { group: THREE.Group; sun: THREE.Vector3; update: (t: number, still: number) => void }

/**
 * Builds Earth, sun and stars; `textures` is the folder the Earth maps would be in. `sharp` picks the 4K day map
 * ("Earth" by kongle, CC BY-SA 4.0) over NASA's 2K one; phones and small GPUs keep the 2K.
 */
export function createSpace(scene: THREE.Scene, textures: string, sharp: boolean): Space {
  const group = new THREE.Group(); scene.add(group)
  const uniforms = {
    day: { value: null as THREE.Texture | null }, night: { value: null as THREE.Texture | null }, clouds: { value: null as THREE.Texture | null },
    maps: { value: 0 }, sun: { value: EARTH_SUN }, time: { value: 0 },
  }
  // tilted so the ship looks down on the tropics, not a pole; `spin` turns about Earth's own axis
  const earth = new THREE.Group(); earth.position.copy(EARTH_CENTER); earth.rotation.set(1.42, 0, 0.25); group.add(earth)
  const spin = new THREE.Group(); earth.add(spin)
  const geo = new THREE.SphereGeometry(R, 128, 64)
  spin.add(new THREE.Mesh(geo, new THREE.ShaderMaterial({ uniforms, vertexShader: surfaceVert, fragmentShader: surfaceFrag })))
  const clouds = new THREE.Mesh(geo, new THREE.ShaderMaterial({ uniforms, vertexShader: surfaceVert, fragmentShader: cloudFrag, transparent: true, depthWrite: false }))
  clouds.scale.setScalar(1.006); spin.add(clouds)
  const atmo = new THREE.Mesh(geo, new THREE.ShaderMaterial({ uniforms, vertexShader: atmoVert, fragmentShader: atmoFrag, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.BackSide }))
  atmo.scale.setScalar(1.035); atmo.position.copy(EARTH_CENTER); group.add(atmo)

  // the real maps, if they are installed; all three or none
  const loader = new THREE.TextureLoader()
  const load = (name: string) => loader.loadAsync(`${textures}${name}`).then((t) => { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t })
  const day = sharp ? load('earth_day_4k.webp').catch(() => load('earth_day.webp')) : load('earth_day.webp')
  Promise.all([day, load('earth_night.webp'), load('earth_clouds.webp')])
    .then(([d, n, c]) => { uniforms.day.value = d; uniforms.night.value = n; uniforms.clouds.value = c; uniforms.maps.value = 1 })
    .catch(() => { /* procedural Earth stays */ })

  // the sun: a hot core and a wide soft halo
  const SUN_AT = SUN_DIR.clone().multiplyScalar(900)
  for (const [size, tex, op] of [
    [60, glowTexture([[0, 'rgba(255,255,250,1)'], [0.2, 'rgba(255,240,200,0.9)'], [0.5, 'rgba(255,200,120,0.25)'], [1, 'rgba(255,180,90,0)']]), 1],
    [520, glowTexture([[0, 'rgba(255,214,150,0.55)'], [0.3, 'rgba(255,180,100,0.12)'], [1, 'rgba(255,160,80,0)']]), 0.9],
  ] as const) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, toneMapped: false, opacity: op }))
    s.scale.setScalar(size); s.position.copy(SUN_AT); group.add(s)
  }

  // stars: a shell far out, a few brighter ones
  const r = mulberry(7), n = 2600, pos = new Float32Array(n * 3), col = new Float32Array(n * 3)
  for (let i = 0; i < n; i++) {
    const u = r() * 2 - 1, a = r() * Math.PI * 2, s = Math.sqrt(1 - u * u)
    pos.set([Math.cos(a) * s * 1000, u * 1000, Math.sin(a) * s * 1000], i * 3)
    const b = 0.35 + Math.pow(r(), 3) * 0.9, warm = r()
    col.set([b * (0.9 + warm * 0.1), b * 0.95, b * (1.05 - warm * 0.15)], i * 3)
  }
  const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(pos, 3)); sg.setAttribute('color', new THREE.BufferAttribute(col, 3))
  group.add(new THREE.Points(sg, new THREE.PointsMaterial({ size: 1.6, sizeAttenuation: false, vertexColors: true, fog: false, depthWrite: false, toneMapped: false })))

  return {
    group, sun: SUN_AT,
    update(t, still) {
      uniforms.time.value = t * still
      spin.rotation.y = SPIN0 + t * 0.004 * still
      clouds.rotation.y = t * 0.0015 * still
    },
  }
}
