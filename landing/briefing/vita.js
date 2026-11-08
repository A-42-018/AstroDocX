/* ============================================================
   ASTRODOCX — Mission Briefing visuals (all procedural, no images)
     backdrop   the console's dawn horizon, twinkling stars and a
                slowly turning particle Earth limb
     VITA       a particle drone in the console's hologram style:
                a chamfered visor whose eyes follow the cursor, a HUD
                targeting ring, and a voice line while it talks
     doors      three tiny live previews (ECG, cabin corridor, media)
   One requestAnimationFrame loop for everything. With reduced motion
   nothing moves on its own: each canvas is drawn once (and again on
   resize, on talk/mood changes and when the eyes follow the pointer).
============================================================ */

const ICE = '#f2fbff', ICEFAR = '#a9c4d4'   // NOVA's shell: ice-white so it never blends into the cyan HUD behind it
const CY = '#36e2f5', CYHI = '#9ff4ff', OK = '#3ddc97', OR = '#ff8a3d'

export function createScene({ bg, bot, doors = [], reduced = false, under = null }) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  const g = bg.getContext('2d'), b = bot.getContext('2d')
  const dc = doors.map((c) => c.getContext('2d'))

  /* ── backdrop ── */
  let W = 0, H = 0, stars = [], earth = [], sky = null, sun = null
  function size() {
    W = bg.width = Math.round(innerWidth * dpr); H = bg.height = Math.round(innerHeight * dpr)
    const n = Math.round(Math.min(260, (innerWidth * innerHeight) / 5200))
    stars = Array.from({ length: n }, () => ({ x: Math.random() * W, y: Math.random() * H * 0.8, r: (0.4 + Math.random()) * dpr, t: Math.random() * 6 }))
    earth = []
    const m = innerWidth < 760 ? 1600 : 2800
    for (let i = 0; i < m; i++) {
      const u = Math.random() * 2 - 1, th = Math.random() * Math.PI * 2
      earth.push({ u, th, land: Math.sin(th * 3 + u * 4) + Math.cos(th * 5 - u * 2) > 0.5 })
    }
    sky = g.createLinearGradient(0, 0, 0, H); sky.addColorStop(0, '#050608'); sky.addColorStop(0.6, '#0a0f1a'); sky.addColorStop(1, '#0d1a2c')
    sun = g.createRadialGradient(W * 0.7, H * 0.86, 0, W * 0.7, H * 0.86, W * 0.55); sun.addColorStop(0, 'rgba(255,140,70,.32)'); sun.addColorStop(1, 'rgba(255,140,70,0)')
    if (reduced) frame(performance.now(), true)
  }
  function drawBg(t) {
    g.globalAlpha = 1; g.fillStyle = sky; g.fillRect(0, 0, W, H)
    g.fillStyle = sun; g.fillRect(0, 0, W, H)
    g.fillStyle = '#d6eefa'
    for (const s of stars) { g.globalAlpha = reduced ? 0.5 : 0.3 + 0.4 * Math.sin(t / 900 + s.t); g.fillRect(s.x, s.y, s.r, s.r) }
    const R = Math.max(W, H) * 0.95, cx = W * 0.5, cy = H + R * 0.8, rot = reduced ? 0.6 : t / 26000, d = 1.6 * dpr
    for (const p of earth) {
      const r = Math.sqrt(1 - p.u * p.u), a = p.th + rot, z = r * Math.sin(a)
      if (z < 0) continue
      const sx = cx + r * Math.cos(a) * R, sy = cy - p.u * R
      if (sy > H || sy < 0) continue
      g.globalAlpha = (0.15 + z * 0.55) * (p.land ? 1 : 0.45)
      g.fillStyle = p.land ? OK : CY
      g.fillRect(sx, sy, d, d)
    }
    g.globalAlpha = 0.55; g.strokeStyle = CY; g.lineWidth = 1.2 * dpr
    g.beginPath(); g.arc(cx, cy, R * 1.01, Math.PI * 1.15, Math.PI * 1.85); g.stroke(); g.globalAlpha = 1
    if (under) under(g, t, W, H, dpr)   // the cosmos blobs sit on the horizon, in the same loop
  }

  /* ── VITA ── */
  const pts = Array.from({ length: 900 }, (_, i) => { const y = 1 - (i / 899) * 2, r = Math.sqrt(1 - y * y), th = i * 2.39996; return [Math.cos(th) * r, y, Math.sin(th) * r] })
  let talking = false, mood = CY, moodUntil = 0
  const look = { x: 0, y: 0 }, lookT = { x: 0, y: 0 }
  function onPointer(e) {
    const r = bot.getBoundingClientRect()
    lookT.x = Math.max(-1, Math.min(1, (e.clientX - r.left - r.width / 2) / 500))
    lookT.y = Math.max(-1, Math.min(1, (e.clientY - r.top - r.height / 2) / 400))
    if (reduced) { look.x = lookT.x; look.y = lookT.y; queue() }
  }
  addEventListener('pointermove', onPointer, { passive: true })

  function drawBot(t) {
    const S = bot.width, c = S / 2
    b.clearRect(0, 0, S, S)
    if (!reduced) { look.x += (lookT.x - look.x) * 0.06; look.y += (lookT.y - look.y) * 0.06 }
    const col = moodUntil && t < moodUntil ? CYHI : mood
    const bob = reduced ? 0 : Math.sin(t / 900) * 10
    const amp = talking ? (reduced ? 0.6 : 0.5 + 0.5 * Math.abs(Math.sin(t / 70) * Math.sin(t / 190))) : 0
    const R = 140 + amp * 10, ry = (reduced ? 0.4 : t / 4000) + look.x * 0.5, rx = look.y * 0.4, cy = c + bob - 10
    const spin = reduced ? 0 : t

    // HUD ring: ticks + three counter-rotating arcs, like the console's gauges
    b.save(); b.translate(c, cy); b.strokeStyle = col; b.globalAlpha = 0.5; b.lineWidth = 1.5
    b.beginPath()
    for (let i = 0; i < 72; i++) { const a = (i / 72) * Math.PI * 2, l = i % 6 ? 6 : 14; b.moveTo(Math.cos(a) * 250, Math.sin(a) * 250); b.lineTo(Math.cos(a) * (250 - l), Math.sin(a) * (250 - l)) }
    b.stroke()
    b.globalAlpha = 0.85; b.lineWidth = 3; b.shadowColor = col; b.shadowBlur = 12
    for (let k = 0; k < 3; k++) { const a0 = (spin / (1600 + k * 700)) * (k % 2 ? -1 : 1) + k * 2.1; b.beginPath(); b.arc(0, 0, 270 + k * 12, a0, a0 + 0.6 + amp * 0.5); b.stroke() }
    b.shadowBlur = 0; b.restore()

    // dark body disc so the cyan scene behind NOVA cannot bleed through the shell
    const rg = b.createRadialGradient(c, cy, R * 0.2, c, cy, R * 1.08)
    rg.addColorStop(0, 'rgba(3,10,16,.95)'); rg.addColorStop(0.85, 'rgba(3,10,16,.88)'); rg.addColorStop(1, 'rgba(3,10,16,0)')
    b.globalAlpha = 1; b.fillStyle = rg; b.beginPath(); b.arc(c, cy, R * 1.08, 0, Math.PI * 2); b.fill()

    // particle shell (Fibonacci sphere), wobbling a little more while it talks
    const cyr = Math.cos(ry), syr = Math.sin(ry), cxr = Math.cos(rx), sxr = Math.sin(rx)
    for (const [x0, y0, z0] of pts) {
      const x = x0 * cyr + z0 * syr
      let z = -x0 * syr + z0 * cyr
      const y = y0 * cxr - z * sxr; z = y0 * sxr + z * cxr
      const wob = reduced ? 1 : 1 + 0.04 * Math.sin(t / 300 + y0 * 6) + amp * 0.05 * Math.sin(t / 60 + x0 * 9)
      const sx = c + x * R * wob, sy = cy + y * R * wob, d = (z + 1) / 2
      b.globalAlpha = 0.12 + d * 0.8; b.fillStyle = d > 0.4 ? ICE : ICEFAR
      const s = 1.5 + d * 2.6; b.fillRect(sx - s / 2, sy - s / 2, s, s)
    }

    // visor: chamfered like the console panels; the eyes blink every few seconds
    const ex = c + look.x * 56, ey = cy + look.y * 38 - 6, blink = !reduced && t % 4200 < 120 ? 0.15 : 1, vw = 92, vh = 40, k = 14
    b.globalAlpha = 1; b.fillStyle = 'rgba(2,6,10,.88)'; b.strokeStyle = col; b.lineWidth = 2
    b.beginPath(); b.moveTo(ex - vw + k, ey - vh); b.lineTo(ex + vw, ey - vh); b.lineTo(ex + vw, ey + vh - k); b.lineTo(ex + vw - k, ey + vh); b.lineTo(ex - vw, ey + vh); b.lineTo(ex - vw, ey - vh + k); b.closePath(); b.fill(); b.stroke()
    b.fillStyle = col; b.shadowColor = col; b.shadowBlur = 22
    for (const dx of [-32, 32]) b.fillRect(ex + dx - 12, ey - 13 * blink, 24, 26 * blink)
    b.shadowBlur = 0
    if (amp) {
      b.strokeStyle = col; b.lineWidth = 2.5; b.beginPath()
      for (let i = -40; i <= 40; i += 4) { const yy = ey + 27 + Math.sin(i / 6 + t / 50) * amp * 6; i === -40 ? b.moveTo(ex + i, yy) : b.lineTo(ex + i, yy) }
      b.stroke()
    }
  }

  /* ── door previews: console ECG, cabin corridor, library media bars ── */
  function drawDoors(t) {
    const tt = reduced ? 2600 : t
    let x = dc[0]
    if (x) {
      x.clearRect(0, 0, 192, 88); x.strokeStyle = OK; x.lineWidth = 2; x.shadowColor = OK; x.shadowBlur = 6; x.beginPath()
      for (let i = 0; i < 192; i++) {
        const p = ((i + tt / 8) % 96) / 96
        let y = 50
        if (p > 0.4 && p < 0.44) y = 50 - (p - 0.4) * 900
        else if (p >= 0.44 && p < 0.48) y = 14 + (p - 0.44) * 1500
        else if (p >= 0.48 && p < 0.5) y = 74 - (p - 0.48) * 1200
        i ? x.lineTo(i, y) : x.moveTo(i, y)
      }
      x.stroke(); x.shadowBlur = 0
    }
    x = dc[1]
    if (x) {
      x.clearRect(0, 0, 192, 88); x.strokeStyle = CY; x.lineWidth = 1.5
      for (let k = 0; k < 6; k++) { const z = ((k * 16 + tt / 30) % 96) / 96, s = 10 + z * 70; x.globalAlpha = z; x.strokeRect(150 - s / 2 - 40, 44 - s * 0.28, s, s * 0.56) }
      x.globalAlpha = 1
    }
    x = dc[2]
    if (x) {
      x.clearRect(0, 0, 192, 88)
      for (let k = 0; k < 3; k++) { const h = 20 + 14 * Math.sin(tt / 700 + k); x.fillStyle = [CY, OR, CYHI][k]; x.globalAlpha = 0.75; x.fillRect(110 + k * 26, 70 - h, 18, h) }
      x.globalAlpha = 1
    }
  }

  /* ── loop ── */
  let raf = 0, queued = false
  function frame(t, all) {
    if (all || !reduced) { drawBg(t); drawDoors(t) }
    drawBot(t)
  }
  function loop(t) { frame(t); raf = requestAnimationFrame(loop) }
  function queue() { if (!reduced || queued) return; queued = true; requestAnimationFrame((t) => { queued = false; drawBot(t) }) }

  let rs = 0
  addEventListener('resize', () => { clearTimeout(rs); rs = setTimeout(size, 120) })
  size()
  if (reduced) frame(performance.now(), true); else raf = requestAnimationFrame(loop)

  return {
    talk(on) { talking = !!on; queue() },
    /** a short brighter glow: VITA heard you */
    perk(ms = 600) { moodUntil = performance.now() + ms; queue(); if (reduced) setTimeout(queue, ms + 20) },
    stop() { cancelAnimationFrame(raf) },
  }
}
