/* ============================================================
   ASTRODOCX — Mission Briefing visuals (all procedural, no images)
     backdrop   the console's dawn horizon, twinkling stars and a
                slowly turning particle Earth limb
     VITA       a particle drone in the console's hologram style:
                a chamfered visor whose eyes follow the cursor, a HUD
                targeting ring, and a voice line while it talks
     doors      a live scene behind each door card (vitals monitor,
                station corridor, NASA media feed)
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
    sun = g.createRadialGradient(W * 0.7, H * 0.86, 0, W * 0.7, H * 0.86, W * 0.55); sun.addColorStop(0, 'rgba(255,140,70,.2)'); sun.addColorStop(1, 'rgba(255,140,70,0)')
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
    // shown small (the compact guide), thin lines vanish: thicken them by how much the canvas is scaled down
    const m = Math.min(3, Math.max(1, S / Math.max(1, bot.clientWidth * dpr))), G = 1.25

    // HUD ring: ticks + three counter-rotating arcs, like the console's gauges
    b.save(); b.translate(c, cy); b.strokeStyle = col; b.globalAlpha = 0.6; b.lineWidth = 1.5 * m
    b.beginPath()
    for (let i = 0; i < 72; i++) { const a = (i / 72) * Math.PI * 2, l = i % 6 ? 8 : 18; b.moveTo(Math.cos(a) * 236, Math.sin(a) * 236); b.lineTo(Math.cos(a) * (236 - l), Math.sin(a) * (236 - l)) }
    b.stroke()
    b.globalAlpha = 0.95; b.lineWidth = 3 * m; b.shadowColor = col; b.shadowBlur = 12 * m
    for (let k = 0; k < 3; k++) { const a0 = (spin / (1600 + k * 700)) * (k % 2 ? -1 : 1) + k * 2.1; b.beginPath(); b.arc(0, 0, 254 + k * 14, a0, a0 + 0.6 + amp * 0.5); b.stroke() }
    b.shadowBlur = 0; b.restore()

    b.save(); b.translate(c, cy); b.scale(G, G); b.translate(-c, -cy)   // body fills more of the canvas
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
      const s = (1.5 + d * 2.6) * Math.sqrt(m); b.fillRect(sx - s / 2, sy - s / 2, s, s)
    }

    // visor: chamfered like the console panels; the eyes blink every few seconds
    const ex = c + look.x * 56, ey = cy + look.y * 38 - 6, blink = !reduced && t % 4200 < 120 ? 0.15 : 1, vw = 92, vh = 40, k = 14
    b.globalAlpha = 1; b.fillStyle = 'rgba(2,6,10,.88)'; b.strokeStyle = col; b.lineWidth = 2 * m
    b.beginPath(); b.moveTo(ex - vw + k, ey - vh); b.lineTo(ex + vw, ey - vh); b.lineTo(ex + vw, ey + vh - k); b.lineTo(ex + vw - k, ey + vh); b.lineTo(ex - vw, ey + vh); b.lineTo(ex - vw, ey - vh + k); b.closePath(); b.fill(); b.stroke()
    b.fillStyle = col; b.shadowColor = col; b.shadowBlur = 22
    for (const dx of [-32, 32]) b.fillRect(ex + dx - 12, ey - 13 * blink, 24, 26 * blink)
    b.shadowBlur = 0
    if (amp) {
      b.strokeStyle = col; b.lineWidth = 2.5 * m; b.beginPath()
      for (let i = -40; i <= 40; i += 4) { const yy = ey + 27 + Math.sin(i / 6 + t / 50) * amp * 6; i === -40 ? b.moveTo(ex + i, yy) : b.lineTo(ex + i, yy) }
      b.stroke()
    }
    b.restore()
  }

  /* ── door scenes: each card's background says what is behind the door ──
     console  a crew vitals monitor: sweeping ECG, beating heart, HR / SpO2
     cabin    a station corridor rushing past, an astronaut floating in it
     library  photo, video and audio tiles drifting up like a media feed
     Drawn in CSS px across the whole card; CSS fades the left side so the
     card's text stays readable. */
  const dsz = doors.map(() => ({ w: 0, h: 0 }))
  function sizeDoors() {
    doors.forEach((c, k) => {
      const w = c.clientWidth, h = c.clientHeight
      if (!w || !h) return
      dsz[k] = { w, h }; c.width = Math.round(w * dpr); c.height = Math.round(h * dpr)
    })
    if (reduced) drawDoors(2600)
  }
  if ('ResizeObserver' in window) { const ro = new ResizeObserver(sizeDoors); doors.forEach((c) => ro.observe(c)) }

  function heart(x, cx, cy, s) {
    x.beginPath(); x.moveTo(cx, cy + s * 0.9)
    x.bezierCurveTo(cx - s * 1.5, cy - s * 0.1, cx - s * 0.8, cy - s * 1.2, cx, cy - s * 0.45)
    x.bezierCurveTo(cx + s * 0.8, cy - s * 1.2, cx + s * 1.5, cy - s * 0.1, cx, cy + s * 0.9); x.closePath()
  }
  function ecgY(p) {   // one beat, p in 0..1 -> offset in -1..1
    if (p > 0.30 && p < 0.36) return -Math.sin((p - 0.30) / 0.06 * Math.PI) * 0.12          // P wave
    if (p >= 0.40 && p < 0.42) return (p - 0.40) / 0.02 * 0.15                               // Q
    if (p >= 0.42 && p < 0.45) return 0.15 - (p - 0.42) / 0.03 * 1.15                         // R up
    if (p >= 0.45 && p < 0.48) return -1 + (p - 0.45) / 0.03 * 1.3                            // S down
    if (p >= 0.48 && p < 0.50) return 0.3 - (p - 0.48) / 0.02 * 0.3
    if (p > 0.58 && p < 0.70) return -Math.sin((p - 0.58) / 0.12 * Math.PI) * 0.22            // T wave
    return 0
  }
  function sceneConsole(x, w, h, t) {
    const beatMs = 900, ph = (t % beatMs) / beatMs
    // monitor grid on the right
    x.strokeStyle = CY; x.lineWidth = 1; x.globalAlpha = 0.10
    for (let gx = w * 0.4; gx < w; gx += 18) { x.beginPath(); x.moveTo(gx, 0); x.lineTo(gx, h); x.stroke() }
    for (let gy = 9; gy < h; gy += 18) { x.beginPath(); x.moveTo(w * 0.4, gy); x.lineTo(w, gy); x.stroke() }
    // scrolling ECG trace, in step with the heart
    const base = h * 0.6, amp = h * 0.24, period = 150, shift = (t / beatMs) * period
    x.lineWidth = 2; x.strokeStyle = OK; x.shadowColor = OK; x.shadowBlur = 8; x.globalAlpha = 0.95
    x.beginPath()
    for (let i = 0; i <= w; i += 1.5) { const y = base + ecgY((((i + shift) % period) + period) % period / period) * amp; i ? x.lineTo(i, y) : x.moveTo(i, y) }
    x.stroke(); x.shadowBlur = 0
    // beating heart + readouts
    const pulse = ph < 0.15 ? 1 + Math.sin(ph / 0.15 * Math.PI) * 0.18 : 1
    const hx = w * 0.86, hy = h * 0.3, hs = Math.min(18, h * 0.1) * pulse
    x.fillStyle = '#ff5a6a'; x.shadowColor = '#ff5a6a'; x.shadowBlur = 14; x.globalAlpha = 0.9
    heart(x, hx, hy, hs); x.fill(); x.shadowBlur = 0
    x.globalAlpha = 0.95; x.textAlign = 'right'; x.fillStyle = OK
    x.font = `700 ${Math.max(18, Math.round(h * 0.13))}px "JetBrains Mono", ui-monospace, monospace`
    x.fillText('72', w - 18, h * 0.88)
    x.font = `600 ${Math.max(10, Math.round(h * 0.055))}px "JetBrains Mono", ui-monospace, monospace`
    x.globalAlpha = 0.75; x.fillText('BPM', w - 18, h * 0.88 - Math.max(18, h * 0.13) - 2)
    x.fillStyle = CY; x.fillText('SpO₂ 98%', w * 0.74, h * 0.88)
    x.textAlign = 'left'
  }
  function sceneCabin(x, w, h, t) {
    const vx = w * 0.76, vy = h * 0.46, R = Math.max(w * 0.42, h * 0.9)
    const oct = (r) => { x.beginPath(); for (let k = 0; k < 8; k++) { const a = Math.PI / 8 + k * Math.PI / 4, px = vx + Math.cos(a) * r * 1.25, py = vy + Math.sin(a) * r * 0.78; k ? x.lineTo(px, py) : x.moveTo(px, py) } x.closePath() }
    // rails from the vanishing point
    x.strokeStyle = CY; x.lineWidth = 1; x.globalAlpha = 0.22
    for (let k = 0; k < 8; k++) { const a = Math.PI / 8 + k * Math.PI / 4; x.beginPath(); x.moveTo(vx, vy); x.lineTo(vx + Math.cos(a) * R * 1.25, vy + Math.sin(a) * R * 0.78); x.stroke() }
    // module rings rushing toward the viewer
    for (let k = 0; k < 7; k++) {
      const z = ((k / 7) + t / 9000) % 1, r = 4 + z * z * R
      x.globalAlpha = Math.min(1, z * 1.6) * 0.75; x.lineWidth = 0.6 + z * 2; oct(r); x.stroke()
      // a warm hatch light on each ring's floor
      x.fillStyle = OR; x.globalAlpha = z * 0.7; x.fillRect(vx - r * 0.18, vy + r * 0.74, r * 0.36, Math.max(1, r * 0.03))
    }
    // glow at the far end
    const gl = x.createRadialGradient(vx, vy, 0, vx, vy, h * 0.3); gl.addColorStop(0, 'rgba(159,244,255,.35)'); gl.addColorStop(1, 'rgba(159,244,255,0)')
    x.globalAlpha = 1; x.fillStyle = gl; x.fillRect(0, 0, w, h)
    // a floating astronaut
    const s = h / 200, ax = w * 0.74 + Math.sin(t / 2600) * 6 * s, ay = h * 0.52 + Math.sin(t / 1700) * 7 * s, rot = Math.sin(t / 3100) * 0.25
    x.save(); x.translate(ax, ay); x.rotate(rot); x.scale(s, s)
    x.strokeStyle = ICE; x.fillStyle = '#071a24'; x.lineWidth = 2.2; x.lineCap = 'round'; x.globalAlpha = 0.95
    x.beginPath(); x.moveTo(-8, -2); x.lineTo(-20, -14 + Math.sin(t / 900) * 3); x.moveTo(8, -2); x.lineTo(20, 6); x.stroke()      // arms
    x.beginPath(); x.moveTo(-5, 16); x.lineTo(-10, 34); x.moveTo(5, 16); x.lineTo(13, 32); x.stroke()                             // legs
    x.beginPath(); x.roundRect(-10, -8, 20, 26, 6); x.fill(); x.stroke()                                                          // torso
    x.beginPath(); x.roundRect(-15, -6, 6, 18, 2); x.fill(); x.stroke()                                                            // backpack
    x.beginPath(); x.arc(0, -18, 10, 0, 7); x.fill(); x.stroke()                                                                    // helmet
    x.fillStyle = OR; x.globalAlpha = 0.85; x.beginPath(); x.ellipse(2.5, -18, 6, 4.2, 0, 0, 7); x.fill()                          // visor
    x.restore()
  }
  function sceneLibrary(x, w, h, t) {
    const tw = Math.max(54, Math.min(w * 0.2, h * 0.5)), th = tw * 0.66, gap = 12, cols = [w - tw * 2 - gap - 16, w - tw - 16]
    const span = (th + gap) * 3
    x.lineWidth = 1.5
    for (let c = 0; c < 2; c++) for (let k = 0; k < 4; k++) {
      const kind = (k + c * 2) % 3
      let y = ((k * (th + gap) - t / (c ? 60 : 85) + (c ? th / 2 : 0)) % span + span) % span - th
      const x0 = cols[c]
      x.globalAlpha = 0.9; x.fillStyle = 'rgba(6,24,34,.85)'; x.strokeStyle = kind === 1 ? OR : CY
      x.beginPath(); x.roundRect(x0, y, tw, th, 5); x.fill(); x.stroke()
      x.save(); x.beginPath(); x.roundRect(x0, y, tw, th, 5); x.clip()
      if (kind === 0) {          // NASA image: a planet over a horizon
        x.fillStyle = CY; x.globalAlpha = 0.35; x.beginPath(); x.moveTo(x0, y + th); x.lineTo(x0 + tw * 0.35, y + th * 0.55); x.lineTo(x0 + tw * 0.6, y + th * 0.8); x.lineTo(x0 + tw * 0.8, y + th * 0.6); x.lineTo(x0 + tw, y + th); x.fill()
        x.globalAlpha = 0.9; x.fillStyle = CYHI; x.beginPath(); x.arc(x0 + tw * 0.72, y + th * 0.3, th * 0.13, 0, 7); x.fill()
      } else if (kind === 1) {   // video: play button + progress bar
        x.fillStyle = OR; x.globalAlpha = 0.95; const cx = x0 + tw / 2, cy = y + th * 0.45, r = th * 0.18
        x.beginPath(); x.moveTo(cx - r * 0.7, cy - r); x.lineTo(cx + r, cy); x.lineTo(cx - r * 0.7, cy + r); x.closePath(); x.fill()
        x.globalAlpha = 0.35; x.fillRect(x0 + 8, y + th - 10, tw - 16, 3); x.globalAlpha = 0.95; x.fillRect(x0 + 8, y + th - 10, (tw - 16) * ((t / 6000 + k * 0.3) % 1), 3)
      } else {                   // audio: live waveform
        x.fillStyle = CYHI; x.globalAlpha = 0.85
        const n = 11, bw = (tw - 20) / n
        for (let i = 0; i < n; i++) { const a = (0.25 + 0.75 * Math.abs(Math.sin(t / 260 + i * 0.9 + k))) * th * 0.5; x.fillRect(x0 + 10 + i * bw, y + th / 2 - a / 2, bw * 0.55, a) }
      }
      x.restore()
    }
  }
  function drawDoors(t) {
    const tt = reduced ? 2600 : t, scenes = [sceneConsole, sceneCabin, sceneLibrary]
    dc.forEach((x, k) => {
      const { w, h } = dsz[k]
      if (!w) return
      x.setTransform(dpr, 0, 0, dpr, 0, 0); x.clearRect(0, 0, w, h)
      x.save(); scenes[k](x, w, h, tt); x.restore(); x.globalAlpha = 1; x.shadowBlur = 0
    })
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
  size(); sizeDoors()
  if (reduced) frame(performance.now(), true); else raf = requestAnimationFrame(loop)

  return {
    talk(on) { talking = !!on; queue() },
    /** a short brighter glow: VITA heard you */
    perk(ms = 600) { moodUntil = performance.now() + ms; queue(); if (reduced) setTimeout(queue, ms + 20) },
    stop() { cancelAnimationFrame(raf) },
  }
}
