/* ============================================================
   ASTRODOCX — Mission Briefing line art (no image files)
   Engraving-style drawings in the HUD's cyan: outlines, hatching
   and stipple, all built here as SVG strings. Every stroke uses
   currentColor; the few solid parts use the .k class (the void's
   ink) so a planet hides the back of its ring, a visor reads dark.
   Each figure lists `spot`, where its hotspot sits, in viewBox units.
============================================================ */

/* small seeded random, so the stipple never shimmers between loads */
function rng(seed) {
  return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
}
const f = (n) => Math.round(n * 10) / 10

/** parallel chords across a circle, from `from`·r to `to`·r along direction `deg` (the engraver's shading) */
function chords(cx, cy, r, { deg = 0, from = 0.3, to = 0.95, gap = 4 } = {}) {
  const a = (deg * Math.PI) / 180, nx = Math.cos(a), ny = Math.sin(a), tx = -ny, ty = nx
  let d = ''
  for (let o = from * r; o <= to * r; o += gap) {
    const h = Math.sqrt(Math.max(0, r * r - o * o)) * (0.92 - 0.25 * ((o / r - from) / (to - from || 1)))
    const mx = cx + nx * o, my = cy + ny * o
    d += `M${f(mx - tx * h)} ${f(my - ty * h)}L${f(mx + tx * h)} ${f(my + ty * h)}`
  }
  return `<path class="h" d="${d}"/>`
}

/** stipple dots inside a circle, crowding toward the shadow side `deg` */
function stipple(cx, cy, r, n, seed, deg = 0) {
  const rand = rng(seed), a = (deg * Math.PI) / 180
  let out = ''
  for (let i = 0; i < n * 3 && n > 0; i++) {
    const rr = Math.sqrt(rand()) * r * 0.96, th = rand() * Math.PI * 2
    const x = Math.cos(th) * rr, y = Math.sin(th) * rr
    const side = (x * Math.cos(a) + y * Math.sin(a)) / r   // -1 lit … 1 shadow
    if (rand() > 0.15 + 0.85 * Math.max(0, side)) continue
    out += `<circle class="d" cx="${f(cx + x)}" cy="${f(cy + y)}" r="${f(0.5 + rand() * 0.6)}"/>`
    if (--n <= 0) break
  }
  return out
}

/** an outlined tube: a wide stroke in ink inside a slightly wider cyan one (limbs, hoses) */
const tube = (d, w) => `<path d="${d}" stroke-width="${w + 3}"/><path class="kt" d="${d}" stroke-width="${w}"/>`

const svg = (vb, inner) =>
  `<svg viewBox="${vb}" xmlns="http://www.w3.org/2000/svg" focusable="false"><g fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${inner}</g></svg>`

/* ── Moon: craters, terminator hatching, stipple ── */
function moon() {
  const c = 80, r = 62
  const craters = [[60, 58, 11], [98, 50, 7], [92, 92, 14], [56, 104, 8], [118, 76, 6], [74, 80, 5], [108, 118, 7]]
  let s = `<circle class="k" cx="${c}" cy="${c}" r="${r}"/>`
  s += chords(c, c, r, { deg: 20, from: 0.32, to: 0.97, gap: 3.6 })
  s += stipple(c, c, r, 150, 7, 20)
  for (const [x, y, cr] of craters) s += `<circle cx="${x}" cy="${y}" r="${cr}"/><path class="h" d="M${x - cr * 0.7} ${y + cr * 0.2}A${cr * 0.8} ${cr * 0.8} 0 0 0 ${x + cr * 0.6} ${y + cr * 0.55}"/>`
  s += `<circle cx="${c}" cy="${c}" r="${r}" stroke-width="2"/>`
  return { vb: '0 0 160 160', spot: null, svg: svg('0 0 160 160', s) }
}

