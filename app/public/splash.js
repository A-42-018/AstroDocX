/* AstroDocX launch screen — shown between the landing page and the Crew Console while the console boots.
   Plain script (no bundler) so it runs before the React bundle has even downloaded. Everything moving is drawn
   live: a procedural nebula, twinkling stars and constellations, and a rotating night-lit Earth wrapped in a
   network of comms arcs. Progress is real: the app reports each boot stage through window.adxSplash
   (see src/shell/splash.ts); the screen never waits on anything else, and a hard timeout always lets the crew in. */
(function () {
  var root = document.documentElement
  var el = document.getElementById('adx-splash')
  if (!el) { root.classList.remove('adx-launching'); return }
  if (root.classList.contains('adx-embed')) { el.remove(); return } // a cabin wall screen: no launch screen

  var REDUCE = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  var MIN_MS = REDUCE ? 400 : 1800   // long enough to read the sequence, short enough not to feel like a toll
  var MAX_MS = 20000                 // a stuck boot must never trap the crew behind the screen
  var STEP_GAP = REDUCE ? 0 : 320    // stagger check-marks so a cached, instant boot still reads as a sequence
  var STEPS = ['systems', 'data', 'telemetry', 'deploy']
  var WEIGHT = { systems: 0.25, data: 0.45, telemetry: 0.15, deploy: 0.15 }

  var t0 = performance.now()
  var reached = {}, shown = {}, queue = [], lastShown = 0, seedFrac = 0
  var display = 0, closing = false, finished = false, running = true
  var fill = el.querySelector('.sp-fill'), pct = el.querySelector('.sp-pct'), word = el.querySelector('.sp-word')
  var warp0 = 0, warpX = 0, warpY = 0
  var items = {}
  STEPS.forEach(function (s) { items[s] = el.querySelector('[data-step="' + s + '"]') })

  function reach(step) {
    if (reached[step]) return
    reached[step] = true
    queue.push(step)
    if (step === 'data' && reached.ready) fontsThenTelemetry()
  }
  function fontsThenTelemetry() {
    var go = function () { reach('telemetry'); reach('deploy') }
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(go, go); else go()
  }

  window.adxSplash = {
    mark: reach,
    /** demo seeding progress, 0..1 */
    seed: function (f) { seedFrac = Math.max(seedFrac, Math.min(1, f || 0)) },
    /** the board has rendered its first frame */
    ready: function () { reached.ready = true; if (reached.data) fontsThenTelemetry() },
  }
  setTimeout(function () { reached.ready = true; STEPS.forEach(reach) }, MAX_MS)

  function target() {
    var t = 0
    STEPS.forEach(function (s) { if (shown[s]) t += WEIGHT[s] })
    if (!shown.data) t += WEIGHT.data * seedFrac * 0.95
    return t
  }

  function tickProgress(now) {
    if (queue.length && now - lastShown >= STEP_GAP) {
      var s = queue.shift(); shown[s] = true; lastShown = now
      if (items[s]) { items[s].classList.remove('on'); items[s].classList.add('ok') }
    }
    var next = STEPS.filter(function (s) { return !shown[s] })[0]
    STEPS.forEach(function (s) { if (items[s]) items[s].classList.toggle('on', s === next) })

    var goal = target()
    display += (goal - display) * (REDUCE ? 1 : 0.08)
    if (goal - display < 0.002) display = goal
    fill.style.strokeDashoffset = String(100 - display * 100)
    pct.textContent = ('00' + Math.round(display * 100)).slice(-3) + '%'
    var label = shown.deploy ? 'LAUNCHING' : 'INITIALIZING'
    if (word.textContent !== label) word.textContent = label

    if (!closing && shown.deploy && display >= 0.999 && now - t0 >= MIN_MS) close()
  }

  function close() {
    closing = true
    // warp toward the orb: the stars streak past while the stage falls away, then the window dissolves into the console
    var orb = el.querySelector('.sp-orb').getBoundingClientRect()
    warpX = orb.left + orb.width / 2; warpY = orb.top + orb.height / 2; warp0 = performance.now()
    el.classList.add('is-go')
    setTimeout(function () {
      el.classList.add('is-done')
      root.classList.remove('adx-launching')
      setTimeout(function () {
        running = false; finished = true
        if (el.parentNode) el.parentNode.removeChild(el)
        delete window.adxSplash
        window.dispatchEvent(new Event('adx:launched'))
      }, REDUCE ? 260 : 720)
    }, REDUCE ? 0 : 650)
  }

  /* ───────────────────────────── scene ───────────────────────────── */
  var cv = el.querySelector('canvas'), ctx = cv.getContext('2d')
  var W = 0, H = 0, DPR = 1, nebula = null, stars = [], earth = null
  function rng(seed) { return function () { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; var t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296 } }

  function buildNebula() {
    var s = 0.5, c = document.createElement('canvas')
    c.width = Math.max(1, Math.round(W * s)); c.height = Math.max(1, Math.round(H * s))
    var g = c.getContext('2d'), r = rng(7), m = Math.min(c.width, c.height), i, a
    g.globalCompositeOperation = 'lighter'
    function blob(x, y, rad, rgb, al) {
      var gr = g.createRadialGradient(x, y, 0, x, y, rad)
      gr.addColorStop(0, 'rgba(' + rgb + ',' + al + ')'); gr.addColorStop(1, 'rgba(' + rgb + ',0)')
      g.fillStyle = gr; g.beginPath(); g.arc(x, y, rad, 0, 6.2832); g.fill()
    }
    // left: a swirling teal/violet vortex
    var cx = c.width * 0.27, cy = c.height * 0.48
    for (i = 0; i < 90; i++) {
      a = i / 90 * 9.5
      var rr = m * (0.04 + 0.034 * a) * (0.85 + r() * 0.3)
      var x = cx + Math.cos(a) * rr * 1.25, y = cy + Math.sin(a) * rr
      blob(x, y, m * (0.03 + r() * 0.09), r() < 0.55 ? '40,150,170' : (r() < 0.6 ? '90,85,170' : '60,95,160'), 0.13 + r() * 0.13)
    }
    // right: a long diagonal stream of violet, teal and gold filaments
    for (i = 0; i < 110; i++) {
      var t = r(), w = Math.sin(t * 9 + 1.3) * 0.06
      var bx = c.width * (0.6 + 0.38 * t + w), by = c.height * (0.95 - 0.95 * t + w * 0.6)
      var pick = r()
      blob(bx + (r() - 0.5) * m * 0.12, by + (r() - 0.5) * m * 0.12, m * (0.025 + r() * 0.08),
        pick < 0.35 ? '95,85,175' : pick < 0.7 ? '40,155,170' : pick < 0.9 ? '190,120,60' : '120,90,160', 0.12 + r() * 0.13)
    }
    // a faint bridge between the two so the sky reads as one field
    for (i = 0; i < 26; i++) blob(c.width * (0.35 + r() * 0.3), c.height * (0.1 + r() * 0.8), m * (0.05 + r() * 0.12), r() < 0.5 ? '60,60,130' : '30,100,120', 0.03 + r() * 0.03)
    // grain the gas a little with darker pockets
    g.globalCompositeOperation = 'destination-out'
    for (i = 0; i < 60; i++) blob(r() * c.width, r() * c.height, m * (0.015 + r() * 0.05), '0,0,0', 0.15 + r() * 0.2)
    nebula = c
  }

  function buildStars() {
    var r = rng(42), n = Math.round(Math.min(700, W * H / 2600)), i
    stars = []
    for (i = 0; i < n; i++) stars.push({ x: r() * W, y: r() * H, r: r() < 0.93 ? 0.4 + r() * 0.8 : 1.2 + r() * 1.2, a: 0.3 + r() * 0.7, p: r() * 6.28, s: 0.6 + r() * 2.2, warm: r() < 0.15 })
  }

  // constellations as normalised screen coordinates
  var CONST = [
    [[0.06, 0.24], [0.11, 0.2], [0.16, 0.23], [0.2, 0.17], [0.16, 0.12]],
    [[0.12, 0.6], [0.17, 0.66], [0.15, 0.72], [0.21, 0.74], [0.26, 0.7]],
    [[0.8, 0.12], [0.85, 0.08], [0.91, 0.11], [0.88, 0.18], [0.94, 0.22]],
    [[0.7, 0.48], [0.75, 0.42], [0.82, 0.45], [0.86, 0.39]],
    [[0.32, 0.86], [0.36, 0.8], [0.42, 0.83]],
  ]

  function buildEarth() {
    // random (not lattice) points read as the same particle cloud the landing page is built from
    var r = rng(11), land = [], sea = [], nodes = [], edges = [], i, j
    function isLand(lat, lon) {
      var v = Math.sin(lon * 1.7 + 1.1) * Math.cos(lat * 2.1) + 0.55 * Math.sin(lon * 3.9 + lat * 2.3 + 0.7) + 0.35 * Math.cos(lat * 6.1 - lon * 2.7) + 0.2 * Math.sin(lon * 9 + lat * 7)
      return v > 0.2 && Math.abs(lat) < 1.3
    }
    while (land.length < 14000) {
      var y = r() * 2 - 1, rad = Math.sqrt(1 - y * y), th = r() * 6.2832
      var p = [Math.cos(th) * rad, y, Math.sin(th) * rad]
      if (isLand(Math.asin(y), th > Math.PI ? th - 6.2832 : th)) land.push(p)
      else if (sea.length < 3000 && r() < 0.1) sea.push(p)
    }
    while (nodes.length < 24) nodes.push(land[Math.floor(r() * land.length)])
    for (i = 0; i < nodes.length; i++) for (j = i + 1; j < nodes.length; j++) {
      var dot = nodes[i][0] * nodes[j][0] + nodes[i][1] * nodes[j][1] + nodes[i][2] * nodes[j][2]
      if (dot > 0.35 && dot < 0.93 && r() < 0.55) edges.push([nodes[i], nodes[j], r()])
    }
    earth = { land: land, sea: sea, nodes: nodes, edges: edges }
  }

  function resize() {
    DPR = Math.min(2, window.devicePixelRatio || 1)
    W = window.innerWidth; H = window.innerHeight
    cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR)
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0)
    buildNebula(); buildStars()
    if (REDUCE) draw(performance.now())
  }

  function rot(p, ry, tilt) {
    var c = Math.cos(ry), s = Math.sin(ry)
    var x = p[0] * c + p[2] * s, z = -p[0] * s + p[2] * c, y = p[1]
    var ct = Math.cos(tilt), st = Math.sin(tilt)
    return [x, y * ct - z * st, y * st + z * ct]
  }

  function drawEarth(t) {
    var portrait = H > W
    var R = portrait ? W * 0.5 : Math.min(W, H) * 0.36
    var cx = portrait ? W * 0.95 : W - R * 0.3, cy = portrait ? H + R * 0.2 : H - R * 0.22
    var ry = -1.75 + t * 0.00004, tilt = 0.38 // start with the big landmass facing the viewer
    var L = [-0.62, 0.52, 0.58] // sun from the upper left, so the limb facing the screen centre is lit

    // faint atmosphere and a dark body, so the particles carry the shape
    var ag = ctx.createRadialGradient(cx, cy, R * 0.96, cx, cy, R * 1.18)
    ag.addColorStop(0, 'rgba(90,200,235,.22)'); ag.addColorStop(0.4, 'rgba(45,140,200,.07)'); ag.addColorStop(1, 'rgba(45,140,200,0)')
    ctx.fillStyle = ag; ctx.beginPath(); ctx.arc(cx, cy, R * 1.18, 0, 6.2832); ctx.fill()
    var og = ctx.createRadialGradient(cx - R * 0.45, cy - R * 0.4, R * 0.05, cx, cy, R)
    og.addColorStop(0, '#0b1726'); og.addColorStop(0.7, '#050a14'); og.addColorStop(1, '#02040a')
    ctx.fillStyle = og; ctx.beginPath(); ctx.arc(cx, cy, R, 0, 6.2832); ctx.fill()

    ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, R, 0, 6.2832); ctx.clip()
    ctx.strokeStyle = 'rgba(160,220,255,.05)'; ctx.lineWidth = 0.7
    var k, a, q, started
    for (k = -60; k <= 60; k += 30) {
      ctx.beginPath(); started = false
      var la = k * Math.PI / 180
      for (a = 0; a <= 64; a++) {
        q = rot([Math.cos(la) * Math.cos(a / 64 * 6.2832), Math.sin(la), Math.cos(la) * Math.sin(a / 64 * 6.2832)], ry, tilt)
        if (q[2] < 0) { started = false; continue }
        if (started) ctx.lineTo(cx + q[0] * R, cy - q[1] * R); else { ctx.moveTo(cx + q[0] * R, cy - q[1] * R); started = true }
      }
      ctx.stroke()
    }
    ctx.restore()

    // particles: day-side land bright ice-white, night-side land as sparse amber city lights, oceans a faint cyan haze
    var i, lit, f, sz = Math.max(1, R / 320)
    ctx.fillStyle = '#dcf2ff'
    for (i = 0; i < earth.land.length; i++) {
      q = rot(earth.land[i], ry, tilt)
      if (q[2] <= 0) continue
      lit = q[0] * L[0] + q[1] * L[1] + q[2] * L[2]
      if (lit <= 0.02) continue
      f = 0.3 + 0.7 * q[2]
      ctx.globalAlpha = Math.min(1, (0.2 + lit * 0.85) * f)
      ctx.fillRect(cx + q[0] * R, cy - q[1] * R, sz, sz)
    }
    ctx.fillStyle = '#ffb870'
    for (i = 0; i < earth.land.length; i += 3) {
      q = rot(earth.land[i], ry, tilt)
      if (q[2] <= 0) continue
      lit = q[0] * L[0] + q[1] * L[1] + q[2] * L[2]
      if (lit > 0.02) continue
      ctx.globalAlpha = (0.25 + 0.55 * Math.abs(Math.sin(i * 12.9898 + t * 0.0015))) * Math.min(1, q[2] * 3)
      ctx.fillRect(cx + q[0] * R, cy - q[1] * R, sz * 1.2, sz * 1.2)
    }
    ctx.fillStyle = '#5ab4dc'
    for (i = 0; i < earth.sea.length; i++) {
      q = rot(earth.sea[i], ry, tilt)
      if (q[2] <= 0) continue
      lit = Math.max(0, q[0] * L[0] + q[1] * L[1] + q[2] * L[2])
      ctx.globalAlpha = (0.08 + lit * 0.3) * (0.3 + 0.7 * q[2])
      ctx.fillRect(cx + q[0] * R, cy - q[1] * R, sz, sz)
    }
    ctx.globalAlpha = 1
    // crisp lit rim
    var rg = ctx.createLinearGradient(cx - R, cy - R, cx + R * 0.4, cy + R * 0.4)
    rg.addColorStop(0, 'rgba(140,230,255,.7)'); rg.addColorStop(1, 'rgba(140,230,255,.04)')
    ctx.strokeStyle = rg; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(cx, cy, R, 0, 6.2832); ctx.stroke()

    // comms network: arcs lifted off the surface with data packets travelling along them
    ctx.lineWidth = 1
    for (i = 0; i < earth.edges.length; i++) {
      var e = earth.edges[i], A = e[0], B = e[1], pts = [], s
      for (s = 0; s <= 20; s++) {
        var u = s / 20, lift = 1 + 0.12 * Math.sin(Math.PI * u)
        var px = A[0] * (1 - u) + B[0] * u, py = A[1] * (1 - u) + B[1] * u, pz = A[2] * (1 - u) + B[2] * u
        var n = Math.sqrt(px * px + py * py + pz * pz)
        pts.push(rot([px / n * lift, py / n * lift, pz / n * lift], ry, tilt))
      }
      ctx.strokeStyle = 'rgba(110,235,250,.26)'; ctx.beginPath(); started = false
      for (s = 0; s < pts.length; s++) {
        q = pts[s]
        var hidden = q[2] < 0 && q[0] * q[0] + q[1] * q[1] < 1
        if (hidden) { started = false; continue }
        if (started) ctx.lineTo(cx + q[0] * R, cy - q[1] * R); else { ctx.moveTo(cx + q[0] * R, cy - q[1] * R); started = true }
      }
      ctx.stroke()
      var pk = pts[Math.floor(((t * 0.00025 + e[2]) % 1) * 20)]
      if (pk && !(pk[2] < 0 && pk[0] * pk[0] + pk[1] * pk[1] < 1)) {
        ctx.fillStyle = 'rgba(210,255,255,.95)'; ctx.beginPath(); ctx.arc(cx + pk[0] * R, cy - pk[1] * R, 1.6, 0, 6.2832); ctx.fill()
      }
    }
    for (i = 0; i < earth.nodes.length; i++) {
      q = rot(earth.nodes[i], ry, tilt)
      if (q[2] < 0.05) continue
      var pr = 2 + Math.sin(t * 0.004 + i) * 0.8
      ctx.fillStyle = 'rgba(45,212,232,.25)'; ctx.beginPath(); ctx.arc(cx + q[0] * R, cy - q[1] * R, pr * 2.4, 0, 6.2832); ctx.fill()
      ctx.fillStyle = '#c9fbff'; ctx.beginPath(); ctx.arc(cx + q[0] * R, cy - q[1] * R, pr * 0.7, 0, 6.2832); ctx.fill()
    }
  }

  function draw(t) {
    ctx.fillStyle = '#02030a'; ctx.fillRect(0, 0, W, H)
    var vg = ctx.createRadialGradient(W * 0.5, H * 0.45, 0, W * 0.5, H * 0.45, Math.max(W, H) * 0.7)
    vg.addColorStop(0, '#080a12'); vg.addColorStop(1, '#02030a')
    ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H)
    // nebula drifts and breathes slowly
    var wp = warp0 ? Math.min(1, (t - warp0) / 900) : 0, we = wp * wp
    var dx = Math.sin(t * 0.00009) * 14, dy = Math.cos(t * 0.00007) * 10, sc = 1.06 + Math.sin(t * 0.00011) * 0.02
    ctx.globalAlpha = 0.42 * (1 - we)
    ctx.globalCompositeOperation = 'lighter'
    ctx.drawImage(nebula, (W - W * sc) / 2 + dx, (H - H * sc) / 2 + dy, W * sc, H * sc)
    ctx.globalAlpha = 1
    ctx.globalCompositeOperation = 'source-over'
    // stars
    var i, s, a
    if (wp) { drawEarth(t); ctx.fillStyle = 'rgba(2,3,10,' + Math.min(1, we * 1.4) + ')'; ctx.fillRect(0, 0, W, H); drawWarp(we); return }
    for (i = 0; i < stars.length; i++) {
      s = stars[i]; a = s.a * (0.55 + 0.45 * Math.sin(t * 0.001 * s.s + s.p))
      ctx.fillStyle = s.warm ? 'rgba(255,225,190,' + a + ')' : 'rgba(225,240,255,' + a + ')'
      ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, 6.2832); ctx.fill()
      if (s.r > 1.6) { ctx.fillStyle = 'rgba(200,240,255,' + a * 0.15 + ')'; ctx.beginPath(); ctx.arc(s.x, s.y, s.r * 4, 0, 6.2832); ctx.fill() }
    }
    // constellations fade in and out one after another
    for (i = 0; i < CONST.length; i++) {
      var c = CONST[i], al = 0.12 + 0.18 * (0.5 + 0.5 * Math.sin(t * 0.0006 + i * 1.7)), j
      ctx.strokeStyle = 'rgba(190,225,255,' + al + ')'; ctx.lineWidth = 0.8; ctx.beginPath()
      for (j = 0; j < c.length; j++) { var X = c[j][0] * W, Y = c[j][1] * H; if (j) ctx.lineTo(X, Y); else ctx.moveTo(X, Y) }
      ctx.stroke()
      ctx.fillStyle = 'rgba(235,248,255,' + (al * 3.5) + ')'
      for (j = 0; j < c.length; j++) { ctx.beginPath(); ctx.arc(c[j][0] * W, c[j][1] * H, 1.5, 0, 6.2832); ctx.fill() }
    }
    drawEarth(t)
  }

  function drawWarp(e) {
    var i, s, dx, dy
    ctx.lineCap = 'round'
    for (i = 0; i < stars.length; i++) {
      s = stars[i]; dx = s.x - warpX; dy = s.y - warpY
      ctx.strokeStyle = s.warm ? 'rgba(255,225,190,' + Math.min(1, s.a * (0.7 + e)) + ')' : 'rgba(200,240,255,' + Math.min(1, s.a * (0.7 + e)) + ')'
      ctx.lineWidth = s.r * (1 + e * 1.6)
      ctx.beginPath(); ctx.moveTo(warpX + dx * (1 + e * 0.35), warpY + dy * (1 + e * 0.35)); ctx.lineTo(warpX + dx * (1 + e * 2.6), warpY + dy * (1 + e * 2.6)); ctx.stroke()
    }
    var fl = ctx.createRadialGradient(warpX, warpY, 0, warpX, warpY, Math.max(W, H) * (0.15 + e * 0.5))
    fl.addColorStop(0, 'rgba(210,250,255,' + 0.55 * e + ')'); fl.addColorStop(0.35, 'rgba(45,212,232,' + 0.18 * e + ')'); fl.addColorStop(1, 'rgba(45,212,232,0)')
    ctx.fillStyle = fl; ctx.fillRect(0, 0, W, H)
  }

  function frame(now) {
    if (!running) return
    tickProgress(now)
    if (!REDUCE) draw(now)
    requestAnimationFrame(frame)
  }

  buildEarth(); resize()
  window.addEventListener('resize', function () { if (!finished) resize() })
  requestAnimationFrame(frame)
})()
