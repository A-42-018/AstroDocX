import type { Hazard, Status } from '../data/types'
import bodyBinUrl from '../../../landing/universe/targets/body.bin?url'
import rigJson from '../../../landing/universe/targets/body.json'

/**
 * The 3D Health Twin: the same baked human the landing page shows (tools/bake-body.mjs: a real body carved
 * from a turntable video, with skeleton, arteries and organs inside). Per point: position, a normal (skin) or
 * the pulse distance from the heart (arteries, in nrm.x), and a region:
 *   0 skin  1 brain  2 heart  3 lungs  4 gut  5 legs (skin)  6 bone  7 transmitter forearm  8 arteries  9 floor ring
 * Drawn in the twin's 300 x 660 box (centre line x = 150), so the SVG hotspots and the particles share one space.
 */
export interface Body3D { n: number; pos: Float32Array; nrm: Float32Array; reg: Float32Array; heart: [number, number, number]; anchors: Record<Hazard, [number, number, number]> }

/** body units -> twin box: the hands (|x| ~ 1) fit the 300-wide box, feet and floor ring inside 660 */
export const K = 147
export const Y_MID = 330 + ((1.92 - 2.12) / 2) * K                          // the body's mid height (y -0.1) at the box centre
export const toBox = (x: number, y: number): [number, number] => [150 + x * K, Y_MID - y * K]

let loading: Promise<Body3D | null> | null = null
/** Loads once; null where it cannot (no fetch, a test DOM, a bad file): callers keep the SVG twin. */
export function loadBody(): Promise<Body3D | null> {
  if (loading) return loading
  if (typeof fetch === 'undefined' || /jsdom/i.test(navigator.userAgent)) return (loading = Promise.resolve(null))
  const p: Promise<Body3D | null> = fetch(bodyBinUrl)
    .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(String(r.status)))))
    .then((buf): Body3D | null => {
      const n = buf.byteLength / 13
      if (!Number.isInteger(n) || n < 1000) return null
      const dv = new DataView(buf), pos = new Float32Array(n * 3), nrm = new Float32Array(n * 3), reg = new Float32Array(n)
      for (let i = 0; i < n * 3; i++) { pos[i] = dv.getInt16(i * 2, true) / 8192; nrm[i] = dv.getInt16(n * 6 + i * 2, true) / 4096 }
      for (let i = 0; i < n; i++) reg[i] = dv.getUint8(n * 12 + i)
      const at = rigJson.at as [number, number, number][]
      const lung = at[1]
      return {
        n, pos, nrm, reg, heart: rigJson.heart as [number, number, number],
        /* rig order (landing labels): brain, lung, flank, heart, transmitter forearm, leg. Environment points at the
           right-hand lung so its label can sit on the right, as it always has. */
        anchors: { I: at[0], E: [-lung[0], lung[1], lung[2]] as [number, number, number], R: at[2], D: at[4], G: at[5] },
      }
    })
    .catch(() => null)
  return (loading = p)
}

const ST: Record<Status, number> = { nominal: 0, watch: 1, act: 2 }
const HZ: Hazard[] = ['I', 'D', 'E', 'R', 'G']

const VS = `
attribute vec3 aPos; attribute vec3 aNrm; attribute float aReg; attribute float aSeed;
uniform float uAng, uTime, uBeat, uPR, uK, uYMid, uFocus;
uniform float uS0, uS1, uS2, uS3, uS4;
uniform vec3 uHeart;
varying vec3 vC; varying float vA;
vec3 rotY(vec3 p, float a) { float c = cos(a), s = sin(a); return vec3(c * p.x + s * p.z, p.y, -s * p.x + c * p.z); }
void main() {
  int ri = int(aReg + .5);
  vec3 p = aPos;
  float pump = exp(-uBeat * 8.);
  if (ri == 2) p = uHeart + (p - uHeart) * (1. + .2 * pump);                    // the heart beats
  float d = aNrm.x, wave = exp(-pow((uBeat * 2.4 - d) * 4., 2.));               // pulse running out along the arteries
  p = rotY(p, uAng);
  /* hazard this point belongs to: 0 Isolation (brain), 1 Distance (transmitter), 2 Environment (lungs), 3 Radiation (skin), 4 Gravity (legs) */
  float hz = -1.;
  if (ri == 1) hz = 0.; else if (ri == 7) hz = 1.; else if (ri == 3) hz = 2.; else if (ri == 0) hz = 3.; else if (ri == 5 || (ri == 6 && aPos.y < -.45)) hz = 4.;
  float st = hz < -.5 ? 0. : hz < .5 ? uS0 : hz < 1.5 ? uS1 : hz < 2.5 ? uS2 : hz < 3.5 ? uS3 : uS4;
  vec3 c = vec3(.5, .86, 1.); float a = .35, sz = 1.;
  if (ri == 1) { c = vec3(1., .55, .78); a = .55; }
  else if (ri == 2) { c = vec3(1., .2, .27); a = .8 + 1.2 * pump; sz = 1.25; }
  else if (ri == 3) { c = vec3(.55, .85, 1.); a = .3; }
  else if (ri == 4) { c = vec3(.6, .75, .9); a = .16; }
  else if (ri == 6) { c = vec3(.9, .95, 1.); a = .6; }
  else if (ri == 8) { c = mix(vec3(.95, .2, .28), vec3(1., .55, .55), wave); a = .55 + 1.8 * wave; sz = 1. + .6 * wave; }
  else if (ri == 9) { c = vec3(.45, .85, 1.); a = .3; }
  if (ri == 0 || ri == 5 || ri == 7) {                                          // skin: bright at the silhouette, faint facing us
    vec3 n = rotY(aNrm, uAng); float rim = 1. - abs(n.z);
    a = .07 + .55 * pow(rim, 2.);
  }
  if (st > .5) {                                                               // a hazard that needs attention colours its part
    vec3 sc = st > 1.5 ? vec3(1., .35, .43) : vec3(1., .77, .24);
    c = mix(c, sc, ri == 0 ? .65 : .9); a *= (ri == 0 ? 1.4 : 1.9) * (.85 + .15 * sin(uTime * 3.2));
  }
  if (hz > -.5 && abs(hz - uFocus) < .5) { a *= 1.9; sz *= 1.2; }
  a *= .65 + .35 * aSeed;
  vC = c; vA = a;
  vec2 box = vec2(150. + p.x * uK, uYMid - p.y * uK);
  gl_Position = vec4(box.x / 150. - 1., 1. - box.y / 330., 0., 1.);
  gl_PointSize = (1.1 + aSeed * 1.1) * sz * uPR;
}`
const FS = `
precision mediump float; varying vec3 vC; varying float vA;
void main() { vec2 d = gl_PointCoord - .5; float r = dot(d, d) * 4.; float a = exp(-r * 4.) * vA; gl_FragColor = vec4(vC * a, a); }`

