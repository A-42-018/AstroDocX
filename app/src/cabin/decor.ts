import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import type { CabinCrew, CabinData } from './data'
import { glowTexture, mulberry } from './earth'
import { FLOOR, LEN, SUN_LAYER, TOP, hallMaterial, type SurfaceMaps } from './hall'
import type { Quality } from './lighting'
import { C, ecg, statusColor, statusLabel } from './panels'
import { wallMap, type WallMap } from './wall'

/*
 * What makes the hall a lived-in station rather than a set, after photos of the ISS: cargo transfer bags packed into
 * the wall bays under bungees, handrails, cable runs, ceiling light panels, location stickers, a hatch with its
 * placards and safety kit on the aft wall, laptops on arms, the Veggie plant chamber's magenta glow, a galley table and
 * a few loose things drifting. Everything is built here (no downloads) and placed against the real shape of the walls
 * (wall.ts), clear of the screens, the crew and the camera's path. Most of it is a handful of instanced meshes.
 */

export interface DecorOptions {
  quality: Quality
  reduced: boolean
  /** The wall screens (centre and side) and their size, kept clear. */
  screens: { pos: THREE.Vector3; side: -1 | 1 }[]
  screenSize: [number, number]
  /** Where the crew float, kept clear. */
  crew: THREE.Vector3[]
  /** Points along the camera's tour, kept clear. */
  path: THREE.Vector3[]
  /** The room the consoles take (consoles.ts), kept clear. */
  props: THREE.Box3[]
  /** The walls' depth maps when already made (the tour's framing reads them too); else mapped here. */
  walls?: Record<-1 | 1, WallMap> | null
}

const MONO = "'JetBrains Mono', ui-monospace, 'SF Mono', Menlo, monospace"
const UI = "'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif"
type G = CanvasRenderingContext2D
type V3 = [number, number, number]
const UP = new THREE.Vector3(0, 1, 0)

/** A rotation whose +z is `n` and whose +x runs level (along a wall), so text and bag fronts stand upright. */
function facing(n: THREE.Vector3, roll = 0) {
  const z = n.clone().normalize(), x = new THREE.Vector3().crossVectors(UP, z)
  if (x.lengthSq() < 1e-6) x.set(1, 0, 0)
  x.normalize()
  const q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, new THREE.Vector3().crossVectors(z, x), z))
  return roll ? q.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), roll)) : q
}
const v = (a: V3) => new THREE.Vector3(...a)

/* ---------- the sticker sheet: every label, placard, patch and photo on one canvas ---------- */

