/* ============================================================
   ASTRODOCX — Mission Briefing "cosmos"
     blobs      slow-morphing voids on the page edges, full of stars,
                drawn on the backdrop canvas by vita.js (same loop)
     figures    engraving-style line art (art.js) floating over them
     hotspots   a pulsing reticle on each hazard figure, plus a R-I-D-G-E
                row in the top bar so the facts stay reachable when the
                panels leave no room for a hotspot
     reveal     a hotspot swallows the screen: its blob grows until it
                covers everything, a NASA fact appears on the void, and
                closing shrinks it back (the "mystery" interaction)
   Fact text and sources come from landing/vita/faq.json (via getFact),
   so there is one source of truth and the citations are already tested.
   Reduced motion: blobs drawn once and still, no float or parallax,
   the reveal is an instant cross-fade.
============================================================ */
import { ART } from './art.js'

const CY = '54,226,245'
const VOID = '#010306'

/* the five hazards, in NASA's RIDGE order */
const HAZ = [
  { id: 'radiation', letter: 'R', name: 'Radiation', faq: 'radiation', head: 'What gets through the hull?', q: 'What does radiation do to astronauts?',
    fallback: 'Beyond Earth’s protection, galactic cosmic rays and solar storms raise cancer risk and can affect the brain. NASA tracks every dose against a career limit.' },
  { id: 'isolation', letter: 'I', name: 'Isolation', faq: 'isolation', head: 'What do months alone do to a crew?', q: 'How does isolation affect a crew’s mood?',
    fallback: 'Long missions in a small crew, far from Earth, strain sleep, mood and performance. NASA studies how to keep crews well.' },
  { id: 'distance', letter: 'D', name: 'Distance', faq: 'distance', head: 'Who helps when Earth is minutes away?', q: 'How does the communication delay affect the crew?',
    fallback: 'Far from Earth, help and supplies are hard to get, so the crew has to handle problems on board.' },
  { id: 'gravity', letter: 'G', name: 'Gravity', faq: 'bone', head: 'Why do bones thin in orbit?', q: 'Show me bone loss in space',
    fallback: 'In space, weight-bearing bones lose roughly 1% of their density per month. Daily exercise is how crews fight it.' },
  { id: 'environment', letter: 'E', name: 'Environment', faq: 'co2', head: 'Why does the cabin air need watching?', q: 'How do you catch a CO₂ fault?',
    fallback: 'NASA-STD-3001 limits habitat CO₂. Small rises cause headaches and slow thinking, so they are worth catching early.' },
]
const FALLBACK_CITE = [{ label: 'NASA HRP · hazards', url: 'https://www.nasa.gov/hrp/hazards/' }]

/* figures: x/y are viewport fractions, w is in "u" (1u = 1% of min(width, 1.5 × height)).
   `hz` makes a figure a hazard hotspot; the others are decoration. `ph` keeps it on phones. */
const FIGS = [
  { art: 'planet',    hz: 'distance',    x: 0.935, y: 0.21, w: 14,   dur: 9,  r: 3,  par: 10, ph: true },
  { art: 'astronaut', hz: 'gravity',     x: 0.945, y: 0.58, w: 9.5,  dur: 11, r: 5,  par: 16, ph: true },
  { art: 'moon',                         x: 0.935, y: 0.91, w: 8.5,  dur: 13, r: 2,  par: 8 },
  { art: 'sun',       hz: 'radiation',   x: 0.06,  y: 0.31, w: 12,   dur: 12, r: 4,  par: 9 },
  { art: 'capsule',   hz: 'isolation',   x: 0.06,  y: 0.575, w: 11,  dur: 10, r: 4,  par: 13 },
  { art: 'module',    hz: 'environment', x: 0.07,  y: 0.85, w: 13,   dur: 14, r: 2,  par: 8 },
]

/* blobs: x/y are viewport fractions, r is in u. Several overlap on purpose: they merge. */
const BLOBS = [
  { x: 0.97, y: 0.10, r: 15, ph: true },
  { x: 1.0,  y: 0.62, r: 13 },
  { x: 0.0,  y: 0.30, r: 12 },
  { x: 0.0,  y: 0.58, r: 11 },
  { x: 0.02, y: 0.98, r: 13, ph: true },
  { x: 0.97, y: 0.99, r: 12 },
]

function rng(seed) {
  return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
}

