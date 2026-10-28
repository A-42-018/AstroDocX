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

/*
 * Surfaces: the model has no textures, so ambientCG maps (CC0) are projected in world space (triplanar).
 * Walls and ceiling: light grey with PaintedMetal004's scratches and scuffs as wear (its red is not used).
 * Floor: MetalPlates006 tread plate, tinted the bronze of the golden reference's floor.
 */
const TRI_VERT = /* glsl */ `
  #include <project_vertex>
  vTriPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
  vTriN = normalize(mat3(modelMatrix) * objectNormal);
`
const TRI_COMMON = /* glsl */ `
  uniform sampler2D wearCol; uniform sampler2D wearNor; uniform sampler2D wearRou;
  uniform sampler2D plateCol; uniform sampler2D plateNor; uniform sampler2D plateRou;
  uniform float floorY; uniform vec3 plateTint;
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
`

function hallMaterial(textures: string) {
  const tl = new THREE.TextureLoader()
  const tex = (name: string, srgb = false) => {
    const t = tl.load(`${textures}${name}.webp`); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8
    if (srgb) t.colorSpace = THREE.SRGBColorSpace
    return t
  }
  const u = {
    wearCol: { value: tex('paintedmetal_color', true) }, wearNor: { value: tex('paintedmetal_normal') }, wearRou: { value: tex('paintedmetal_roughness') },
    plateCol: { value: tex('metalplates_color', true) }, plateNor: { value: tex('metalplates_normal') }, plateRou: { value: tex('metalplates_roughness') },
    floorY: { value: FLOOR + 0.45 },
    plateTint: { value: new THREE.Vector3(5.4, 4.4, 2.8) }, // the texture is a cool dark grey: brightened to bronze
  }
  const m = new THREE.MeshStandardMaterial({ color: '#c6c3be', metalness: 0.5, roughness: 1 })
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u)
    sh.vertexShader = 'varying vec3 vTriPos; varying vec3 vTriN;\n' + sh.vertexShader.replace('#include <project_vertex>', TRI_VERT)
    sh.fragmentShader = TRI_COMMON + sh.fragmentShader
      .replace('#include <map_fragment>', `#include <map_fragment>
        float fl = isFloor();
        vec3 wear = tri(wearCol, 0.35).rgb;
        float scuff = dot(wear, vec3(0.2126, 0.7152, 0.0722)); // red paint is dark, the chips are light: a wear mask
        vec3 wall = diffuseColor.rgb * (0.82 + 0.35 * (scuff - 0.12));
        vec3 plate = tri(plateCol, 0.9).rgb * plateTint; // bright bronze tread plate, as in the references
        diffuseColor.rgb = mix(wall, plate, fl);`)
      .replace('#include <roughnessmap_fragment>', `float roughnessFactor = mix(0.28 + 0.38 * tri(wearRou, 0.35).g, 0.42 + 0.4 * tri(plateRou, 0.9).g, fl); // a broad sheen on the floor, not a hot spot`)
      .replace('#include <metalnessmap_fragment>', `float metalnessFactor = mix(metalness, 0.15, fl);`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        vec3 wn = fl > 0.5 ? triN(plateNor, 0.9, 1.0) : triN(wearNor, 0.35, 0.6);
        normal = normalize((viewMatrix * vec4(wn, 0.0)).xyz);`)
  }
  return m
}

/** Adds the hall's shell, bulkheads, window and light strips at once; the detailed walls arrive with the returned promise (null if they failed). */
export function buildHall(scene: THREE.Scene, loader: GLTFLoader, models: string, textures: string): Promise<THREE.Object3D | null> {
  const h = TOP - FLOOR
  const hullMat = new THREE.MeshStandardMaterial({ color: '#4a5058', metalness: 0.3, roughness: 0.8, side: THREE.BackSide })
  // fills the ceiling seam; open at the sides, so the wall openings look out on the stars and Earth's limb as in the
  // reference, and at the front (-z), so the window looks into space
  const open = new THREE.MeshBasicMaterial({ visible: false })
  const hull = new THREE.Mesh(new THREE.BoxGeometry(HALF * 2 + 6, h + 4, LEN * 2 + 3), [open, open, hullMat, hullMat, hullMat, open])
  hull.position.set(0, FLOOR + h / 2, 0); hull.receiveShadow = true; scene.add(hull)
  const seam = new THREE.Mesh(new THREE.PlaneGeometry(6, LEN * 2), new THREE.MeshStandardMaterial({ color: '#908a82', metalness: 0.3, roughness: 0.6 })) // a warm mid tone, as in the reference, not a dark slot
  seam.rotation.x = Math.PI / 2; seam.position.set(0, TOP - 0.02, 0); scene.add(seam)
  const capMat = new THREE.MeshStandardMaterial({ color: '#9aa1a8', metalness: 0.55, roughness: 0.4 })
  const glowMat = new THREE.MeshStandardMaterial({ color: '#0b1218', emissive: C.cy, emissiveIntensity: 1.2 })
  const fwd = new THREE.Group(); fwd.position.z = -LEN; scene.add(fwd)
  const side = HALF - WIN.x, top = TOP - WIN.y1, sill = WIN.y0 - FLOOR
  for (const [w, x, y, hh] of [[HALF * 2, 0, TOP - top / 2, top], [HALF * 2, 0, FLOOR + sill / 2, sill], [side, -HALF + side / 2, 0.5, h], [side, HALF - side / 2, 0.5, h]]) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, hh, 0.3), capMat); m.position.set(x, y, 0); m.castShadow = m.receiveShadow = true; fwd.add(m)
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
  bezel.position.z = 0.15; bezel.castShadow = bezel.receiveShadow = true; fwd.add(bezel)
  for (const y of [WIN.y0 - 0.25]) { const f = new THREE.Mesh(new THREE.BoxGeometry(WIN.x * 2 - 1, 0.04, 0.04), glowMat); f.position.set(0, y, 0.4); fwd.add(f) }
  // the aft wall faces the window: matte, or it mirrors the window's glare back down the hall
  const aft = new THREE.Mesh(new THREE.BoxGeometry(HALF * 2, h, 0.3), new THREE.MeshStandardMaterial({ color: '#8c9196', metalness: 0.2, roughness: 0.75 })); aft.position.set(0, FLOOR + h / 2, LEN); aft.receiveShadow = true; scene.add(aft)
  const door = new THREE.Mesh(new THREE.BoxGeometry(2.4, 3.2, 0.05), glowMat); door.position.set(0, -0.9, LEN - 0.17); scene.add(door)
  const strip = new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: C.cy, emissiveIntensity: 1.1 }) // present but subtle in the sunlit hall
  for (const [x, y] of [[-5.6, FLOOR + 0.08], [5.6, FLOOR + 0.08], [-3, TOP - 0.08], [3, TOP - 0.08]]) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.04, LEN * 2 - 1), strip); b.position.set(x, y, 0); scene.add(b)
  }
  return loader.loadAsync(`${models}corridor.glb`).then((gltf) => {
    const metal = hallMaterial(textures)
    gltf.scene.traverse((o) => { if ((o as THREE.Mesh).isMesh) Object.assign(o, { material: metal, castShadow: true, receiveShadow: true }) })
    // The model is one wall with floor and ceiling, open in front: a mirrored twin closes the hall.
    const pivot = new THREE.Group()
    const wall = gltf.scene; wall.position.set(-6.74, 0, -12.16)
    const twin = wall.clone(); twin.rotation.y = Math.PI; twin.position.set(6.74, 0, 12.16)
    pivot.add(wall, twin)
    pivot.rotation.y = Math.PI / 2; pivot.scale.setScalar(0.35); pivot.position.y = -2.325
    scene.add(pivot)
    return pivot
  }).catch((err) => { console.warn('cabin: corridor.glb failed', err); return null })
}
