import * as THREE from 'three'
import type { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { C } from './panels'

/*
 * The hall: "Space Ship Interior" by Ryley Burnett (CC BY 4.0) with a mirrored twin, scaled to a
 * 15.5 x 31 m hall (walls at x = +-7.8, floor y = -2.5, door at z = +15.4, Earth window at z = -15.4).
 */
export const HALF = 7.76, LEN = 15.4, TOP = 3.9, FLOOR = -2.5
/** The opening in the forward bulkhead: Earth fills it from the helmet stop, the sun at its upper right. */
export const WIN = { x: HALF - 1.8, y0: FLOOR + 0.9, y1: TOP - 1.4, z: -LEN + 0.15 }
/** The layer of everything in the hall that shades the sun (the shadow casters), for the low tier's sun pool (lighting.ts). */
export const SUN_LAYER = 1
/** Casts and takes shadows, and is on the sun layer. */
const shades = (o: THREE.Object3D) => { o.castShadow = o.receiveShadow = true; o.layers.enable(SUN_LAYER) }

/*
 * Surfaces: the model has no textures, so ambientCG maps (CC0) are projected in world space (triplanar).
 * Walls and ceiling: light grey with PaintedMetal004's scratches and scuffs as wear (its red is not used).
 * Floor: MetalPlates006 tread plate, tinted the bronze of the golden reference's floor.
 * The flat plates the model leaves open (the ceiling seam, the aft wall, the door) get the same wear plus a grid of
 * recessed panel seams, so they read as built, not as placeholders.
 */
const TRI_VERT = /* glsl */ `
  #include <project_vertex>
  vTriPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
  vTriN = normalize(mat3(modelMatrix) * objectNormal);
`
const TRI_COMMON = /* glsl */ `
  uniform sampler2D wearCol; uniform sampler2D wearNor; uniform sampler2D wearRou;
  uniform sampler2D plateCol; uniform sampler2D plateNor; uniform sampler2D plateRou;
  uniform float floorY; uniform vec3 plateTint; uniform vec2 panel; uniform float roughBase;
  varying vec3 vTriPos; varying vec3 vTriN;
  vec3 triW() { vec3 w = pow(abs(normalize(vTriN)), vec3(4.0)); return w / (w.x + w.y + w.z); }
  vec4 tri(sampler2D t, float s) { vec3 w = triW(); vec3 p = vTriPos * s; return texture2D(t, p.zy) * w.x + texture2D(t, p.xz) * w.y + texture2D(t, p.xy) * w.z; }
  // whiteout-blended triplanar normal in world space (Golus)
  vec3 triN(sampler2D t, float s, float k) {
    vec3 w = triW(), n = normalize(vTriN), p = vTriPos * s;
    vec3 a = texture2D(t, p.zy).xyz * 2.0 - 1.0, b = texture2D(t, p.xz).xyz * 2.0 - 1.0, c = texture2D(t, p.xy).xyz * 2.0 - 1.0;
    a.xy *= k; b.xy *= k; c.xy *= k;
    a = vec3(a.xy + n.zy, abs(a.z) * n.x); b = vec3(b.xy + n.xz, abs(b.z) * n.y); c = vec3(c.xy + n.xy, abs(c.z) * n.z);
    return normalize(a.zyx * w.x + b.xzy * w.y + c.xyz * w.z);
  }
  float isFloor() { return step(0.65, normalize(vTriN).y) * step(vTriPos.y, floorY); }
  // Recessed seams on a grid of panel.x by panel.y metres, on the face's dominant plane (none while panel is zero).
  // Returns (in a seam, the soft shade along it, this panel's tone); tilt bends the normal down the seam's bevels.
  vec3 seams(out vec3 tilt) {
    tilt = vec3(0.0);
    if (panel.x <= 0.0) return vec3(0.0, 0.0, 1.0);
    vec3 n = abs(normalize(vTriN)), eu = vec3(1.0, 0.0, 0.0), ev = vec3(0.0, 1.0, 0.0);
    vec2 uv = vTriPos.xy;
    if (n.x > n.y && n.x > n.z) { uv = vTriPos.zy; eu = vec3(0.0, 0.0, 1.0); }
    else if (n.y > n.z) { uv = vTriPos.xz; ev = vec3(0.0, 0.0, 1.0); }
    vec2 q = uv / panel, f = fract(q + 0.5) - 0.5, d = abs(f) * panel; // metres to the nearest seam on each axis
    float m = min(d.x, d.y), aa = fwidth(m) + 1e-4;
    // a seam thinner than a pixel fades instead of flickering on and off as the camera drifts (the far ceiling)
    float cover = min(1.0, 0.016 / aa), bevel = min(1.0, 0.06 / aa);
    tilt = (d.x < d.y ? eu * sign(f.x) : ev * sign(f.y)) * (1.0 - smoothstep(0.0, 0.03, m)) * 0.6 * bevel;
    float tone = 0.9 + 0.2 * fract(sin(dot(floor(q + 0.5), vec2(12.9898, 78.233))) * 43758.5453); // no two plates quite alike
    return vec3((1.0 - smoothstep(0.008, 0.008 + aa, m)) * cover, (1.0 - smoothstep(0.0, 0.08, m)) * bevel, tone);
  }
`

/** The surface maps, loaded once and shared by every hall material. */
function surfaceMaps(textures: string) {
  const tl = new THREE.TextureLoader()
  const tex = (name: string, srgb = false) => {
    const t = tl.load(`${textures}${name}.webp`); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8
    if (srgb) t.colorSpace = THREE.SRGBColorSpace
    return { value: t }
  }
  return {
    wearCol: tex('paintedmetal_color', true), wearNor: tex('paintedmetal_normal'), wearRou: tex('paintedmetal_roughness'),
    plateCol: tex('metalplates_color', true), plateNor: tex('metalplates_normal'), plateRou: tex('metalplates_roughness'),
    floorY: { value: FLOOR + 0.45 },
    plateTint: { value: new THREE.Vector3(5.8, 4.2, 2.2) }, // the texture is a cool dark grey: brightened to bronze
  }
}
export type SurfaceMaps = ReturnType<typeof surfaceMaps>

/** Worn triplanar metal (bronze tread plate where it is floor); `panel` (metres) adds recessed panel seams, `rough` raises the least roughness. */
export function hallMaterial(maps: SurfaceMaps, color = '#c6c3be', o: { metalness?: number; rough?: number; panel?: [number, number] } = {}) {
  const u = { ...maps, panel: { value: new THREE.Vector2(...(o.panel ?? [0, 0])) }, roughBase: { value: o.rough ?? 0.28 } }
  const m = new THREE.MeshStandardMaterial({ color, metalness: o.metalness ?? 0.5, roughness: 1 })
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u)
    sh.vertexShader = 'varying vec3 vTriPos; varying vec3 vTriN;\n' + sh.vertexShader.replace('#include <project_vertex>', TRI_VERT)
    sh.fragmentShader = TRI_COMMON + sh.fragmentShader
      .replace('#include <map_fragment>', `#include <map_fragment>
        float fl = isFloor();
        vec3 tilt; vec3 sm = seams(tilt);
        vec3 wear = tri(wearCol, 0.35).rgb;
        float scuff = dot(wear, vec3(0.2126, 0.7152, 0.0722)); // red paint is dark, the chips are light: a wear mask
        vec3 wall = diffuseColor.rgb * (0.82 + 0.35 * (scuff - 0.12)) * sm.z * (1.0 - 0.6 * sm.x) * (1.0 - 0.15 * sm.y);
        vec3 plate = tri(plateCol, 0.9).rgb * plateTint; // bright bronze tread plate, as in the references
        diffuseColor.rgb = mix(wall, plate, fl);`)
      .replace('#include <roughnessmap_fragment>', `float roughnessFactor = mix(mix(roughBase + 0.38 * tri(wearRou, 0.35).g, 0.9, sm.x), 0.42 + 0.4 * tri(plateRou, 0.9).g, fl); // a broad sheen on the floor, not a hot spot`)
      .replace('#include <metalnessmap_fragment>', `float metalnessFactor = mix(metalness, 0.15, fl);`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        vec3 wn = fl > 0.5 ? triN(plateNor, 0.9, 1.0) : normalize(triN(wearNor, 0.35, 0.6) - tilt);
        normal = normalize((viewMatrix * vec4(wn, 0.0)).xyz);`)
  }
  return m
}

/**
 * Adds the hall's shell, bulkheads, window and light strips at once; the detailed walls arrive with `loaded` (null if
 * they failed). `maps` are the surface maps, for the decor's own worn metal.
 */
export function buildHall(scene: THREE.Scene, loader: GLTFLoader, models: string, textures: string): { maps: SurfaceMaps; loaded: Promise<THREE.Object3D | null> } {
  const h = TOP - FLOOR
  const maps = surfaceMaps(textures)
  const hullMat = new THREE.MeshStandardMaterial({ color: '#4a5058', metalness: 0.3, roughness: 0.8, side: THREE.BackSide })
  // fills the ceiling seam; open at the sides, so the wall openings look out on the stars and Earth's limb as in the
  // reference, and at the front (-z), so the window looks into space
  const open = new THREE.MeshBasicMaterial({ visible: false })
  const hull = new THREE.Mesh(new THREE.BoxGeometry(HALF * 2 + 6, h + 4, LEN * 2 + 3), [open, open, hullMat, hullMat, hullMat, open])
  hull.position.set(0, FLOOR + h / 2, 0); hull.receiveShadow = true; scene.add(hull)
  // a warm mid tone, as in the reference, not a dark slot: worn plates like the ceiling either side of it
  const seam = new THREE.Mesh(new THREE.PlaneGeometry(6, LEN * 2), hallMaterial(maps, '#9c8a78', { metalness: 0.3, rough: 0.5, panel: [1.5, 2.4] }))
  seam.rotation.x = Math.PI / 2; seam.position.set(0, TOP - 0.02, 0); scene.add(seam)
  const capMat = new THREE.MeshStandardMaterial({ color: '#9aa1a8', metalness: 0.55, roughness: 0.4 })
  const glowMat = new THREE.MeshStandardMaterial({ color: '#0b1218', emissive: C.cy, emissiveIntensity: 1.2 })
  const fwd = new THREE.Group(); fwd.position.z = -LEN; scene.add(fwd)
  const side = HALF - WIN.x, top = TOP - WIN.y1, sill = WIN.y0 - FLOOR
  for (const [w, x, y, hh] of [[HALF * 2, 0, TOP - top / 2, top], [HALF * 2, 0, FLOOR + sill / 2, sill], [side, -HALF + side / 2, 0.5, h], [side, HALF - side / 2, 0.5, h]]) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, hh, 0.3), capMat); m.position.set(x, y, 0); shades(m); fwd.add(m)
  }
  // a soft-cornered metal bezel round the window; its rounded inner edge covers the opening's square corners
  const round = (path: THREE.Path, x0: number, y0: number, x1: number, y1: number, r: number) => {
    path.moveTo(x0 + r, y0); path.lineTo(x1 - r, y0); path.quadraticCurveTo(x1, y0, x1, y0 + r); path.lineTo(x1, y1 - r); path.quadraticCurveTo(x1, y1, x1 - r, y1)
    path.lineTo(x0 + r, y1); path.quadraticCurveTo(x0, y1, x0, y1 - r); path.lineTo(x0, y0 + r); path.quadraticCurveTo(x0, y0, x0 + r, y0)
    return path
  }
  const bezelShape = round(new THREE.Shape(), -WIN.x - 0.45, WIN.y0 - 0.4, WIN.x + 0.45, WIN.y1 + 0.4, 0.9) as THREE.Shape
  bezelShape.holes.push(round(new THREE.Path(), -WIN.x + 0.05, WIN.y0 + 0.05, WIN.x - 0.05, WIN.y1 - 0.05, 0.7))
  const bezel = new THREE.Mesh(new THREE.ExtrudeGeometry(bezelShape, { depth: 0.12, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.08, bevelSegments: 4, curveSegments: 16 }),
    new THREE.MeshStandardMaterial({ color: '#c9ccd0', metalness: 0.75, roughness: 0.25 }))
  bezel.position.z = 0.15; shades(bezel); fwd.add(bezel)
  for (const y of [WIN.y0 - 0.25]) { const f = new THREE.Mesh(new THREE.BoxGeometry(WIN.x * 2 - 1, 0.04, 0.04), glowMat); f.position.set(0, y, 0.4); fwd.add(f) }
  // the aft wall faces the window: matte, or it mirrors the window's glare back down the hall
  const aft = new THREE.Mesh(new THREE.BoxGeometry(HALF * 2, h, 0.3), hallMaterial(maps, '#8c9196', { metalness: 0.2, rough: 0.5, panel: [HALF / 4, h / 4] }))
  aft.position.set(0, FLOOR + h / 2, LEN); aft.receiveShadow = true; scene.add(aft)
  // the door in it: two dark leaves in a raised frame, a thin cyan light round the opening as the one accent
  const door = new THREE.Group(); door.position.set(0, FLOOR, LEN - 0.15); scene.add(door)
  const DW = 2.4, DH = 3.2
  const leafMat = hallMaterial(maps, '#4c535b', { metalness: 0.4, rough: 0.45, panel: [DW / 2, DH / 2] })
  const gap = new THREE.Mesh(new THREE.BoxGeometry(DW, DH, 0.02), new THREE.MeshStandardMaterial({ color: '#0b1218', roughness: 0.9 })) // dark behind the split
  gap.position.set(0, DH / 2, -0.01); door.add(gap)
  for (const x of [-1, 1]) { const leaf = new THREE.Mesh(new THREE.BoxGeometry(DW / 2 - 0.02, DH, 0.08), leafMat); leaf.position.set((x * DW) / 4, DH / 2, -0.05); door.add(leaf) }
  for (const [w, hh, x, y] of [[0.3, DH + 0.3, -DW / 2 - 0.15, (DH + 0.3) / 2], [0.3, DH + 0.3, DW / 2 + 0.15, (DH + 0.3) / 2], [DW + 0.6, 0.3, 0, DH + 0.15]]) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, hh, 0.24), capMat); m.position.set(x, y, -0.12); shades(m); door.add(m)
  }
  for (const [w, hh, x, y] of [[0.06, DH, -DW / 2 - 0.05, DH / 2], [0.06, DH, DW / 2 + 0.05, DH / 2], [DW + 0.16, 0.06, 0, DH + 0.03]]) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, hh, 0.03), glowMat); m.position.set(x, y, -0.25); door.add(m)
  }
  const strip = new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: C.cy, emissiveIntensity: 1.1 }) // present but subtle in the sunlit hall
  for (const [x, y] of [[-5.6, FLOOR + 0.08], [5.6, FLOOR + 0.08], [-3, TOP - 0.08], [3, TOP - 0.08]]) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.04, LEN * 2 - 1), strip); b.position.set(x, y, 0); scene.add(b)
  }
  const loaded = loader.loadAsync(`${models}corridor.glb`).then((gltf) => {
    const metal = hallMaterial(maps)
    gltf.scene.traverse((o) => { if ((o as THREE.Mesh).isMesh) { (o as THREE.Mesh).material = metal; shades(o) } })
    // The model is one wall with floor and ceiling, open in front: a mirrored twin closes the hall.
    const pivot = new THREE.Group()
    const wall = gltf.scene; wall.position.set(-6.74, 0, -12.16)
    const twin = wall.clone(); twin.rotation.y = Math.PI; twin.position.set(6.74, 0, 12.16)
    pivot.add(wall, twin)
    pivot.rotation.y = Math.PI / 2; pivot.scale.setScalar(0.35); pivot.position.y = -2.325
    scene.add(pivot)
    return pivot
  }).catch((err) => { console.warn('cabin: corridor.glb failed', err); return null })
  return { maps, loaded }
}