const rand = rng(41)
for (const b of BLOBS) {
  b.k = 1; b.kt = 1
  b.h = [[2, 0.11], [3, 0.07], [5, 0.045]].map(([n, a]) => ({ n, a, p: rand() * 6.28, w: (0.00018 + rand() * 0.00022) * (rand() < 0.5 ? -1 : 1) }))
}
const STARS = Array.from({ length: 520 }, () => ({ x: rand(), y: rand(), r: 0.6 + rand() * 1.3, t: rand() * 6.28, sp: rand() < 0.07 }))

/** smooth closed blob: polar curve with a few wandering harmonics, drawn through midpoints */
function blobPath(c, cx, cy, R, b, t, ampMul = 1) {
  const N = 64, pts = []
  for (let i = 0; i < N; i++) {
    const th = (i / N) * Math.PI * 2
    let s = 1
    for (const h of b.h) s += h.a * ampMul * Math.sin(h.n * th + h.p + h.w * t)
    pts.push([cx + Math.cos(th) * R * s, cy + Math.sin(th) * R * s])
  }
  const mid = (p, q) => [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2]
  const m0 = mid(pts[N - 1], pts[0])
  c.moveTo(m0[0], m0[1])
  for (let i = 0; i < N; i++) { const m = mid(pts[i], pts[(i + 1) % N]); c.quadraticCurveTo(pts[i][0], pts[i][1], m[0], m[1]) }
  c.closePath()
}

/** rims glow outside, then the union of the shapes is filled and clipped so stars sit only inside the void */
function paintField(c, items, t, W, H, dpr, reduced) {
  c.save()
  c.lineJoin = 'round'; c.lineWidth = 2.4 * dpr; c.strokeStyle = `rgba(${CY},.55)`; c.shadowColor = `rgba(${CY},.9)`; c.shadowBlur = 14 * dpr
  for (const it of items) { c.beginPath(); blobPath(c, it.cx, it.cy, it.R, it.b, t, it.amp); c.stroke() }
  c.shadowBlur = 0
  c.beginPath()
  for (const it of items) blobPath(c, it.cx, it.cy, it.R, it.b, t, it.amp)
  c.fillStyle = VOID; c.fill(); c.clip()
  let g = c.createRadialGradient(W * 0.15, H * 0.5, 0, W * 0.15, H * 0.5, W * 0.5); g.addColorStop(0, `rgba(${CY},.09)`); g.addColorStop(1, `rgba(${CY},0)`)
  c.fillStyle = g; c.fillRect(0, 0, W, H)
  g = c.createRadialGradient(W * 0.88, H * 0.35, 0, W * 0.88, H * 0.35, W * 0.45); g.addColorStop(0, 'rgba(255,138,61,.07)'); g.addColorStop(1, 'rgba(255,138,61,0)')
  c.fillStyle = g; c.fillRect(0, 0, W, H)
  c.fillStyle = '#d6eefa'
  for (const s of STARS) {
    const a = reduced ? 0.7 : 0.35 + 0.55 * Math.abs(Math.sin(t / 1100 + s.t)), x = s.x * W, y = s.y * H
    c.globalAlpha = a
    if (s.sp) {
      const z = (3.2 + s.r * 2.4) * dpr * (reduced ? 1 : 0.75 + 0.25 * Math.sin(t / 700 + s.t))
      c.beginPath(); c.moveTo(x, y - z); c.quadraticCurveTo(x, y, x + z, y); c.quadraticCurveTo(x, y, x, y + z); c.quadraticCurveTo(x, y, x - z, y); c.quadraticCurveTo(x, y, x, y - z); c.fill()
    } else { const d = s.r * dpr; c.fillRect(x, y, d, d) }
  }
  c.restore()
}

const ease = (p) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2)
const esc = (s) => String(s).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]))
const em = (s) => esc(s).replace(/&lt;(\/?)em&gt;/g, '<$1em>')   // facts may emphasise with <em>, nothing else
const httpUrl = (u) => { try { const x = new URL(u); return x.protocol === 'https:' || x.protocol === 'http:' ? x.href : '' } catch { return '' } }

