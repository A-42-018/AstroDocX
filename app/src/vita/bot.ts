/*
 * VITA's drone for the dock: the landing page's particle bot (landing/briefing/vita.js, drawBot) at dock size. A
 * Fibonacci sphere of particles, a chamfered visor whose eyes follow the pointer and blink, and a HUD ring with three
 * counter-rotating arcs. While VITA talks the particles wobble, the ring arcs grow and a voice line runs under the visor.
 * Everything is a fraction of the canvas, so it draws the same at any size. With reduced motion nothing moves by itself:
 * it is drawn once, and again when the talk state changes or the eyes follow the pointer.
 */

const CY = '#36e2f5', CYHI = '#9ff4ff'
const N = 520
const PTS: [number, number, number][] = Array.from({ length: N }, (_, i) => {
  const y = 1 - (i / (N - 1)) * 2, r = Math.sqrt(1 - y * y), th = i * 2.39996
  return [Math.cos(th) * r, y, Math.sin(th) * r]
})

export interface VitaBot {
  /** The mouth line and the wobble: true while VITA speaks. */
  talk(on: boolean): void
  /** A short brighter glow: VITA heard you. */
  perk(ms?: number): void
  /** Stop drawing and listening (call when the dock unmounts). */
  stop(): void
}

export function createVitaBot(canvas: HTMLCanvasElement, { reduced = false }: { reduced?: boolean } = {}): VitaBot {
  const g = canvas.getContext('2d')
  let talking = false, moodUntil = 0, raf = 0, queued = false, dead = false, lastDraw = 0
  const look = { x: 0, y: 0 }, lookT = { x: 0, y: 0 }
  if (!g) return { talk() {}, perk() {}, stop() {} }
  const b = g

  function draw(t: number) {
    const S = canvas.width, c = S / 2
    b.clearRect(0, 0, S, S)
    if (!reduced) { look.x += (lookT.x - look.x) * 0.08; look.y += (lookT.y - look.y) * 0.08 }
    const col = moodUntil && t < moodUntil ? CYHI : CY
    const amp = talking ? (reduced ? 0.6 : 0.5 + 0.5 * Math.abs(Math.sin(t / 70) * Math.sin(t / 190))) : 0
    const bob = reduced ? 0 : Math.sin(t / 900) * S * 0.018
    const R = S * (0.275 + amp * 0.012), cy = c + bob
    const ry = (reduced ? 0.4 : t / 4000) + look.x * 0.5, rx = look.y * 0.4
    const spin = reduced ? 0 : t, lw = Math.max(1, S / 110)

    // HUD ring: ticks + three counter-rotating arcs
    b.save(); b.translate(c, cy); b.strokeStyle = col; b.globalAlpha = 0.5; b.lineWidth = lw * 0.6
    b.beginPath()
    for (let i = 0; i < 48; i++) {
      const a = (i / 48) * Math.PI * 2, l = S * (i % 4 ? 0.014 : 0.03)
      b.moveTo(Math.cos(a) * S * 0.455, Math.sin(a) * S * 0.455); b.lineTo(Math.cos(a) * (S * 0.455 - l), Math.sin(a) * (S * 0.455 - l))
    }
    b.stroke()
    b.globalAlpha = 0.85; b.lineWidth = lw * 1.2; b.shadowColor = col; b.shadowBlur = S * 0.04
    for (let k = 0; k < 3; k++) {
      const a0 = (spin / (1600 + k * 700)) * (k % 2 ? -1 : 1) + k * 2.1
      b.beginPath(); b.arc(0, 0, S * (0.4 + k * 0.022), a0, a0 + 0.6 + amp * 0.5); b.stroke()
    }
    b.shadowBlur = 0; b.restore()

    // particle shell, wobbling a little more while it talks
    const cyr = Math.cos(ry), syr = Math.sin(ry), cxr = Math.cos(rx), sxr = Math.sin(rx)
    for (const [x0, y0, z0] of PTS) {
      const x = x0 * cyr + z0 * syr
      let z = -x0 * syr + z0 * cyr
      const y = y0 * cxr - z * sxr; z = y0 * sxr + z * cxr
      const wob = reduced ? 1 : 1 + 0.04 * Math.sin(t / 300 + y0 * 6) + amp * 0.05 * Math.sin(t / 60 + x0 * 9)
      const sx = c + x * R * wob, sy = cy + y * R * wob, d = (z + 1) / 2
      b.globalAlpha = 0.14 + d * 0.8; b.fillStyle = d > 0.7 ? CYHI : col
      const s = S * (0.006 + d * 0.011)
      b.fillRect(sx - s / 2, sy - s / 2, s, s)
    }

    // visor, chamfered like the console panels; the eyes blink every few seconds
    const ex = c + look.x * S * 0.1, ey = cy + look.y * S * 0.07 - S * 0.012
    const blink = !reduced && t % 4200 < 120 ? 0.15 : 1, vw = S * 0.17, vh = S * 0.075, k = S * 0.026
    b.globalAlpha = 1; b.fillStyle = 'rgba(2,6,10,.9)'; b.strokeStyle = col; b.lineWidth = lw
    b.beginPath(); b.moveTo(ex - vw + k, ey - vh); b.lineTo(ex + vw, ey - vh); b.lineTo(ex + vw, ey + vh - k); b.lineTo(ex + vw - k, ey + vh); b.lineTo(ex - vw, ey + vh); b.lineTo(ex - vw, ey - vh + k); b.closePath(); b.fill(); b.stroke()
    b.fillStyle = col; b.shadowColor = col; b.shadowBlur = S * 0.04
    const eh = S * 0.05 * blink
    for (const dx of [-0.06, 0.06]) b.fillRect(ex + dx * S - S * 0.024, ey - eh, S * 0.048, eh * 2)
    b.shadowBlur = 0
    if (amp) {
      b.strokeStyle = col; b.lineWidth = lw * 0.9; b.beginPath()
      const w = S * 0.075
      for (let i = -w; i <= w; i += S * 0.008) { const yy = ey + vh * 0.62 + Math.sin(i / (S * 0.011) + t / 50) * amp * S * 0.011; if (i === -w) b.moveTo(ex + i, yy); else b.lineTo(ex + i, yy) }
      b.stroke()
    }
  }

  function loop(t: number) {
    if (dead) return
    raf = requestAnimationFrame(loop)
    // 30 frames a second is plenty for a small drone, and leaves the 3D cabin its frame time
    if (t - lastDraw < 30) return
    lastDraw = t
    if (!document.hidden) draw(t)
  }
  function redraw() {
    if (!reduced || queued || dead) return
    queued = true
    requestAnimationFrame((t) => { queued = false; draw(t) })
  }
  const onPointer = (e: PointerEvent) => {
    const r = canvas.getBoundingClientRect()
    lookT.x = Math.max(-1, Math.min(1, (e.clientX - r.left - r.width / 2) / 500))
    lookT.y = Math.max(-1, Math.min(1, (e.clientY - r.top - r.height / 2) / 400))
    if (reduced) { look.x = lookT.x; look.y = lookT.y; redraw() }
  }
  window.addEventListener('pointermove', onPointer, { passive: true })
  if (reduced) draw(performance.now()); else raf = requestAnimationFrame(loop)

  return {
    talk(on) { talking = on; redraw() },
    perk(ms = 600) { moodUntil = performance.now() + ms; redraw(); if (reduced) window.setTimeout(redraw, ms + 20) },
    stop() { dead = true; cancelAnimationFrame(raf); window.removeEventListener('pointermove', onPointer) },
  }
}