/* ── Sun: granulated core, wavy rays, two prominences ── */
function sun() {
  const c = 100, r = 40
  let rays = ''
  for (let i = 0; i < 28; i++) {
    const a = (i / 28) * Math.PI * 2, long = i % 2 ? 22 : 36, r0 = r + 9
    const p = (k) => [c + Math.cos(a) * (r0 + k * long), c + Math.sin(a) * (r0 + k * long)]
    const w = 3.5 * (i % 2 ? 1 : -1), nx = -Math.sin(a) * w, ny = Math.cos(a) * w
    const [x0, y0] = p(0), [x1, y1] = p(0.33), [x2, y2] = p(0.66), [x3, y3] = p(1)
    rays += `M${f(x0)} ${f(y0)}C${f(x1 + nx)} ${f(y1 + ny)} ${f(x2 - nx)} ${f(y2 - ny)} ${f(x3)} ${f(y3)}`
  }
  let s = `<path class="h" d="${rays}"/>`
  s += `<circle class="k" cx="${c}" cy="${c}" r="${r}"/>`
  s += stipple(c, c, r, 120, 11, 35)
  s += chords(c, c, r, { deg: 35, from: 0.45, to: 0.95, gap: 3.4 })
  s += `<circle cx="${c}" cy="${c}" r="${r - 8}" class="h" stroke-dasharray="2 5" pathLength="1000"/>`
  s += `<circle cx="${c}" cy="${c}" r="${r}" stroke-width="2.2"/>`
  // prominences: plasma loops standing on the limb
  s += `<path d="M66 78C50 52 72 40 82 62"/><path class="h" d="M70 76C58 58 72 50 79 64"/>`
  s += `<path d="M126 132C150 150 136 168 118 140"/><path class="h" d="M123 135C140 150 132 160 120 142"/>`
  return { vb: '0 0 200 200', spot: [100, 100], svg: svg('0 0 200 200', s) }
}

/* ── Ringed planet: back ring, banded body, front ring ── */
function planet() {
  const c = [120, 92], r = 46, tilt = -16
  const ring = (rx, ry, half) => half === 'back'
    ? `M${-rx} 0A${rx} ${ry} 0 0 1 ${rx} 0`
    : `M${-rx} 0A${rx} ${ry} 0 0 0 ${rx} 0`
  const rings = [[104, 25], [94, 22], [82, 19], [72, 16.5]]
  let back = '', front = ''
  for (const [rx, ry] of rings) { back += ring(rx, ry, 'back'); front += ring(rx, ry, 'front') }
  let bands = ''
  for (const y of [-30, -18, -8, 4, 16, 28]) bands += `M${-r} ${y}Q0 ${y + 7} ${r} ${y}`
  let s = `<g transform="translate(${c[0]} ${c[1]}) rotate(${tilt})">`
  s += `<path d="${back}"/>`
  s += `<clipPath id="cz-planet-clip"><circle r="${r}"/></clipPath>`
  s += `<circle class="k" r="${r}"/>`
  s += `<g clip-path="url(#cz-planet-clip)"><path class="h" d="${bands}"/>${chords(0, 0, r, { deg: 70, from: 0.35, to: 0.98, gap: 3.6 })}${stipple(0, 0, r, 70, 23, 70)}</g>`
  s += `<circle r="${r}" stroke-width="2"/>`
  s += `<path class="k" d="M-104 0A104 25 0 0 0 104 0L72 0A72 16.5 0 0 1 -72 0Z" stroke="none"/>`
  s += `<path d="${front}"/>`
  s += `</g>`
  return { vb: '0 0 240 184', spot: [120, 92], svg: svg('0 0 240 184', s) }
}

/* ── Astronaut on a tether, drifting ── */
function astronaut() {
  let s = ''
  s += `<path class="h" d="M78 146C44 164 30 206 4 214M10 216c-4-6 2-10 6-6"/>`          // tether trailing off
  s += `<rect class="k" x="76" y="78" width="66" height="74" rx="10"/>`                 // backpack
  s += `<path class="h" d="M84 92h50M84 100h50M84 138h50"/>`
  s += tube('M90 104Q62 90 54 62', 20) + `<circle class="k" cx="51" cy="56" r="10"/>`  // back arm + glove
  s += tube('M102 170Q94 196 74 210', 22) + `<ellipse class="k" cx="68" cy="214" rx="15" ry="9" transform="rotate(-28 68 214)"/>`
  s += `<rect class="k" x="84" y="92" width="58" height="84" rx="17"/>`                // torso
  s += `<rect x="99" y="112" width="28" height="20" rx="3"/><circle class="d" cx="106" cy="122" r="2"/><circle class="d" cx="113" cy="122" r="2"/><circle class="d" cx="120" cy="122" r="2"/>`
  s += `<path class="h" d="M132 104v60M136 108v52M128 140h-36M128 146h-36"/>`
  s += tube('M126 170Q142 198 150 222', 22) + `<ellipse class="k" cx="153" cy="228" rx="15" ry="9" transform="rotate(16 153 228)"/>`
  s += tube('M136 104Q166 112 182 138', 20) + `<circle class="k" cx="186" cy="144" r="10"/>` // front arm + glove
  s += `<path class="h" d="M60 82l11-6M168 116l7 9M88 190l13 4M134 196l12-5"/>`         // suit rings at elbows and knees
  s += `<ellipse class="k" cx="113" cy="96" rx="22" ry="7"/>`                            // neck ring
  s += `<clipPath id="cz-helm-clip"><circle cx="112" cy="64" r="32"/></clipPath>`
  s += `<circle class="k" cx="112" cy="64" r="32"/>`
  s += `<g clip-path="url(#cz-helm-clip)">${chords(112, 64, 32, { deg: 25, from: 0.55, to: 0.98, gap: 3.4 })}</g>`
  s += `<circle cx="112" cy="64" r="32" stroke-width="2"/>`
  s += `<ellipse class="v" cx="117" cy="67" rx="22" ry="17"/>`                           // visor
  s += `<path d="M102 60Q108 53 119 53" stroke-width="2.6"/><path class="h" d="M128 76q4-3 5-8"/>`
  return { vb: '0 0 200 240', spot: [117, 67], svg: svg('0 0 200 240', s) }
}