interface Rect { u: number; v: number; w: number; h: number; aspect: number }
function atlas(scale: number) {
  const S = 2048, c = document.createElement('canvas'); c.width = c.height = S * scale
  const g = c.getContext('2d')!
  g.scale(scale, scale)
  const rects = new Map<string, Rect>()
  let x = 2, y = 2, rowH = 0
  return {
    canvas: c, rects,
    add(key: string, w: number, h: number, draw: (g: G, w: number, h: number) => void) {
      if (x + w > S) { x = 2; y += rowH + 6; rowH = 0 }
      g.save(); g.translate(x, y); g.beginPath(); g.rect(0, 0, w, h); g.clip(); draw(g, w, h); g.restore()
      // inset half a pixel so mipmaps don't bleed the neighbours in
      rects.set(key, { u: (x + 1) / S, v: 1 - (y + h - 1) / S, w: (w - 2) / S, h: (h - 2) / S, aspect: w / h })
      x += w + 6; rowH = Math.max(rowH, h)
    },
  }
}
function noise(g: G, w: number, h: number, n: number, a: number, r = mulberry(w * 31 + h)) {
  for (let i = 0; i < n; i++) { g.fillStyle = r() > 0.5 ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`; g.fillRect(r() * w, r() * h, 1 + r() * 2, 1 + r() * 2) }
}
function barcode(g: G, x: number, y: number, w: number, h: number, seed: number) {
  const r = mulberry(seed); g.fillStyle = '#111'
  for (let p = x; p < x + w;) { const b = 1 + Math.floor(r() * 3); if (r() > 0.4) g.fillRect(p, y, b, h); p += b + 1 }
}
const BAGS = [
  ['CTB 1.0', 'MEDICAL · AMP'], ['CTB 1.0', 'FOOD · BOB'], ['CTB 0.5', 'CREW PREF · CMDR'], ['CTB 1.0', 'SPARE FILTERS'],
  ['CTB 1.0', 'HYGIENE · WIPES'], ['CTB 2.0', 'EXERCISE · CEVIS'], ['CTB 0.5', 'CLOTHING · 03'], ['CTB 1.0', 'IV SUPPLIES'],
  ['M-02', 'TRASH · WET'], ['CTB 1.0', 'PAYLOAD · SAMPLES'], ['CTB 0.5', 'TOOLS · IVA'], ['CTB 1.0', 'BATTERIES · LI-ION'],
]
function drawSheet(scale: number) {
  const a = atlas(scale)
  BAGS.forEach(([kind, what], i) => a.add(`bag${i}`, 240, 112, (g, w, h) => {
    g.fillStyle = what.startsWith('TRASH') ? '#f2d24a' : '#f3f1ea'; g.fillRect(0, 0, w, h)
    g.strokeStyle = '#222'; g.lineWidth = 3; g.strokeRect(4, 4, w - 8, h - 8)
    g.fillStyle = '#111'; g.font = `800 26px ${MONO}`; g.fillText(kind, 14, 34)
    g.font = `600 17px ${MONO}`; g.fillText(what, 14, 60)
    barcode(g, 14, 70, 150, 28, i + 7); g.font = `500 12px ${MONO}`; g.fillText(`0${4100 + i * 37}J`, 172, 96)
  }))
  // location stickers, as on the ISS: module, port/starboard/overhead/deck, bay
  const codes = [...[1, 2, 3, 4, 5, 6].map((n) => `LAB1P${n}`), ...[1, 2, 3, 4, 5, 6].map((n) => `LAB1S${n}`), ...[1, 2, 3, 4, 5].map((n) => `LAB1O${n}`), ...[1, 2, 3, 4].map((n) => `LAB1D${n}`), 'LAB1A1']
  for (const code of codes) a.add(code, 220, 64, (g, w, h) => {
    g.fillStyle = '#e9ebe6'; g.fillRect(0, 0, w, h); g.fillStyle = '#16191c'; g.font = `800 38px ${MONO}`; g.textAlign = 'center'; g.fillText(code, w / 2, 46)
  })
  a.add('node', 512, 124, (g, w, h) => {
    g.fillStyle = '#1b2a3a'; g.fillRect(0, 0, w, h); g.strokeStyle = '#e9ebe6'; g.lineWidth = 4; g.strokeRect(8, 8, w - 16, h - 16)
    g.fillStyle = '#f3f1ea'; g.font = `800 46px ${UI}`; g.textAlign = 'center'; g.fillText('NODE 1 · AFT HATCH', w / 2, 66)
    g.font = `600 22px ${MONO}`; g.fillStyle = C.cyHi; g.fillText('ASTRODOCX MED BAY  ▸  UNITY', w / 2, 100)
  })
  a.add('caution', 256, 112, (g, w, h) => {
    g.fillStyle = '#f2c230'; g.fillRect(0, 0, w, h); g.fillStyle = '#111'; g.fillRect(6, 6, w - 12, 30)
    g.fillStyle = '#f2c230'; g.font = `800 22px ${UI}`; g.textAlign = 'center'; g.fillText('CAUTION', w / 2, 29)
    g.fillStyle = '#111'; g.font = `700 18px ${UI}`; g.fillText('KEEP HATCH', w / 2, 66); g.fillText('AREA CLEAR', w / 2, 92)
  })
  a.add('egress', 220, 90, (g, w, h) => {
    g.fillStyle = '#1f8a4c'; g.fillRect(0, 0, w, h); g.fillStyle = '#fff'; g.font = `800 34px ${UI}`; g.fillText('EGRESS', 16, 58)
    g.beginPath(); g.moveTo(178, 26); g.lineTo(206, 45); g.lineTo(178, 64); g.closePath(); g.fill()
  })
  a.add('pfe', 200, 100, (g, w, h) => {
    g.fillStyle = '#c8202c'; g.fillRect(0, 0, w, h); g.fillStyle = '#fff'; g.font = `900 46px ${UI}`; g.textAlign = 'center'; g.fillText('PFE', w / 2, 56)
    g.font = `700 14px ${UI}`; g.fillText('PORTABLE FIRE EXT.', w / 2, 84)
  })
  a.add('pba', 200, 100, (g, w, h) => {
    g.fillStyle = '#c8202c'; g.fillRect(0, 0, w, h); g.fillStyle = '#fff'; g.font = `900 46px ${UI}`; g.textAlign = 'center'; g.fillText('PBA', w / 2, 56)
    g.font = `700 13px ${UI}`; g.fillText('PORTABLE BREATHING', w / 2, 84)
  })
  a.add('fireport', 128, 128, (g) => {
    g.fillStyle = '#fff'; g.beginPath(); g.arc(64, 64, 62, 0, Math.PI * 2); g.fill()
    g.strokeStyle = '#c8202c'; g.lineWidth = 12; g.beginPath(); g.arc(64, 64, 50, 0, Math.PI * 2); g.stroke()
    g.fillStyle = '#111'; g.beginPath(); g.arc(64, 64, 14, 0, Math.PI * 2); g.fill()
    g.fillStyle = '#c8202c'; g.font = `800 13px ${UI}`; g.textAlign = 'center'; g.fillText('FIRE PORT', 64, 104)
  })
  a.add('hazard', 1024, 48, (g, w, h) => {
    g.fillStyle = '#f2c230'; g.fillRect(0, 0, w, h); g.fillStyle = '#141414'
    for (let x = -h; x < w; x += 48) { g.beginPath(); g.moveTo(x, h); g.lineTo(x + 24, h); g.lineTo(x + 24 + h, 0); g.lineTo(x + h, 0); g.closePath(); g.fill() }
  })
  const patch = (key: string, ring: string, fill: string, top: string, bottom: string, art: (g: G) => void) => a.add(key, 256, 256, (g) => {
    g.fillStyle = ring; g.beginPath(); g.arc(128, 128, 126, 0, Math.PI * 2); g.fill()
    g.fillStyle = fill; g.beginPath(); g.arc(128, 128, 98, 0, Math.PI * 2); g.fill()
    art(g)
    g.fillStyle = '#f6efd8'; g.font = `800 19px ${UI}`; g.textAlign = 'center'
    const arc = (text: string, r: number, mid: number, dir: 1 | -1) => {
      const span = text.length * 0.115
      ;[...text].forEach((ch, i) => {
        const ang = mid + dir * (i - (text.length - 1) / 2) * (span / text.length)
        g.save(); g.translate(128 + Math.cos(ang) * r, 128 + Math.sin(ang) * r); g.rotate(ang + (dir > 0 ? Math.PI / 2 : -Math.PI / 2)); g.fillText(ch, 0, 6); g.restore()
      })
    }
    arc(top, 111, -Math.PI / 2, 1); arc(bottom, 111, Math.PI / 2, -1)
  })
  patch('patch0', '#c9a24a', '#0d2340', 'ASTRODOCX', 'CREW HEALTH', (g) => {
    const gr = g.createRadialGradient(100, 150, 4, 110, 160, 90); gr.addColorStop(0, '#5fb4ff'); gr.addColorStop(1, '#123a6b')
    g.fillStyle = gr; g.beginPath(); g.arc(128, 190, 80, Math.PI, 0); g.fill()
    g.strokeStyle = '#f6efd8'; g.lineWidth = 4; g.beginPath(); g.ellipse(128, 120, 70, 24, -0.3, 0, Math.PI * 2); g.stroke()
    g.fillStyle = C.cy; g.font = `800 52px ${UI}`; g.textAlign = 'center'; g.fillText('X', 128, 134)
    g.fillStyle = '#ffd36e'; g.beginPath(); g.arc(176, 84, 9, 0, Math.PI * 2); g.fill()
  })
  patch('patch1', '#e9ebe6', '#3a1530', 'SPACE APPS', '2026', (g) => {
    g.strokeStyle = '#ff9ad0'; g.lineWidth = 6; g.beginPath(); g.moveTo(70, 160); g.lineTo(128, 70); g.lineTo(186, 160); g.stroke()
    g.fillStyle = '#ffd36e'; for (const [x, y] of [[96, 110], [160, 104], [128, 150]]) { g.beginPath(); g.arc(x, y, 6, 0, Math.PI * 2); g.fill() }
  })
  patch('patch2', '#8a2b2b', '#10161f', 'EXPEDITION', 'ONE', (g) => {
    g.fillStyle = '#d9dde3'; g.font = `900 92px ${UI}`; g.textAlign = 'center'; g.fillText('I', 128, 160)
    g.strokeStyle = '#c9a24a'; g.lineWidth = 3; g.beginPath(); g.arc(128, 128, 60, 0, Math.PI * 2); g.stroke()
  })
  a.add('vent', 160, 160, (g) => {
    g.fillStyle = '#b9bdc1'; g.beginPath(); g.arc(80, 80, 78, 0, Math.PI * 2); g.fill()
    for (let r = 66; r > 10; r -= 10) { g.strokeStyle = '#2a2e33'; g.lineWidth = 4; g.beginPath(); g.arc(80, 80, r, 0, Math.PI * 2); g.stroke() }
    g.fillStyle = '#8d9297'; g.beginPath(); g.arc(80, 80, 10, 0, Math.PI * 2); g.fill()
  })
  a.add('velcro', 96, 48, (g, w, h) => { g.fillStyle = '#2b2d30'; g.fillRect(0, 0, w, h); noise(g, w, h, 500, 0.25) })
  a.add('checklist', 180, 250, (g, w, h) => {
    g.fillStyle = '#f4f2ec'; g.fillRect(0, 0, w, h); g.fillStyle = '#1b2a3a'; g.fillRect(0, 0, w, 34)
    g.fillStyle = '#fff'; g.font = `800 15px ${MONO}`; g.fillText('DAILY CHECK-IN', 12, 23)
    g.fillStyle = '#222'; g.font = `600 13px ${MONO}`
    ;['HR / HRV', 'SpO2', 'SLEEP LOG', 'DOSE BADGE', 'MOOD', 'EXERCISE'].forEach((t, i) => {
      g.strokeStyle = '#222'; g.lineWidth = 2; g.strokeRect(12, 52 + i * 31, 14, 14); if (i < 3) g.fillText('✓', 13, 64 + i * 31)
      g.fillText(t, 36, 64 + i * 31)
    })
  })
  const photo = (key: string, art: (g: G, w: number, h: number) => void) => a.add(key, 170, 210, (g, w, h) => {
    g.fillStyle = '#f6f4ee'; g.fillRect(0, 0, w, h); g.save(); g.beginPath(); g.rect(10, 10, w - 20, h - 50); g.clip(); g.translate(10, 10); art(g, w - 20, h - 50); g.restore()
  })
  photo('photo0', (g, w, h) => { // Earth's limb from orbit
    g.fillStyle = '#02040a'; g.fillRect(0, 0, w, h)
    const gr = g.createRadialGradient(w / 2, h * 1.6, h * 0.9, w / 2, h * 1.6, h * 1.25); gr.addColorStop(0, '#1d6fd1'); gr.addColorStop(0.92, '#8fd0ff'); gr.addColorStop(1, 'rgba(143,208,255,0)')
    g.fillStyle = gr; g.fillRect(0, 0, w, h); g.fillStyle = 'rgba(255,255,255,0.55)'; for (let i = 0; i < 8; i++) g.fillRect(10 + i * 18, h * 0.82 + Math.sin(i) * 6, 14, 3)
  })
  photo('photo1', (g, w, h) => { // a family at home
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#f6c98a'); gr.addColorStop(1, '#6b8f5a'); g.fillStyle = gr; g.fillRect(0, 0, w, h)
    g.fillStyle = '#2b2f3a'; for (const [x, s] of [[45, 1], [80, 0.8], [112, 0.6]]) { g.beginPath(); g.arc(x, h - 70 * s, 12 * s, 0, Math.PI * 2); g.fill(); g.fillRect(x - 13 * s, h - 56 * s, 26 * s, 56 * s) }
  })
  photo('photo2', (g, w, h) => { // a launch
    g.fillStyle = '#7fb2e0'; g.fillRect(0, 0, w, h); g.fillStyle = '#f2f2f2'; g.fillRect(w / 2 - 6, 20, 12, 70)
    const gr = g.createRadialGradient(w / 2, 100, 2, w / 2, 110, 60); gr.addColorStop(0, '#fff6c0'); gr.addColorStop(0.3, '#ff9a3a'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 60, w, h)
  })
  a.add('leaf', 128, 128, (g) => { // a lettuce rosette, seen side on
    const r = mulberry(3)
    for (let i = 0; i < 9; i++) {
      const ang = -Math.PI / 2 + (i - 4) * 0.28
      g.fillStyle = ['#4f9a3a', '#6cb84a', '#3d7f2e'][i % 3]
      g.save(); g.translate(64, 122); g.rotate(ang + Math.PI / 2); g.beginPath(); g.ellipse(0, -48 - r() * 10, 16 + r() * 6, 46, 0, 0, Math.PI * 2); g.fill(); g.restore()
    }
  })
  const tex = new THREE.CanvasTexture(a.canvas); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8
  return { tex, rects: a.rects }
}

/** Off-white Nomex: a fine weave, stitched seams round every face and two webbing straps. */
function fabricTexture() {
  const S = 256, c = document.createElement('canvas'); c.width = c.height = S
  const g = c.getContext('2d')!
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, S, S)
  g.globalAlpha = 0.06; g.fillStyle = '#000'
  for (let i = 0; i < S; i += 3) { g.fillRect(i, 0, 1, S); g.fillRect(0, i, S, 1) }
  g.globalAlpha = 1; noise(g, S, S, 1500, 0.05)
  g.fillStyle = 'rgba(0,0,0,0.14)'; for (const x of [70, 170]) g.fillRect(x, 0, 18, S)
  g.strokeStyle = 'rgba(0,0,0,0.35)'; g.setLineDash([5, 4]); g.lineWidth = 1.5; g.strokeRect(10, 10, S - 20, S - 20)
  g.setLineDash([]); g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(0, 0, S, 4); g.fillRect(0, S - 4, S, 4); g.fillRect(0, 0, 4, S); g.fillRect(S - 4, 0, 4, S)
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4
  return t
}

/* ---------- the live bits: laptop screens and the crew board ---------- */

function drawLaptop(g: G, w: number, h: number, m: CabinCrew | undefined, t: number, n: number) {
  g.fillStyle = '#06111a'; g.fillRect(0, 0, w, h)
  g.fillStyle = '#0d2233'; g.fillRect(0, 0, w, 34)
  g.fillStyle = C.cy; g.font = `700 16px ${MONO}`; g.fillText(`SSC-${n} · ASTRODOCX`, 12, 23)
  if (!m) return
  const col = statusColor(m.status)
  g.fillStyle = C.t1; g.font = `700 26px ${UI}`; g.fillText(m.name, 14, 72)
  g.fillStyle = col; g.font = `700 15px ${MONO}`; g.textAlign = 'right'; g.fillText(statusLabel(m.status), w - 14, 70); g.textAlign = 'left'
  // the ECG scrolls at the crew member's live heart rate
  const beat = 60 / Math.max(40, m.live.hr), x0 = 14, x1 = w - 14, y0 = 150
  g.strokeStyle = C.ok; g.lineWidth = 2.5; g.beginPath()
  for (let x = x0; x <= x1; x += 2) {
    const tt = t - (x1 - x) / 160, y = y0 - ecg(((tt % beat) + beat) % beat / beat) * 46
    if (x === x0) g.moveTo(x, y); else g.lineTo(x, y)
  }
  g.stroke()
  g.fillStyle = C.t3; g.font = `600 14px ${MONO}`; g.fillText('HR', 14, 214); g.fillText('SpO2', 180, 214); g.fillText('RESP', 330, 214)
  g.fillStyle = C.t1; g.font = `700 38px ${UI}`
  g.fillText(m.live.hr.toFixed(0), 14, 256); g.fillText(m.live.spo2.toFixed(1), 180, 256); g.fillText(m.live.resp.toFixed(0), 330, 256)
  g.fillStyle = 'rgba(54,226,245,0.5)'; g.fillRect(14, h - 26, ((t * 0.07) % 1) * (w - 28), 4)
}

function drawBoard(g: G, w: number, h: number, d: CabinData) {
  g.fillStyle = '#d6d8d3'; g.fillRect(0, 0, w, h); noise(g, w, h, 4000, 0.05)
  g.fillStyle = '#1b2a3a'; g.fillRect(0, 0, w, 64)
  g.fillStyle = '#f3f1ea'; g.font = `800 34px ${UI}`; g.fillText('CREW BOARD', 26, 44)
  g.fillStyle = C.cyHi; g.font = `600 20px ${MONO}`; g.textAlign = 'right'; g.fillText(`${d.crew.length} ABOARD · ${d.link.pending} TO SYNC`, w - 26, 42); g.textAlign = 'left'
  d.crew.slice(0, 6).forEach((m, i) => {
    const y = 96 + i * 82, col = statusColor(m.status)
    g.fillStyle = '#f4f2ec'; g.fillRect(24, y, 600, 70)
    g.fillStyle = col; g.fillRect(24, y, 8, 70)
    g.fillStyle = '#26394d'; g.beginPath(); g.arc(78, y + 35, 25, 0, Math.PI * 2); g.fill()
    g.fillStyle = '#fff'; g.font = `800 20px ${UI}`; g.textAlign = 'center'; g.fillText(m.name.slice(0, 2).toUpperCase(), 78, y + 42); g.textAlign = 'left'
    g.fillStyle = '#16191c'; g.font = `700 25px ${UI}`; g.fillText(m.name, 118, y + 32)
    g.fillStyle = '#4a5560'; g.font = `600 17px ${MONO}`; g.fillText(m.role.toUpperCase(), 118, y + 56)
    g.fillStyle = col; g.font = `800 18px ${MONO}`; g.textAlign = 'right'; g.fillText(`${statusLabel(m.status)} · ${Math.round(m.readiness)}`, 610, y + 44); g.textAlign = 'left'
  })
  // a polaroid and today's plan stuck up beside the roster
  g.save(); g.translate(700, 100); g.rotate(0.05)
  g.fillStyle = '#f6f4ee'; g.fillRect(0, 0, 270, 230); const gr = g.createLinearGradient(0, 0, 0, 180); gr.addColorStop(0, '#02040a'); gr.addColorStop(0.7, '#1d6fd1'); gr.addColorStop(1, '#8fd0ff')
  g.fillStyle = gr; g.fillRect(14, 14, 242, 160); g.fillStyle = '#333'; g.font = `600 18px ${UI}`; g.fillText('first sunrise up here', 22, 208); g.restore()
  g.fillStyle = '#16191c'; g.font = `800 24px ${UI}`; g.fillText('TODAY', 700, 384)
  g.font = `600 19px ${MONO}`
  ;[['DAILY CHECK-IN', true], ['EXERCISE 2.5 H', false], ['GROUND LINK SYNC', d.link.pending === 0], ['WATER RECOVERY', false]].forEach(([t, done], i) => {
    g.strokeStyle = '#16191c'; g.lineWidth = 2; g.strokeRect(700, 404 + i * 40, 18, 18); if (done) g.fillText('✓', 702, 420 + i * 40)
    g.fillText(String(t), 730, 420 + i * 40)
  })
}

/* ---------- the decor ---------- */

export function addDecor(scene: THREE.Scene, renderer: THREE.WebGLRenderer, maps: SurfaceMaps, o: DecorOptions) {
  const rand = mulberry(29), pick = <T,>(xs: readonly T[]) => xs[Math.floor(rand() * xs.length)]
  const low = o.quality === 'low', root = new THREE.Group(); root.name = 'decor'; scene.add(root)
  const box = { y0: FLOOR + 0.12, y1: TOP - 0.15, z0: -LEN + 0.2, z1: LEN - 0.2 }
  const walls: Record<-1 | 1, WallMap> = o.walls ?? { [-1]: wallMap(renderer, scene, -1, SUN_LAYER, box), [1]: wallMap(renderer, scene, 1, SUN_LAYER, box) }
  const [SW, SH] = o.screenSize

  /** True where a thing of radius `r` at `p` would not crowd a screen, a crew member or the camera. */
  const clear = (p: THREE.Vector3, r: number, path = 1.2) => {
    for (const s of o.screens) if (Math.sign(p.x) === s.side && Math.abs(p.x) > Math.abs(s.pos.x) - 1.4 - r && Math.abs(p.z - s.pos.z) < SW / 2 + 0.3 + r && Math.abs(p.y - s.pos.y) < SH / 2 + 0.3 + r) return false
    for (const c of o.crew) if (c.distanceTo(p) < 1.1 + r) return false
    for (const q of o.path) if (q.distanceTo(p) < path + r) return false
    for (const b of o.props) if (b.distanceToPoint(p) < r + 0.15) return false
    return true
  }
  /** The wall's surface on `side` at (y, z): the point and its normal into the hall; null over a port. */
  const wallAt = (side: -1 | 1, y: number, z: number) => {
    const m = walls[side], r = m.reach(y, z), ra = m.reach(y + 0.08, z), rb = m.reach(y - 0.08, z), za = m.reach(y, z + 0.08), zb = m.reach(y, z - 0.08)
    if (r === null || ra === null || rb === null || za === null || zb === null) return null
    const dy = (ra - rb) / 0.16, dz = (za - zb) / 0.16
    if (Math.abs(dy) > 1.5 || Math.abs(dz) > 0.5) return null // an edge, not a face
    return { p: new THREE.Vector3(side * r, y, z), n: new THREE.Vector3(-side, dy, dz).normalize() }
  }

  /* --- instance lists, turned into meshes at the end --- */
  type Inst = { m: THREE.Matrix4; color?: THREE.Color }
  const mtx = (pos: THREE.Vector3, q: THREE.Quaternion, s: THREE.Vector3 | number = 1) => new THREE.Matrix4().compose(pos, q, typeof s === 'number' ? new THREE.Vector3(s, s, s) : s)
  const bags: Inst[] = [], cords: Inst[] = [], rails: Inst[] = [], stand: Inst[] = [], smalls: Inst[] = [], rods: Inst[] = [], joints: Inst[] = []
  const decals: { m: THREE.Matrix4; key: string }[] = []
  /** A sticker `key`, `w` metres wide, flat on a face at `p` with normal `n`. */
  const decal = (key: string, p: THREE.Vector3, n: THREE.Vector3, w: number, roll = 0) => {
    const r = sheet.rects.get(key); if (!r) return -1
    decals.push({ key, m: mtx(p.clone().addScaledVector(n, 0.004), facing(n, roll), new THREE.Vector3(w, w / r.aspect, 1)) })
    return decals.length - 1
  }
  const rod = (list: Inst[], a: THREE.Vector3, b: THREE.Vector3, r: number, color?: string) => {
    const d = b.clone().sub(a), len = d.length()
    list.push({ m: mtx(a.clone().add(b).multiplyScalar(0.5), new THREE.Quaternion().setFromUnitVectors(UP, d.normalize()), new THREE.Vector3(r, len, r)), color: color ? new THREE.Color(color) : undefined })
  }
  const small = (pos: THREE.Vector3, q: THREE.Quaternion, size: V3, color: string) => { smalls.push({ m: mtx(pos, q, v(size)), color: new THREE.Color(color) }); return smalls.length - 1 }
  const FABRIC = ['#ebe6d8', '#e2d9c4', '#efede7', '#d8dad5', '#e6dcc6', '#e9e4d6', '#cfd8e0']
  const bag = (pos: THREE.Vector3, q: THREE.Quaternion, size: V3, color = pick(FABRIC)) => { bags.push({ m: mtx(pos, q, v(size)), color: new THREE.Color(color) }); return bags.length - 1 }
  /** A bag's label and, now and then, a bungee across its face. */
  const dress = (pos: THREE.Vector3, n: THREE.Vector3, along: THREE.Vector3, [w, h, d]: V3) => {
    const front = pos.clone().addScaledVector(n, d / 2)
    if (rand() < 0.7) decal(`bag${Math.floor(rand() * BAGS.length)}`, front.clone().addScaledVector(UP, h * 0.14), n, Math.min(0.22, w * 0.46))
    if (rand() < 0.5) {
      const c = front.clone().addScaledVector(n, 0.012).addScaledVector(UP, -h * 0.22)
      rod(cords, c.clone().addScaledVector(along, -w / 2 - 0.03), c.clone().addScaledVector(along, w / 2 + 0.03), 0.009, pick(['#1d1f22', '#24324a', '#1d1f22']))
    }
  }
  const sheet = drawSheet(low ? 0.5 : 1)

  /* --- the wall bays: packed solid with cargo bags, flush in columns, as ISS stowage is --- */
  for (const side of [-1, 1] as const) {
    const m = walls[side], n = new THREE.Vector3(-side, 0, 0), q = facing(n), along = new THREE.Vector3(1, 0, 0).applyQuaternion(q)
    for (let z = -14.1; z < 14.6;) {
      const w = pick([0.62, 0.7, 0.56]), zc = z + w / 2; z += w + 0.02
      const lip = m.reach(-1.75, zc); if (lip === null) continue
      let floorY: number | null = null
      for (let y = -1.6; y < 0.4; y += 0.04) { const r = m.reach(y, zc); if (r === null) break; if (r > lip + 0.5) { floorY = y; break } }
      if (floorY === null) continue
      let top = floorY
      while (top < 2.4) { const r = m.reach(top + 0.04, zc); if (r === null || r < lip + 0.3) break; top += 0.04 }
      if (top - floorY < 0.45) continue
      // the column's face: in front of whatever stands furthest out in it, so the bags stack flush
      const col = m.span(floorY + 0.04, top - 0.04, zc - w / 2 + 0.02, zc + w / 2 - 0.02); if (col.open > 0.05) continue
      const d = Math.min(pick([0.4, 0.44, 0.36]), col.min - lip + 0.08), x = side * (col.min - d / 2 - 0.01)
      if (d < 0.22) continue
      for (let y = floorY + 0.01; ;) {
        let h = pick([0.5, 0.44, 0.56]); const left = top - 0.02 - y
        if (left < 0.3) break
        if (left < h + 0.3) h = left // the last bag takes up the rest of the bay
        const pos = new THREE.Vector3(x + side * (rand() * 0.03), y + h / 2, zc + (rand() - 0.5) * 0.02), size: V3 = [w - 0.02, h - 0.01, d - rand() * 0.04]
        if (rand() > 0.05 && clear(pos, 0.25, 0.6)) { bag(pos, facing(new THREE.Vector3(-side, (rand() - 0.5) * 0.04, (rand() - 0.5) * 0.06)), size); dress(pos, n, along, size) }
        y += h + 0.008
      }
    }
    /* --- a few bags on the floor against the lower wall --- */
    for (let z = -12.5; z < 13; z += 2.1 + rand() * 1.8) {
      const r = m.reach(FLOOR + 0.3, z); if (r === null || rand() < 0.35) continue
      let y = FLOOR
      for (let k = 0; k < 1 + Math.floor(rand() * 2); k++) {
        const s: V3 = [pick([0.5, 0.56]), pick([0.36, 0.42]), pick([0.32, 0.38])], pos = new THREE.Vector3(side * (r - s[2] / 2 - 0.02), y + s[1] / 2 + 0.005, z + (rand() - 0.5) * 0.05)
        if (!clear(pos, 0.3, 0.8)) break
        bag(pos, facing(new THREE.Vector3(-side, 0, (rand() - 0.5) * 0.12)), s); dress(pos, n, along, s); y += s[1] + 0.01
      }
    }

    /* --- handrails along the lower band and the upper slope, and stickers beside them --- */
    let code = 1
    for (let z = -13; z < 13.5; z += 2.6) {
      for (const y of [-1.9, 2.5]) {
        const f = wallAt(side, y, z), L = pick([0.6, 0.9, 1.2])
        if (!f) continue
        const sp = m.span(y - 0.03, y + 0.03, z - L / 2, z + L / 2)
        if (sp.open > 0 || sp.max - sp.min > 0.06 || !clear(f.p, 0.3, 0.9)) continue
        addRail(f.p, f.n, L)
        if (y > 0 && code <= 6) { const g = wallAt(side, y + 0.3, z); if (g) decal(`LAB1${side < 0 ? 'P' : 'S'}${code++}`, g.p, g.n, 0.32) }
      }
    }
    // a vertical pair framing each screen on this wall
    for (const s of o.screens) if (s.side === side) for (const dz of [-1, 1]) {
      const z = s.pos.z + dz * (SW / 2 + 0.28), f = wallAt(side, s.pos.y, z)
      if (f && m.span(s.pos.y - 0.45, s.pos.y + 0.45, z - 0.02, z + 0.02).max - m.span(s.pos.y - 0.45, s.pos.y + 0.45, z - 0.02, z + 0.02).min < 0.06) addRail(f.p, f.n, 0.9, Math.PI / 2)
    }
  }
  function addRail(p: THREE.Vector3, n: THREE.Vector3, L: number, roll = 0) {
    const q = facing(n, roll), along = new THREE.Vector3(1, 0, 0).applyQuaternion(q)
    rails.push({ m: mtx(p.clone().addScaledVector(n, 0.085), q, new THREE.Vector3(L, 1, 1)) })
    for (const k of [-1, 1]) stand.push({ m: mtx(p.clone().addScaledVector(along, k * (L / 2 - 0.06)).addScaledVector(n, 0.035), q) })
  }

  /* --- cable runs along the top of each wall, sagging between clamps --- */
  const tubes: THREE.BufferGeometry[] = []
  const CABLE = ['#2a2d31', '#3a3f45', '#c4672a', '#e8e6e0', '#2f4f7a']
  for (const side of [-1, 1] as const) {
    const m = walls[side]
    ;[2.93, 3.0, 3.07].forEach((y, k) => {
      let run: THREE.Vector3[] = [], last: number | null = null
      const flush = () => {
        if (run.length >= 3) {
          const tube = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(run), run.length * 6, 0.013 + k * 0.003, 5)
          const col = new THREE.Color(CABLE[(k + (side > 0 ? 2 : 0)) % CABLE.length]), cols = new Float32Array(tube.attributes.position.count * 3)
          for (let i = 0; i < cols.length; i += 3) col.toArray(cols, i)
          tube.setAttribute('color', new THREE.BufferAttribute(cols, 3)); tubes.push(tube)
        }
        run = []
      }
      for (let z = -13.8; z <= 13.8; z += 0.6) {
        const r = m.reach(y, z), clamp = Math.round((z + 13.8) / 0.6) % 2 === 0
        if (r === null || (last !== null && Math.abs(r - last) > 0.3)) { flush(); last = r; continue }
        last = r
        run.push(new THREE.Vector3(side * (r - 0.05 - k * 0.035), y - (clamp ? 0 : 0.07 + k * 0.015), z))
      }
      flush()
    })
  }

  /* --- the ceiling: light panels, air diffusers, stickers --- */
  const lights: Inst[] = [], lenses: Inst[] = [], down = new THREE.Vector3(0, -1, 0)
  for (let i = 0; i < 8; i++) {
    const z = -12.6 + i * 3.6
    for (const x of [-1.6, 1.6]) {
      lights.push({ m: mtx(new THREE.Vector3(x, TOP - 0.06, z), new THREE.Quaternion(), new THREE.Vector3(1.15, 0.06, 0.46)) })
      lenses.push({ m: mtx(new THREE.Vector3(x, TOP - 0.095, z), new THREE.Quaternion(), new THREE.Vector3(1.0, 0.012, 0.34)) })
    }
    decal('vent', new THREE.Vector3(0, TOP - 0.022, z + 1.8), down, 0.42)
    if (i % 2 === 0 && i / 2 + 1 <= 5) decal(`LAB1O${i / 2 + 1}`, new THREE.Vector3(0.9, TOP - 0.022, z + 1.8), down, 0.32)
  }
  // deck stickers by the walls
  ;[-9, -3, 3, 9].forEach((z, i) => decal(`LAB1D${i + 1}`, new THREE.Vector3(i % 2 ? 6.2 : -6.2, FLOOR + 0.002, z), UP, 0.34))

  /* --- the aft wall: the hatch, its placards, the safety kit, the crew board, bags --- */
  const AFT = LEN - 0.15, back = new THREE.Vector3(0, 0, -1), qa = facing(back)
  const ringShape = (x: number, y0: number, y1: number, r: number, path: THREE.Path) => {
    path.moveTo(-x + r, y0); path.lineTo(x - r, y0); path.quadraticCurveTo(x, y0, x, y0 + r); path.lineTo(x, y1 - r); path.quadraticCurveTo(x, y1, x - r, y1)
    path.lineTo(-x + r, y1); path.quadraticCurveTo(-x, y1, -x, y1 - r); path.lineTo(-x, y0 + r); path.quadraticCurveTo(-x, y0, -x + r, y0); return path
  }
  const shape = ringShape(1.8, FLOOR - 0.3, FLOOR + 3.95, 0.55, new THREE.Shape()) as THREE.Shape
  shape.holes.push(ringShape(1.42, FLOOR - 0.2, FLOOR + 3.55, 0.4, new THREE.Path()))
  const metal = hallMaterial(maps, '#b9bdc1', { metalness: 0.55, rough: 0.3 })
  const ring = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: 0.16, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.04, bevelSegments: 3, curveSegments: 12 }), metal)
  ring.position.z = AFT - 0.2; ring.castShadow = ring.receiveShadow = true; ring.layers.enable(SUN_LAYER); root.add(ring)
  const ringFront = AFT - 0.245
  for (const x of [-1.61, 1.61]) decal('hazard', new THREE.Vector3(x, FLOOR + 1.7, ringFront), back, 2.6, Math.PI / 2)
  decal('hazard', new THREE.Vector3(0, FLOOR + 3.75, ringFront), back, 2.2)
  // a small window in each leaf, and the hatch handle
  const glass = new THREE.MeshStandardMaterial({ color: '#0a1016', metalness: 1, roughness: 0.08 }), dark = new THREE.MeshStandardMaterial({ color: '#2b3036', metalness: 0.6, roughness: 0.4 })
  for (const x of [-0.6, 0.6]) {
    const g = new THREE.Mesh(new THREE.CircleGeometry(0.13, 24), glass); g.position.set(x, FLOOR + 2.3, AFT - 0.095); g.rotation.y = Math.PI; root.add(g)
    const t = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.022, 8, 28), metal); t.position.copy(g.position); root.add(t)
  }
  const handle = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.5, 0.05), dark); handle.position.set(0.32, FLOOR + 1.35, AFT - 0.13); handle.rotation.z = 0.25; root.add(handle)
  const at = (x: number, y: number) => new THREE.Vector3(x, y, AFT - 0.001)
  decal('node', at(0, FLOOR + 4.25), back, 1.0)
  decal('caution', at(-2.25, FLOOR + 3.1), back, 0.42)
  decal('egress', at(2.3, FLOOR + 3.1), back, 0.4)
  decal('fireport', at(2.25, FLOOR + 2.45), back, 0.2)
  decal('pfe', at(2.85, FLOOR + 0.7), back, 0.3)
  decal('pba', at(2.85, FLOOR + 2.0), back, 0.3)
  decal('patch0', at(-2.85, FLOOR + 3.55), back, 0.44)
  decal('patch1', at(-3.45, FLOOR + 3.0), back, 0.32)
  decal('patch2', at(-2.75, FLOOR + 2.55), back, 0.32)
  for (const x of [-2.05, 2.05]) addRail(at(x, FLOOR + 1.9), back, 1.0, Math.PI / 2)
  // the portable fire extinguisher in its bracket
  const red = new THREE.MeshStandardMaterial({ color: '#b3202a', metalness: 0.3, roughness: 0.35 })
  const pfe = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.5, 20), red); pfe.position.set(2.85, FLOOR + 1.25, AFT - 0.12); pfe.castShadow = true; root.add(pfe)
  const head = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.12, 12), dark); head.position.set(2.85, FLOOR + 1.56, AFT - 0.12); root.add(head)
  small(new THREE.Vector3(2.85, FLOOR + 1.12, AFT - 0.06), qa, [0.2, 0.05, 0.1], '#4a5058'); small(new THREE.Vector3(2.85, FLOOR + 1.4, AFT - 0.06), qa, [0.2, 0.05, 0.1], '#4a5058')
  // the crew lock bag, hung from a rail beside the hatch
  addRail(at(-2.45, FLOOR + 1.75), back, 0.6)
  bag(new THREE.Vector3(-2.45, FLOOR + 1.36, AFT - 0.11), qa, [0.42, 0.38, 0.16], '#f1efe9')
  rod(cords, new THREE.Vector3(-2.6, FLOOR + 1.55, AFT - 0.14), new THREE.Vector3(-2.45, FLOOR + 1.83, AFT - 0.17), 0.01, '#1d1f22')
  rod(cords, new THREE.Vector3(-2.3, FLOOR + 1.55, AFT - 0.14), new THREE.Vector3(-2.45, FLOOR + 1.83, AFT - 0.17), 0.01, '#1d1f22')
  decal('bag10', new THREE.Vector3(-2.45, FLOOR + 1.4, AFT - 0.19), back, 0.18)
  // bags along the foot of the aft wall
  for (let x = -6.7; x < -3.1;) {
    const s: V3 = [pick([0.5, 0.56, 0.44]), pick([0.36, 0.42]), pick([0.3, 0.36])]; x += s[0] / 2
    let y = FLOOR
    for (let k = 0; k < 1 + Math.floor(rand() * 2.4); k++) { const p = new THREE.Vector3(x, y + s[1] / 2 + 0.005, AFT - s[2] / 2 - 0.01); bag(p, qa, s); dress(p, back, new THREE.Vector3(-1, 0, 0), s); y += s[1] + 0.01 }
    x += s[0] / 2 + 0.04
  }
  // stowage strapped up the aft wall above the board, under a handrail and the module's sticker
  for (let row = 0; row < 3; row++) for (let x = -6.6; x < -2.9;) {
    const s: V3 = [pick([0.62, 0.7, 0.56]), 0.5, pick([0.36, 0.4])]; x += s[0] / 2
    const p = new THREE.Vector3(x, 1.0 + row * 0.52 + s[1] / 2, AFT - s[2] / 2 - 0.01)
    if (rand() > 0.08) { bag(p, facing(new THREE.Vector3((rand() - 0.5) * 0.05, 0, -1)), s); dress(p, back, new THREE.Vector3(-1, 0, 0), s) }
    x += s[0] / 2 + 0.02
  }
  addRail(at(-4.75, 2.85), back, 1.2); decal('LAB1A1', at(-4.75, 3.2), back, 0.32)
  for (const x of [2.1, 3.2]) addRail(at(x, 2.6), back, 0.9)
  decal('vent', at(2.75, 3.2), back, 0.36)
  ;([['photo0', -3.75, 0.25, 0.08], ['photo1', -3.72, -0.25, -0.06], ['photo2', -6.05, 0.15, 0.05], ['checklist', -6.05, -0.38, -0.04]] as const).forEach(([k, x, y, r]) => decal(k, at(x, y), back, 0.2, r))
  // the crew board, live: who is aboard and how they are
  const boardCanvas = document.createElement('canvas'); boardCanvas.width = 1024; boardCanvas.height = 640
  const boardTex = new THREE.CanvasTexture(boardCanvas); boardTex.colorSpace = THREE.SRGBColorSpace; boardTex.anisotropy = 8
  const board = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 1.0625), new THREE.MeshStandardMaterial({ map: boardTex, roughness: 0.85 }))
  board.position.set(-4.9, 0.1, AFT - 0.03); board.rotation.y = Math.PI; root.add(board)
  small(new THREE.Vector3(-4.9, 0.1, AFT - 0.012), qa, [1.78, 1.14, 0.02], '#3a4048')

  /* --- laptops on arms by the walls, each showing a crew member live --- */
  const laptops: { ctx: G; tex: THREE.CanvasTexture; n: number }[] = []
  const lapMat = '#1d2126'
  for (const [side, z] of [[-1, -7.4], [1, 9.6], [1, -9.8], [-1, 6.6], [1, 1.8]] as const) {
    if (laptops.length >= (low ? 2 : 3)) break
    const m = walls[side], lip = m.reach(-1.75, z); if (lip === null) continue
    const A = new THREE.Vector3(side * lip, -1.6, z), E = A.clone().add(new THREE.Vector3(-side * 0.35, 0.32, 0)), L = E.clone().add(new THREE.Vector3(-side * 0.28, 0.24, 0))
    if (!clear(L, 0.45, 1.0)) continue
    rod(rods, A, E, 0.022); rod(rods, E, L.clone().add(new THREE.Vector3(0, -0.03, 0)), 0.02)
    for (const p of [A, E]) joints.push({ m: mtx(p, new THREE.Quaternion(), 0.04) })
    small(A.clone().add(new THREE.Vector3(side * 0.02, 0, 0)), facing(new THREE.Vector3(-side, 0, 0)), [0.14, 0.14, 0.04], '#3a4048')
    const q = facing(new THREE.Vector3(-side, 0, 0.55)), grp = new THREE.Group(); grp.position.copy(L); grp.quaternion.copy(q); root.add(grp)
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.022, 0.25), new THREE.MeshStandardMaterial({ color: lapMat, roughness: 0.55, metalness: 0.2 })); grp.add(base)
    const lid = new THREE.Group(); lid.position.set(0, 0.011, -0.125); lid.rotation.x = -0.28; grp.add(lid)
    const shell = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.24, 0.012), base.material); shell.position.set(0, 0.12, -0.006); lid.add(shell)
    const c = document.createElement('canvas'); c.width = 512; c.height = 320
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.33, 0.206), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false, color: new THREE.Color(0.8, 0.8, 0.8) }))
    screen.position.set(0, 0.12, 0.001); lid.add(screen)
    decal('velcro', L.clone().add(new THREE.Vector3(0, 0.012, 0)), UP, 0.1)
    laptops.push({ ctx: c.getContext('2d')!, tex, n: laptops.length + 2 })
  }

  /* --- the Veggie plant chamber by the Alerts screen, glowing magenta --- */
  let veggieGlow: THREE.Sprite | null = null
  for (const z of [-4.4, -5.4, -8.6]) {
    const side = -1, m = walls[side], lip = m.reach(-1.75, z); if (lip === null) continue
    let ledge = -1.6
    while (ledge < -0.6) { const r = m.reach(ledge + 0.04, z); if (r === null || r > lip + 0.3) break; ledge += 0.04 }
    const c = new THREE.Vector3(side * (lip - 0.34), ledge + 0.42, z)
    if (!clear(c, 0.35, 1.0)) continue
    const grp = new THREE.Group(); grp.position.copy(c); grp.quaternion.copy(facing(new THREE.Vector3(1, 0, 0.25))); grp.scale.setScalar(1.3); root.add(grp)
    const white = new THREE.MeshStandardMaterial({ color: '#e9ebe8', roughness: 0.5 })
    const tray = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.07, 0.42), white); tray.position.y = -0.28; grp.add(tray)
    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.08, 0.42), white); cap.position.y = 0.3; grp.add(cap)
    const lamp = new THREE.Mesh(new THREE.PlaneGeometry(0.44, 0.36), new THREE.MeshBasicMaterial({ color: new THREE.Color('#ff4fb8').multiplyScalar(2.2), toneMapped: false }))
    lamp.rotation.x = Math.PI / 2; lamp.position.y = 0.259; grp.add(lamp)
    const bellows = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.5, 0.4), new THREE.MeshStandardMaterial({ color: '#f6d4ea', transparent: true, opacity: 0.18, roughness: 0.3, depthWrite: false, side: THREE.DoubleSide }))
    grp.add(bellows); grp.updateMatrixWorld()
    // lettuce: crossed stickers in two rows
    for (let i = 0; i < 6; i++) {
      const lp = new THREE.Vector3(-0.16 + (i % 3) * 0.16, -0.17, i < 3 ? -0.08 : 0.08).applyMatrix4(grp.matrixWorld)
      for (const a of [0, Math.PI / 2]) decal('leaf', lp, new THREE.Vector3(Math.sin(a + i), 0, Math.cos(a + i)), 0.22)
    }
    // its glow on the wall and floor round it: an additive sprite, not a light (one more light would cost every material in the hall)
    veggieGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture([[0, 'rgba(255,70,180,0.55)'], [0.35, 'rgba(255,60,170,0.18)'], [1, 'rgba(255,60,170,0)']]), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }))
    veggieGlow.position.copy(c).add(new THREE.Vector3(0.12, 0, 0)); veggieGlow.scale.setScalar(1.6); root.add(veggieGlow)
    break
  }

  /* --- foot loops under each screen --- */
  const loops: Inst[] = []
  if (!low) for (const s of o.screens) for (const dz of [-0.24, 0.24]) loops.push({ m: mtx(new THREE.Vector3(s.side * 6.3, FLOOR, s.pos.z + dz), new THREE.Quaternion().setFromAxisAngle(UP, Math.PI / 2)) })

  /* --- the galley table, with the day's food strapped down --- */
  const T = new THREE.Vector3(-3.7, -1.3, 1.2)
  let table: THREE.Mesh | null = null
  if (clear(T, 0.6, 0.4)) { // low under the tour: the camera passes over it
    const tableMat = hallMaterial(maps, '#c9ccce', { metalness: 0.4, rough: 0.35 })
    table = new THREE.Mesh(new RoundedBoxGeometry(1.6, 0.08, 0.95, 2, 0.03), tableMat)
    table.position.copy(T); table.castShadow = table.receiveShadow = true; table.layers.enable(SUN_LAYER); root.add(table)
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.14, T.y - FLOOR - 0.04, 16), tableMat); leg.position.set(T.x, (T.y + FLOOR) / 2, T.z); leg.castShadow = true; root.add(leg)
    small(new THREE.Vector3(T.x, FLOOR + 0.03, T.z), new THREE.Quaternion(), [0.75, 0.06, 0.6], '#5a6168')
    for (const k of [-1, 1]) addRail(T.clone().add(new THREE.Vector3(0, -0.01, k * 0.475)), new THREE.Vector3(0, 0, k), 1.2)
    for (const [dx, dz] of [[-0.4, -0.2], [0.3, 0.25], [0.35, -0.22], [-0.3, 0.24]]) decal('velcro', T.clone().add(new THREE.Vector3(dx, 0.031, dz)), UP, 0.12)
    const top = T.y + 0.04
    for (let i = 0; i < 9; i++) {
      const kind = i % 3, s: V3 = kind === 0 ? [0.11, 0.02, 0.17] : kind === 1 ? [0.15, 0.025, 0.11] : [0.2, 0.03, 0.2]
      const col = kind === 0 ? '#c9ccd0' : kind === 1 ? pick(['#d8473a', '#e2b33c', '#4a8fd0', '#5aa65a']) : '#e9e2cf'
      small(new THREE.Vector3(T.x - 0.5 + (i % 5) * 0.24 + rand() * 0.04, top + s[1] / 2, T.z - 0.25 + Math.floor(i / 5) * 0.42 + rand() * 0.05), new THREE.Quaternion().setFromAxisAngle(UP, (rand() - 0.5) * 0.6), s, col)
    }
    for (const dz of [-0.2, 0.22]) rod(cords, new THREE.Vector3(T.x - 0.66, top + 0.035, T.z + dz), new THREE.Vector3(T.x + 0.66, top + 0.035, T.z + dz), 0.008, '#24324a')
  }

  /* --- loose things drifting in the air --- */
  type Floater = { list: 'smalls' | 'bags' | 'decals'; i: number; base: THREE.Vector3; q: THREE.Quaternion; s: THREE.Vector3; spin: THREE.Vector3; ph: number }
  const floaters: Floater[] = []
  if (!low) {
    const spots: [V3, string][] = [
      [[-4.6, 1.6, 6.0], 'pouch'], [[-5.2, 0.9, -6.5], 'checklist'], [[5.3, 1.9, 8.0], 'pen'], [[4.9, 0.6, -9.5], 'bag'],
      [[-3.4, 2.6, -3.0], 'photo0'], [[5.6, 2.4, 1.0], 'towel'], [[-5.6, 2.2, 10.5], 'food'], [[4.4, -0.4, 12.0], 'tablet'], [[-4.2, 0.2, -10.5], 'photo1'],
    ]
    for (const [p, kind] of spots) {
      const base = v(p); if (!clear(base, 0.2, 1.1)) continue
      const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(rand() * 6, rand() * 6, rand() * 6))
      const spin = new THREE.Vector3(rand() - 0.5, rand() - 0.5, rand() - 0.5).normalize().multiplyScalar(0.1 + rand() * 0.15), ph = rand() * 10
      if (kind === 'checklist' || kind.startsWith('photo')) {
        const r = sheet.rects.get(kind)!, s = new THREE.Vector3(kind === 'checklist' ? 0.18 : 0.15, (kind === 'checklist' ? 0.18 : 0.15) / r.aspect, 1)
        decals.push({ key: kind, m: mtx(base, q, s) }); floaters.push({ list: 'decals', i: decals.length - 1, base, q, s, spin, ph })
      } else if (kind === 'bag') {
        const s = new THREE.Vector3(0.42, 0.3, 0.26); floaters.push({ list: 'bags', i: bag(base, q, [s.x, s.y, s.z]), base, q, s, spin, ph })
      } else {
        const [s, col] = ({ pouch: [[0.1, 0.17, 0.025], '#c9ccd0'], pen: [[0.012, 0.15, 0.012], '#2c4f9e'], towel: [[0.3, 0.05, 0.22], '#3f6fb0'], food: [[0.15, 0.11, 0.025], '#d8473a'], tablet: [[0.25, 0.17, 0.012], '#1d2126'] } as Record<string, [V3, string]>)[kind]
        floaters.push({ list: 'smalls', i: small(base, q, s, col), base, q, s: v(s), spin, ph })
      }
    }
  }

  /* --- build the meshes --- */
  const inst = (geo: THREE.BufferGeometry, mat: THREE.Material, list: Inst[], shadow = false) => {
    const m = new THREE.InstancedMesh(geo, mat, Math.max(1, list.length)); m.count = list.length
    list.forEach((it, i) => { m.setMatrixAt(i, it.m); if (it.color) m.setColorAt(i, it.color) })
    m.castShadow = shadow; m.receiveShadow = true
    if (shadow) m.layers.enable(SUN_LAYER)
    m.computeBoundingSphere(); root.add(m)
    return m
  }
  const fabric = fabricTexture()
  const bagMesh = inst(new RoundedBoxGeometry(1, 1, 1, 2, 0.14), new THREE.MeshStandardMaterial({ map: fabric, bumpMap: fabric, bumpScale: 1.2, roughness: 0.93, metalness: 0 }), bags, o.quality === 'high')
  inst(new THREE.CylinderGeometry(1, 1, 1, 6), new THREE.MeshStandardMaterial({ roughness: 0.8 }), cords)
  const railMat = new THREE.MeshStandardMaterial({ color: '#5b7fa6', roughness: 0.42, metalness: 0.45 })
  inst(new RoundedBoxGeometry(1, 0.036, 0.03, 2, 0.012), railMat, rails)
  inst(new THREE.BoxGeometry(0.03, 0.03, 0.07), railMat, stand)
  const smallMesh = inst(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ roughness: 0.5, metalness: 0.25 }), smalls)
  inst(new THREE.CylinderGeometry(1, 1, 1, 10), dark, rods)
  inst(new THREE.SphereGeometry(1, 10, 8), dark, joints)
  inst(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: '#d4d7da', roughness: 0.4, metalness: 0.5 }), lights)
  // warm white and kept below the bloom threshold: the window stays the brightest thing in the hall
  inst(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: '#000000', emissive: '#fff1de', emissiveIntensity: 0.95 }), lenses)
  if (loops.length) inst(new THREE.TorusGeometry(0.11, 0.016, 6, 14, Math.PI), new THREE.MeshStandardMaterial({ color: '#3d5f8c', roughness: 0.9 }), loops)
  if (tubes.length) {
    const merged = new THREE.BufferGeometry(), all = tubes.map((t) => t.toNonIndexed())
    for (const name of ['position', 'normal', 'color']) {
      const len = all.reduce((s, t) => s + t.attributes[name].array.length, 0), arr = new Float32Array(len)
      let off = 0; for (const t of all) { arr.set(t.attributes[name].array as Float32Array, off); off += t.attributes[name].array.length }
      merged.setAttribute(name, new THREE.BufferAttribute(arr, 3))
    }
    tubes.forEach((t) => t.dispose()); all.forEach((t) => t.dispose())
    const cables = new THREE.Mesh(merged, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0.1 })); cables.receiveShadow = true; root.add(cables)
  }
  // the stickers: one mesh, each instance its own corner of the sheet
  const decalMat = new THREE.MeshStandardMaterial({ map: sheet.tex, roughness: 0.75, metalness: 0, alphaTest: 0.5, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 })
  decalMat.onBeforeCompile = (sh) => {
    sh.vertexShader = 'attribute vec4 aRect;\n' + sh.vertexShader.replace('#include <uv_vertex>', '#include <uv_vertex>\n  vMapUv = aRect.xy + uv * aRect.zw;')
  }
  const decalMesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), decalMat, Math.max(1, decals.length)); decalMesh.count = decals.length
  const rectArr = new Float32Array(Math.max(1, decals.length) * 4)
  decals.forEach((d, i) => { decalMesh.setMatrixAt(i, d.m); const r = sheet.rects.get(d.key)!; rectArr.set([r.u, r.v, r.w, r.h], i * 4) })
  decalMesh.geometry.setAttribute('aRect', new THREE.InstancedBufferAttribute(rectArr, 4))
  decalMesh.receiveShadow = true; decalMesh.computeBoundingSphere(); root.add(decalMesh)

  const meshes = { smalls: smallMesh, bags: bagMesh, decals: decalMesh }
  const tmp = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3()
  let boardKey = ''

  return {
    /** The live surfaces (laptops, crew board), on the panels' clock. */
    draw(d: CabinData, t: number) {
      const order = [d.focusId, d.selfId, ...d.crew.map((c) => c.id)]
      laptops.forEach((l, i) => { const id = order[i] ?? d.crew[0]?.id; drawLaptop(l.ctx, 512, 320, d.crew.find((c) => c.id === id), t, l.n); l.tex.needsUpdate = true })
      const key = d.crew.map((c) => `${c.id}${c.status}${Math.round(c.readiness)}`).join() + d.link.pending
      if (key !== boardKey) { boardKey = key; drawBoard(boardCanvas.getContext('2d')!, 1024, 640, d); boardTex.needsUpdate = true }
    },
    /** Every frame: the drifting things and the plant light. */
    update(t: number, still: number) {
      if (veggieGlow) veggieGlow.material.opacity = 1 + 0.12 * Math.sin(t * 0.9) * still - 0.12
      if (!still || !floaters.length) return
      const dirty = new Set<THREE.InstancedMesh>()
      for (const f of floaters) {
        p.copy(f.base).add(new THREE.Vector3(Math.sin(t * 0.21 + f.ph) * 0.12, Math.sin(t * 0.17 + f.ph * 1.3) * 0.1, Math.cos(t * 0.19 + f.ph) * 0.12))
        q.setFromAxisAngle(f.spin.clone().normalize(), t * f.spin.length()).multiply(f.q)
        const m = meshes[f.list]; m.setMatrixAt(f.i, tmp.compose(p, q, f.s)); dirty.add(m)
      }
      for (const m of dirty) m.instanceMatrix.needsUpdate = true
    },
  }
}