export interface TwinRenderer { draw(t: number, ang: number, beatAge: number, focus: number): void; resize(): void; setStatus(s: Partial<Record<Hazard, Status>>): void; dispose(): void }

/** WebGL point renderer for the twin canvas. Throws when WebGL is missing (the caller keeps the SVG twin). */
export function twinRenderer(canvas: HTMLCanvasElement, body: Body3D): TwinRenderer {
  const gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: false, depth: false })
  if (!gl) throw new Error('no webgl')
  const sh = (type: number, src: string) => { const s = gl.createShader(type)!; gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? 'shader'); return s }
  const prog = gl.createProgram()!
  gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(prog)
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog) ?? 'link')
  gl.useProgram(prog)
  const seed = new Float32Array(body.n); for (let i = 0; i < body.n; i++) seed[i] = ((i * 2654435761) % 1000) / 1000
  const attr = (name: string, data: Float32Array, size: number) => {
    const loc = gl.getAttribLocation(prog, name); if (loc < 0) return
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer()); gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW)
    gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0)
  }
  attr('aPos', body.pos, 3); attr('aNrm', body.nrm, 3); attr('aReg', body.reg, 1); attr('aSeed', seed, 1)
  const U = (n: string) => gl.getUniformLocation(prog, n)
  const uAng = U('uAng'), uTime = U('uTime'), uBeat = U('uBeat'), uPR = U('uPR'), uFocus = U('uFocus')
  gl.uniform1f(U('uK'), K); gl.uniform1f(U('uYMid'), Y_MID); gl.uniform3fv(U('uHeart'), body.heart)
  gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE)
  let pr = 1
  return {
    resize() {
      pr = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = Math.max(1, Math.round(canvas.clientWidth * pr)); canvas.height = Math.max(1, Math.round(canvas.clientHeight * pr))
      gl.viewport(0, 0, canvas.width, canvas.height)
      gl.uniform1f(uPR, pr * Math.min(1.4, canvas.clientWidth / 200))
    },
    setStatus(s) { HZ.forEach((h, i) => gl.uniform1f(U('uS' + i), ST[s[h] ?? 'nominal'])) },
    draw(t, ang, beatAge, focus) {
      gl.uniform1f(uTime, t); gl.uniform1f(uAng, ang); gl.uniform1f(uBeat, beatAge); gl.uniform1f(uFocus, focus)
      gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT)
      gl.drawArrays(gl.POINTS, 0, body.n)
    },
    dispose() { gl.getExtension('WEBGL_lose_context')?.loseContext() },
  }
}
export const HAZARD_INDEX: Record<Hazard, number> = { I: 0, D: 1, E: 2, R: 3, G: 4 }

/** Static front view for small figures: skin and bones as points on a 2D canvas, in the status colour. */
export function drawMiniBody(canvas: HTMLCanvasElement, body: Body3D, color: string) {
  const ctx = canvas.getContext('2d'); if (!ctx) return
  const pr = Math.min(window.devicePixelRatio || 1, 2), w = canvas.clientWidth, h = canvas.clientHeight
  canvas.width = Math.round(w * pr); canvas.height = Math.round(h * pr)
  ctx.setTransform(pr * w / 300, 0, 0, pr * h / 660, 0, 0)
  ctx.clearRect(0, 0, 300, 660); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = color
  for (let i = 0; i < body.n; i++) {
    const g = body.reg[i]; if (g === 9 || g === 4) continue
    const skin = g === 0 || g === 5 || g === 7, rim = skin ? 1 - Math.abs(body.nrm[i * 3 + 2]) : 0
    if (skin && rim < 0.35 && i % 3) continue                                   // the face-on skin is mostly empty: an outline reads at this size
    ctx.globalAlpha = skin ? 0.18 + 0.5 * rim * rim : 0.22
    const [x, y] = toBox(body.pos[i * 3], body.pos[i * 3 + 1])
    ctx.fillRect(x - 2, y - 2, 4, 4)
  }
}