/* ── Orion-style capsule: crew module with lit window, service module, two arrays ── */
function capsule() {
  let s = ''
  const wing = (pts, grid) => `<polygon class="k" points="${pts}"/><path class="h" d="${grid}"/>`
  let gl = '', gr = ''
  for (let i = 1; i < 6; i++) { const x = 14 + i * 12; gl += `M${x} ${f(122 + i * 1.3)}V${f(152 - i * 1)}`; const xr = 226 - i * 12; gr += `M${xr} ${f(122 + i * 1.3)}V${f(152 - i * 1)}` }
  gl += 'M14 137L86 138'; gr += 'M226 137L154 138'
  s += wing('14,122 86,130 86,146 14,152', gl) + wing('226,122 154,130 154,146 226,152', gr)
  s += `<path d="M86 138h8M154 138h-8"/>`
  s += `<rect class="k" x="94" y="118" width="52" height="46" rx="3"/>`
  s += `<path class="h" d="M94 130h52M94 152h52M136 120v42M140 120v42M132 120v42"/>`
  s += `<path class="k" d="M108 164L101 186H139L132 164Z"/><path class="h" d="M112 170l-3 14M128 170l3 14"/>`
  s += `<path class="k" d="M80 116L160 116L141 52Q120 44 99 52Z"/>`
  s += `<path class="h" d="M146 60L154 112M142 58L150 112M138 56L145 112"/>`
  s += `<ellipse cx="120" cy="116" rx="40" ry="6"/>`
  s += `<rect class="k" x="110" y="38" width="20" height="12" rx="2"/>`
  s += `<path class="w" d="M112 70L128 70L130 85L110 85Z"/>`                             // lit window: the crew inside
  s += `<path d="M94 82L102 80L101 92L92 94Z" opacity=".7"/>`
  return { vb: '0 0 240 200', spot: [120, 78], svg: svg('0 0 240 200', s) }
}

/* ── Station module breathing out CO₂ ── */
function module() {
  let s = ''
  let truss = 'M10 34H230M10 44H230'
  for (let x = 10; x < 230; x += 14) truss += `M${x} 34L${x + 7} 44L${x + 14} 34`
  s += `<path class="h" d="${truss}"/>`
  s += `<path d="M60 44V56M180 44V56"/>`
  s += `<rect class="k" x="40" y="56" width="140" height="50" rx="8"/>`
  let ribs = ''
  for (const x of [68, 96, 124, 152]) ribs += `M${x} 57Q${x + 6} 81 ${x} 105`
  s += `<path class="h" d="${ribs}M44 96H176M44 100H176"/>`
  s += `<ellipse class="k" cx="40" cy="81" rx="9" ry="25"/><ellipse class="k" cx="180" cy="81" rx="9" ry="25"/><circle cx="180" cy="81" r="9"/>`
  s += `<rect x="100" y="66" width="24" height="16" rx="2"/><path class="h" d="M104 70v8M108 70v8M112 70v8M116 70v8M120 70v8"/>`  // scrubber vent
  // CO₂ drifting out of the vent: O=C=O, three of them, smaller as they go
  const co2 = (x, y, k) => `<g transform="translate(${x} ${y}) scale(${k})"><path d="M-12 -1.6h8M-12 1.6h8M4 -1.6h8M4 1.6h8"/><circle class="k" r="5"/><circle class="k" cx="-15" r="4"/><circle class="k" cx="15" r="4"/></g>`
  s += `<path class="h" d="M112 66C110 52 120 46 116 30M118 66C122 50 132 46 130 30" opacity=".6"/>`
  s += co2(124, 22, 1) + co2(150, 12, 0.75) + co2(98, 10, 0.6)
  return { vb: '0 0 240 130', spot: [124, 22], svg: svg('0 0 240 130', s) }
}

export const ART = { astronaut: astronaut(), sun: sun(), capsule: capsule(), planet: planet(), module: module(), moon: moon() }