export function createCosmos({ artLayer, spotLayer, revealCanvas, dock, frame, reduced = false, sound, onAsk, getFact }) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  const rc = revealCanvas.getContext('2d')
  // slower devices (perf.js): the reveal's rim draws without its canvas glow, the costliest part of it
  if ((window.ADX_PERF || {}).tier === 'low') Object.defineProperty(rc, 'shadowBlur', { configurable: true, get: () => 0, set: () => {} })
  const NS = 'http://www.w3.org/2000/svg'
  let W = innerWidth, H = innerHeight, u = 10, phone = false

  /* ── figures + hotspots ── */
  const figs = FIGS.map((f) => {
    const el = document.createElement('div'); el.className = 'cz-fig'; el.dataset.art = f.art
    el.style.setProperty('--dur', f.dur + 's'); el.style.setProperty('--r', f.r + 'deg'); el.style.setProperty('--par', f.par)
    el.innerHTML = ART[f.art].svg
    const svg = el.firstElementChild
    const spec = ART[f.art].spot
    let anchor = null
    if (f.hz && spec) { anchor = document.createElementNS(NS, 'circle'); anchor.setAttribute('cx', spec[0]); anchor.setAttribute('cy', spec[1]); anchor.setAttribute('r', 1); anchor.setAttribute('fill', 'none'); anchor.setAttribute('stroke', 'none'); svg.appendChild(anchor) }
    artLayer.appendChild(el)
    let spot = null
    if (anchor) {
      const h = HAZ.find((z) => z.id === f.hz)
      spot = document.createElement('button'); spot.type = 'button'; spot.className = 'cz-spot'; spot.dataset.hz = h.id
      spot.setAttribute('aria-label', `${h.name} hazard: open the NASA fact`)
      spot.innerHTML = `<span class="lb" aria-hidden="true">${h.name}</span>`
      spot.hidden = true
      spotLayer.appendChild(spot)
    }
    return { f, el, svg, anchor, spot, x: -999, y: -999 }
  })

  const dockBtns = dock ? [...dock.querySelectorAll('[data-hz]')] : []

  const UI = ['.topbar', '#bot', '.guide-headline', '.guide .meta', '.chat', '.door', '.statusbar']
  function layout() {
    W = innerWidth; H = innerHeight; u = Math.min(W, H * 1.5) / 100; phone = W <= 760
    const sc = phone ? 0.62 : 1
    for (const g of figs) {
      const on = !phone || g.f.ph
      g.el.hidden = !on
      g.el.style.left = g.f.x * W + 'px'; g.el.style.top = g.f.y * H + 'px'; g.el.style.width = g.f.w * u * sc + 'px'
    }
    revealCanvas.width = Math.round(W * dpr); revealCanvas.height = Math.round(H * dpr)
    if (st.open) drawReveal(performance.now())
    // a spot is shown only where it covers no readable UI
    const boxes = UI.flatMap((s) => [...document.querySelectorAll(s)]).map((e) => e.getBoundingClientRect()).filter((r) => r.width && r.height)
    for (const g of figs) {
      if (!g.spot) continue
      const r = g.anchor.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2, pad = 34
      const free = !g.el.hidden && x > pad && y > pad && x < W - pad && y < H - pad && !boxes.some((b) => x > b.left - pad && x < b.right + pad && y > b.top - pad && y < b.bottom + pad)
      g.spot.hidden = !free
      g.x = -999; g.y = -999
      g.spot.dataset.side = x > W / 2 ? 'l' : 'r'
      place(g, x, y)
    }
  }
  function place(g, x, y) {
    if (Math.abs(x - g.x) < 0.3 && Math.abs(y - g.y) < 0.3) return
    g.x = x; g.y = y; g.spot.style.transform = `translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0)`
  }

  /* ── blobs on the backdrop canvas ── */
  const look = { x: 0, y: 0, tx: 0, ty: 0 }
  if (!reduced) addEventListener('pointermove', (e) => { look.tx = (e.clientX / innerWidth - 0.5) * 2; look.ty = (e.clientY / innerHeight - 0.5) * 2 }, { passive: true })
  const list = (cw, ch) => {
    const cu = Math.min(cw, ch * 1.5) / 100
    return BLOBS.map((b, i) => ({ b, i, cx: b.x * cw, cy: b.y * ch, R: b.r * cu * b.k * (phone ? 0.7 : 1), amp: 1 })).filter((it) => !phone || it.b.ph)
  }
  function tick() {
    look.x += (look.tx - look.x) * 0.05; look.y += (look.ty - look.y) * 0.05
    artLayer.style.setProperty('--px', look.x.toFixed(3)); artLayer.style.setProperty('--py', look.y.toFixed(3))
    for (const b of BLOBS) b.k += (b.kt - b.k) * 0.12
    for (const g of figs) if (g.spot && !g.spot.hidden) { const r = g.anchor.getBoundingClientRect(); place(g, r.left + r.width / 2, r.top + r.height / 2) }
  }
  function drawBlobs(c, t, cw, ch, d) {
    if (!reduced) tick()
    paintField(c, list(cw, ch), reduced ? 4000 : t, cw, ch, d, reduced)
  }

  /* ── the reveal ── */
  const st = { open: false, p: 0, dir: 0, item: null, cur: 0, shown: false, opener: null, raf: 0, last: 0, tok: 0 }
  const card = document.createElement('div')
  card.className = 'cz-card'; card.hidden = true; card.setAttribute('role', 'dialog'); card.setAttribute('aria-modal', 'true'); card.setAttribute('aria-labelledby', 'czHead')
  card.innerHTML = `<div class="ph"><span class="ph-dot" aria-hidden="true"></span><span class="ph-title" id="czKick"></span><span class="ph-rule" aria-hidden="true"></span></div>
    <h2 id="czHead"></h2><div class="cz-body" id="czBody"></div><div class="cz-cites" id="czCites"></div>
    <div class="cz-actions">
      <button type="button" class="hbtn" data-a="ask">Ask NOVA about this</button>
      <button type="button" class="hbtn ghost" data-a="prev" aria-label="Previous hazard">&lsaquo;</button>
      <button type="button" class="hbtn ghost" data-a="next" aria-label="Next hazard">&rsaquo;</button>
      <button type="button" class="hbtn ghost" data-a="close">Close</button>
    </div>`
  document.body.appendChild(card)
  const q = (s) => card.querySelector(s)
  const kick = q('#czKick'), head = q('#czHead'), body = q('#czBody'), cites = q('#czCites')

  function fill(i) {
    const h = HAZ[i], tok = ++st.tok
    kick.textContent = `Hazard ${i + 1} of ${HAZ.length} · ${h.name}`
    head.textContent = h.head
    body.innerHTML = `<p>${esc(h.fallback)}</p>`
    cites.textContent = ''
    const put = (cs) => {
      for (const c of cs) {
        const url = httpUrl(c.url); if (!url) continue
        const a = document.createElement('a'); a.className = 'tag'; a.href = url; a.target = '_blank'; a.rel = 'noopener'; a.textContent = String(c.label || '').replace(/<[^>]*>/g, ''); cites.appendChild(a)
      }
    }
    put(FALLBACK_CITE)
    Promise.resolve(getFact ? getFact(h.faq) : null).then((f) => {
      if (tok !== st.tok || !f || typeof f.text !== 'string' || !f.text.trim()) return
      body.innerHTML = `<p>${em(f.text)}</p>`
      cites.textContent = ''; put(Array.isArray(f.citations) && f.citations.length ? f.citations : FALLBACK_CITE)
    }).catch(() => {})
  }

  function showCard() {
    if (st.shown) return
    st.shown = true; card.hidden = false
    requestAnimationFrame(() => card.classList.add('on'))
    sound?.chime?.()
    q('[data-a="ask"]').focus({ preventScroll: true })
  }
  function hideCard() { st.shown = false; card.classList.remove('on'); card.hidden = true }

  function drawReveal(now) {
    const it = st.item; if (!it) return
    const cw = revealCanvas.width, ch = revealCanvas.height
    rc.clearRect(0, 0, cw, ch)
    const cx = it.fx * cw, cy = it.fy * ch, far = Math.max(Math.hypot(cx, cy), Math.hypot(cw - cx, cy), Math.hypot(cx, ch - cy), Math.hypot(cw - cx, ch - cy))
    const e = ease(Math.max(0, Math.min(1, st.p)))
    const R = it.R0 * dpr + (far / 0.7 - it.R0 * dpr) * e
    revealCanvas.style.opacity = String(Math.min(1, st.p / 0.12))
    paintField(rc, [{ cx, cy, R, b: it.b, amp: 1 + 0.9 * Math.sin(Math.PI * Math.min(1, st.p)) }], reduced ? 4000 : now, cw, ch, dpr, reduced)
  }

  function loop(now) {
    const dt = Math.min(64, now - (st.last || now)); st.last = now
    st.p += (st.dir * dt) / (st.dir > 0 ? 950 : 720)
    if (st.dir > 0 && st.p >= 0.7) showCard()
    if (st.dir > 0 && st.p >= 1) { st.p = 1; st.dir = 0 }
    if (st.p <= 0 && st.dir < 0) return finish()
    drawReveal(now)
    st.raf = requestAnimationFrame(loop)
  }
  function finish() {
    cancelAnimationFrame(st.raf); st.raf = 0; st.dir = 0; st.p = 0; st.open = false
    revealCanvas.hidden = true; revealCanvas.style.opacity = ''
    frame.inert = false; spotLayer.inert = false
    const o = st.opener; st.opener = null
    if (o && document.contains(o) && !o.hidden) o.focus({ preventScroll: true })
  }

  function nearest(x, y) {
    let best = null, bd = Infinity
    for (const it of list(W, H)) { const d = Math.hypot(x - it.cx, y - it.cy) - it.R; if (d < bd) { bd = d; best = it } }
    return best
  }

  function open(id, opener) {
    if (st.open) return
    const i = Math.max(0, HAZ.findIndex((h) => h.id === id))
    const g = figs.find((z) => z.f.hz === HAZ[i].id)
    let x = W * 0.5, y = H * 0.5
    if (g && !g.el.hidden) { const r = g.anchor.getBoundingClientRect(); x = r.left + r.width / 2; y = r.top + r.height / 2 }
    const nb = nearest(x, y) || list(W, H)[0]
    st.item = { b: nb.b, fx: nb.cx / W, fy: nb.cy / H, R0: nb.R }
    st.open = true; st.cur = i; st.opener = opener || null; st.shown = false; st.p = 0; st.last = 0
    frame.inert = true; spotLayer.inert = true
    revealCanvas.hidden = false
    fill(i)
    sound?.tick?.()
    if (reduced) { st.p = 1; st.dir = 0; drawReveal(4000); showCard() } else { st.dir = 1; st.raf = requestAnimationFrame(loop) }
  }
  function close({ instant = false } = {}) {
    if (!st.open) return
    hideCard()
    if (reduced || instant || !st.raf) { finish(); return }
    st.dir = -1; st.last = 0
  }
  function step(d) {
    st.cur = (st.cur + d + HAZ.length) % HAZ.length
    card.classList.remove('on'); void card.offsetWidth; card.classList.add('on')
    fill(st.cur); sound?.tick?.()
  }

  card.addEventListener('click', (e) => {
    const a = e.target.closest('[data-a]')?.dataset.a
    if (a === 'close') close()
    else if (a === 'prev') step(-1)
    else if (a === 'next') step(1)
    else if (a === 'ask') { const h = HAZ[st.cur]; close({ instant: true }); onAsk?.(h.q) }
  })
  revealCanvas.addEventListener('click', () => { if (st.shown) close() })
  card.addEventListener('keydown', (e) => {
    if (e.key !== 'Tab') return
    const f = [...card.querySelectorAll('button, a[href]')]
    if (!f.length) return
    const first = f[0], last = f[f.length - 1]
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
  })
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && st.open) { e.preventDefault(); close() } })

  /* openers: hotspots and the R-I-D-G-E row */
  const swell = (id, on) => {
    if (reduced) return
    const g = figs.find((z) => z.f.hz === id); if (!g) return
    const r = g.anchor.getBoundingClientRect(), nb = nearest(r.left + r.width / 2, r.top + r.height / 2)
    if (nb) nb.b.kt = on ? 1.09 : 1
  }
  for (const el of [...figs.map((g) => g.spot).filter(Boolean), ...dockBtns]) {
    el.addEventListener('click', () => open(el.dataset.hz, el))
    el.addEventListener('pointerenter', () => swell(el.dataset.hz, true)); el.addEventListener('pointerleave', () => swell(el.dataset.hz, false))
    el.addEventListener('focus', () => swell(el.dataset.hz, true)); el.addEventListener('blur', () => swell(el.dataset.hz, false))
  }

  let rs = 0
  addEventListener('resize', () => { clearTimeout(rs); rs = setTimeout(layout, 120) })
  addEventListener('load', layout)
  document.fonts?.ready?.then(layout)
  layout()
  requestAnimationFrame(layout)

  return { drawBlobs, open, close, layout, get isOpen() { return st.open } }
}
