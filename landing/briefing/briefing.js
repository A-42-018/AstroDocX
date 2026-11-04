/* ============================================================
   ASTRODOCX — Mission Briefing (homepage) behaviour
     intro     a scripted 4-step briefing by VITA, once per visit
               (sessionStorage), with Skip; fully offline
     chat      questions go to the shared ask module
               (landing/vita/ask.js); if it is missing or fails, a
               small built-in set of answers takes over
     doors     Console -> /app/, Cabin -> /app/cabin, Library -> the
               NASA library overlay (landing/library/library.js)
     tour      window.ADX_BRIEFING lets tour.js play the briefing as
               chapter 1 of the 1-click tour
============================================================ */
import { createScene } from './vita.js'
import { sound } from './sound.js'

const $ = (s, r = document) => r.querySelector(s)
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches
const params = new URLSearchParams(location.search)
const TOUR_ON_LOAD = params.get('tour') === 'full'
const SEEN_KEY = 'adx-briefed'
const CONSOLE_BASE = '/app'

const thread = $('#thread'), chips = $('#chips'), form = $('#ask'), input = $('#q'), askBtn = $('#askBtn')
const skipBtn = $('#skip'), phase = $('#phase'), steps = [...$('#steps').children]
const vitaId = $('#vitaId'), vitaState = $('#vitaState')
const doors = [...document.querySelectorAll('.door')]

const scene = createScene({ bg: $('#bg'), bot: $('#bot'), doors: doors.map((d) => $('canvas', d)), reduced: REDUCED })

/* ───────────────────────── copy ───────────────────────── */
const INTRO = [
  { text: "Hi, I'm <em>VITA</em>, the mission guide for AstroDocX. Give me 30 seconds and I'll show you why we built this." },
  { text: 'Beyond the Moon, a message to Earth takes minutes each way. NASA groups the dangers into five hazards: <em>radiation, isolation, distance, gravity and hostile environments</em>. The crew has to catch health changes themselves.',
    citations: [{ label: 'NASA · 5 hazards', url: 'https://www.nasa.gov/hrp/hazards/' }] },
  { text: "AstroDocX learns each astronaut's own normal, spots drift early, and turns every alert into a clear action: <em>detect, explain, act, log, sync later</em>. Every limit is cited from NASA-STD-3001.", door: 'console' },
  { text: "Three doors, pick one. Or ask me anything about astronaut health. I answer from NASA's own research and I'll show you where it came from." },
]
const RETURN_LINE = { text: "Welcome back. Pick a door, or ask me anything about astronaut health. I'll show you where each answer comes from." }
const CHIPS = ['How do you catch a CO₂ fault?', 'What does radiation do to astronauts?', 'Show me bone loss in space', 'Take me to the EVA']
const DOOR_LINE = {
  console: 'The console is where the crew lives: try the CO₂ fault demo and watch an alert become an action.',
  cabin: 'The cabin is the station in 3D. The tour ends outside with an astronaut on EVA.',
  library: "The library is NASA's own media on keeping astronauts healthy, sorted by hazard.",
}
const GO_LINE = { console: 'Opening the Crew Console…', cabin: 'Boarding the 3D cabin…', tour: 'Starting the 1-click tour…' }

/* Built-in answers: used when landing/vita/ask.js is missing or fails. Same shape as the ask module's result. */
const OFFLINE = [
  { k: /co2|co₂|carbon|scrubber|air/i,
    text: 'NASA-STD-3001 limits cabin CO₂ to a <em>3 mmHg one-hour average</em>. AstroDocX watches the hourly readings: 3 hours in a row over the limit raises Watch, 6 raises Act, and each alert explains what changed against whose baseline.',
    citations: [{ label: 'STD-3001 V2 · 6004', url: 'https://www.nasa.gov/wp-content/uploads/2023/12/ochmo-tb-004-carbon-dioxide.pdf' }],
    actions: [{ label: 'Run the CO₂ fault demo', kind: 'console', target: '/simulator' }, { label: 'Open the alerts', kind: 'console', target: '/alerts' }] },
  { k: /radiat|dose|solar|cancer/i,
    text: 'Space radiation raises long-term cancer risk and can affect the brain and heart. NASA caps career effective dose at <em>600 mSv</em>, and AstroDocX tracks a rolling 24-hour dose so a solar particle event shows up early.',
    citations: [{ label: 'NASA-STD-3001', url: 'https://www.nasa.gov/reference/nasa-std-3001-technical-briefs/' }, { label: 'NASA HRP · hazards', url: 'https://www.nasa.gov/hrp/hazards/' }],
    actions: [{ label: 'Inject a solar event', kind: 'console', target: '/simulator' }, { label: 'NASA radiation media', kind: 'library', target: 'radiation' }] },
  { k: /bone|muscle|exercise|gravity/i,
    text: "Without gravity, astronauts can lose bone mass in the hips and spine and lose muscle fast. That's why ISS crews exercise about <em>two hours a day</em>. AstroDocX tracks exercise against each person's baseline.",
    citations: [{ label: 'NASA HRP · hazards', url: 'https://www.nasa.gov/hrp/hazards/' }],
    actions: [{ label: 'NASA exercise media', kind: 'library', target: 'bone-muscle' }, { label: 'See the trend', kind: 'console', target: '/trends' }] },
  { k: /eva|spacewalk|cabin|station|suit/i,
    text: 'Taking you aboard. The cabin tour ends outside, with an astronaut on EVA and their suit vitals on the visor HUD.',
    citations: [],
    actions: [{ label: 'Board the cabin', kind: 'cabin', target: 'eva' }, { label: 'NASA spacewalk media', kind: 'library', target: 'spacewalks' }] },
]
const OFFLINE_DEFAULT = {
  text: "I can't reach my full NASA library right now, so I'm answering from a small built-in set: <em>CO₂, radiation, bone and muscle, and spacewalks</em>. Try one of the suggestions, or open a door.",
  citations: [], actions: [{ label: 'Open the NASA library', kind: 'library', target: 'bone-muscle' }],
}
function offlineAnswer(q) {
  const hit = OFFLINE.find((a) => a.k.test(q)) || OFFLINE_DEFAULT
  return { text: hit.text, citations: hit.citations, actions: hit.actions, source: 'offline' }
}

/* ───────────────────────── safe HTML ───────────────────────── */
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
/** Escape everything, then let plain <em>/</em> back in (the only markup the ask contract allows). */
const safe = (s) => esc(s).replace(/&lt;(\/?)em&gt;/gi, '<$1em>')
const plain = (s) => String(s ?? '').replace(/<[^>]*>/g, '')
const httpUrl = (u) => { try { const x = new URL(u, location.href); return /^https?:$/.test(x.protocol) ? x.href : null } catch { return null } }

/* ───────────────────────── state ───────────────────────── */
let token = 0            // bumps to cancel whatever VITA is saying or waiting on
let busy = false         // VITA is typing or thinking
let ready = false        // the intro is over: chips, door lines and questions are live
let paused = false       // the 1-click tour is paused
const chatLog = []   // { role: 'user' | 'assistant', text } for the ask module

const sleep = (ms, tok) => new Promise((res) => {
  let left = ms, last = performance.now()
  const id = setInterval(() => {
    const now = performance.now()
    if (tok !== token) { clearInterval(id); return res(false) }
    if (!paused) left -= now - last
    last = now
    if (left <= 0) { clearInterval(id); res(true) }
  }, 40)
})

let stepNow = 0
function setStep(i) {
  stepNow = i
  phase.textContent = i < INTRO.length ? `Briefing · ${i + 1} of ${INTRO.length}` : 'Ask VITA'
  steps.forEach((n, j) => n.classList.toggle('on', j <= i))
}
function setBusy(v, label) {
  busy = v
  vitaId.classList.toggle('busy', v)
  vitaState.textContent = label || (v ? 'Speaking' : 'Mission guide')
  askBtn.disabled = v && ready     // during the intro a question simply skips it
  thread.setAttribute('aria-busy', v ? 'true' : 'false')
}
function scrollDown() { thread.scrollTop = thread.scrollHeight }
function light(name) { doors.forEach((d) => d.classList.toggle('lit', d.dataset.door === name)) }

function addMine(q) {
  const d = document.createElement('div')
  d.className = 'msg me'
  d.innerHTML = '<span class="sr-only">You: </span>' + esc(q)
  thread.appendChild(d); scrollDown()
}
function addBot({ source, hover } = {}) {
  const d = document.createElement('div')
  d.className = 'msg bot' + (hover ? ' hover' : '')
  if (hover) d.setAttribute('aria-hidden', 'true')   // door hints repeat what the door says; keep them out of the log
  d.innerHTML = `<div class="who" aria-hidden="true">VITA${source === 'offline' ? ' <span class="src">· offline</span>' : ''}</div><p class="sr-only"></p><div class="body" aria-hidden="true"></div>`
  thread.appendChild(d); scrollDown()
  return d
}
function dropHover() { const last = thread.lastElementChild; if (last && last.classList.contains('hover')) last.remove() }

/** Type a message out, character by character (instantly with reduced motion). Resolves false if cancelled. */
async function say(item, { instant = false } = {}) {
  dropHover()
  const tok = token
  const d = addBot({ source: item.source })
  const body = $('.body', d)
  const html = safe(item.text)
  $('.sr-only', d).textContent = 'VITA: ' + plain(html.replace(/&[a-z#0-9]+;/gi, (e) => { const t = document.createElement('textarea'); t.innerHTML = e; return t.value }))
  if (instant || REDUCED) {
    body.innerHTML = html
  } else {
    setBusy(true); scene.talk(true); d.classList.add('typing')
    const units = html.match(/<\/?em>|&[a-z#0-9]+;|[\s\S]/gi) || []
    let out = '', n = 0
    for (const u of units) {
      if (tok !== token) { d.classList.remove('typing'); scene.talk(false); return false }
      while (paused) { if (!(await sleep(80, tok))) return false }
      out += u; body.innerHTML = out
      if (u.length === 1 && u !== ' ') { n++; if (n % 3 === 0) sound.blip() }
      if (u.length === 1 || u[0] === '&') { scrollDown(); await new Promise((r) => setTimeout(r, 16)) }
    }
    d.classList.remove('typing'); scene.talk(false); setBusy(false)
  }
  extras(d, item)
  return tok === token
}

function extras(d, item) {
  const cites = (item.citations || []).map((c) => ({ label: plain(c.label), url: httpUrl(c.url) })).filter((c) => c.label && c.url)
  if (cites.length) {
    const w = document.createElement('div'); w.className = 'cites'
    for (const c of cites) {
      const a = document.createElement('a')
      a.className = 'tag'; a.href = c.url; a.target = '_blank'; a.rel = 'noopener'; a.textContent = c.label
      a.setAttribute('aria-label', `Source: ${c.label} (opens in a new tab)`)
      w.appendChild(a)
    }
    d.appendChild(w)
  }
  const acts = (item.actions || []).filter((a) => a && a.label && ['console', 'cabin', 'library', 'tour'].includes(a.kind))
  if (acts.length) {
    const w = document.createElement('div'); w.className = 'acts'
    acts.forEach((a, i) => {
      const btn = document.createElement('button')
      btn.type = 'button'; btn.className = 'hbtn xs' + (i ? ' ghost' : ''); btn.textContent = plain(a.label)
      btn.addEventListener('click', () => go(a))
      w.appendChild(btn)
    })
    d.appendChild(w)
  }
  if (item.door) light(item.door)
  scrollDown()
}

/* ───────────────────────── intro ───────────────────────── */
function markSeen() { try { sessionStorage.setItem(SEEN_KEY, '1') } catch { /* storage off */ } }
function seen() { try { return sessionStorage.getItem(SEEN_KEY) === '1' } catch { return false } }

function goReady() {
  ready = true
  setStep(INTRO.length); light(null)
  skipBtn.hidden = true
  if (!chips.children.length) {
    for (const c of CHIPS) {
      const x = document.createElement('button')
      x.type = 'button'; x.className = 'chip'; x.textContent = c
      x.addEventListener('click', () => ask(c))
      chips.appendChild(x)
    }
  }
  requestAnimationFrame(scrollDown)   // the chips take room from the thread
}

async function runIntro() {
  const tok = ++token
  ready = false; thread.textContent = ''; skipBtn.hidden = false; chips.textContent = ''
  for (let i = 0; i < INTRO.length; i++) {
    setStep(i)
    if (!(await say(INTRO[i]))) return false
    if (i < INTRO.length - 1 && !(await sleep(REDUCED ? 1400 : 900, tok))) return false
  }
  markSeen(); goReady()
  return true
}

function skipIntro() {
  token++; scene.talk(false); setBusy(false)
  thread.textContent = ''
  say(INTRO[INTRO.length - 1], { instant: true })
  markSeen(); goReady()
  input.focus({ preventScroll: true })
}
skipBtn.addEventListener('click', skipIntro)

/* ───────────────────────── ask ───────────────────────── */
let askMod = null
function loadAsk() {
  if (!askMod) askMod = import(new URL('../vita/ask.js', import.meta.url).href).then((m) => (typeof m.ask === 'function' ? m.ask : null)).catch(() => null)
  return askMod
}

function valid(r) {
  return r && typeof r.text === 'string' && r.text.trim()
    ? { text: r.text, citations: Array.isArray(r.citations) ? r.citations : [], actions: Array.isArray(r.actions) ? r.actions : [], source: r.source === 'live' ? 'live' : 'offline' }
    : null
}

async function answer(q) {
  const fn = await loadAsk()
  if (fn) {
    try {
      const r = await Promise.race([
        fn(q, { history: chatLog.slice(-8), page: 'home' }),
        new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 25000)),
      ])
      const v = valid(r)
      if (v) return v
    } catch (e) { console.warn('[briefing] ask module failed, using built-in answers', e) }
  }
  return offlineAnswer(q)
}

async function ask(q) {
  q = String(q || '').trim()
  if (!q || (busy && ready)) return
  if (!ready) skipIntro()
  dropHover()
  addMine(q)
  chatLog.push({ role: 'user', text: q })
  const tok = ++token
  scene.perk(); sound.tick()
  setBusy(true, 'Thinking')
  const wait = addBot()
  $('.body', wait).innerHTML = '<span class="dots"><i></i><i></i><i></i></span>'
  $('.sr-only', wait).textContent = 'VITA is thinking…'
  const r = await answer(q)
  wait.remove(); setBusy(false)
  if (tok !== token) return
  setLink(r.source)
  chatLog.push({ role: 'assistant', text: plain(r.text) })
  await say(r)
}

form.addEventListener('submit', (e) => {
  e.preventDefault()
  const q = input.value.trim()
  if (!q) { input.placeholder = 'Type a question first'; input.focus(); return }
  if (busy && ready) return
  input.value = ''
  ask(q)
})

/* status bar: whether VITA is answering live or from the built-in set */
const linkEl = $('#vitaLink'), linkTxt = $('#vitaLinkTxt')
function setLink(source) {
  const off = !navigator.onLine || source === 'offline'
  linkEl.classList.toggle('off', off)
  linkTxt.textContent = !navigator.onLine ? 'VITA offline · built-in answers' : source === 'offline' ? 'VITA online · built-in answers' : 'VITA online'
}
addEventListener('online', () => setLink()); addEventListener('offline', () => setLink())
setLink('live')

/* mic: the browser's own speech recognition, where there is one */
const SR = window.SpeechRecognition || window.webkitSpeechRecognition
const mic = $('#mic')
if (SR && mic) {
  mic.hidden = false
  let rec = null
  mic.addEventListener('click', () => {
    if (rec) { rec.stop(); return }
    rec = new SR(); rec.lang = 'en-US'; rec.interimResults = true; rec.maxAlternatives = 1
    mic.classList.add('listening'); mic.setAttribute('aria-label', 'Stop listening')
    rec.onresult = (e) => {
      const r = e.results[e.results.length - 1]
      input.value = r[0].transcript
      if (r.isFinal) { rec.stop(); form.requestSubmit() }
    }
    rec.onend = rec.onerror = () => { rec = null; mic.classList.remove('listening'); mic.setAttribute('aria-label', 'Speak your question') }
    try { rec.start() } catch { rec = null }
  })
}

/* VITA herself: a nudge */
const bot = $('#bot')
function poke() { if (ready && !busy) say({ text: 'Still here. Ask me something, or pick a door below.' }) }
bot.addEventListener('click', poke)
bot.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); poke() } })

/* ───────────────────────── doors + actions ───────────────────────── */
function consoleUrl(target) {
  let t = String(target || '').trim()
  if (!t || !t.startsWith('/') || t.startsWith('//')) t = '/'
  return CONSOLE_BASE + (t === '/' ? '/' : t)
}
function cabinUrl(shot) { return CONSOLE_BASE + '/cabin' + (shot ? '?shot=' + encodeURIComponent(shot) : '') }

function go(a) {
  if (a.kind === 'library') return openLibrary(a.target || null)
  if (a.kind === 'tour') { if (window.ADX_TOUR) window.ADX_TOUR.start(); return }
  const url = a.kind === 'console' ? consoleUrl(a.target) : cabinUrl(a.target)
  token++; setBusy(false); scene.talk(false)
  say({ text: GO_LINE[a.kind] }, { instant: true })
  sound.chime()
  setTimeout(() => { location.href = url }, REDUCED ? 0 : 350)
}

for (const d of doors) {
  const name = d.dataset.door
  const hint = () => {
    if (!ready || busy) return
    light(name); sound.tick()
    dropHover()
    const m = addBot({ hover: true })
    $('.body', m).textContent = DOOR_LINE[name]
    scrollDown()
  }
  d.addEventListener('mouseenter', hint)
  d.addEventListener('focus', hint)
  d.addEventListener('mouseleave', () => d.classList.remove('lit'))
  d.addEventListener('blur', () => d.classList.remove('lit'))
  if (name === 'library') d.addEventListener('click', (e) => { e.preventDefault(); openLibrary(null) })
  else d.addEventListener('click', () => { markSeen(); sound.chime() })
}

/* ───────────────────────── NASA library overlay ───────────────────────── */
const ov = $('#lib'), mount = $('#libMount'), frame = $('.frame')
let lib = null, libQuery = null, lastFocus = null

function loadLibCss() {
  const href = new URL('../library/library.css', import.meta.url).href
  if (document.querySelector(`link[data-lib-css]`)) return Promise.resolve()
  return new Promise((res) => {
    const l = document.createElement('link')
    l.rel = 'stylesheet'; l.href = href; l.dataset.libCss = ''
    l.onload = l.onerror = () => res()
    setTimeout(res, 3000)
    document.head.appendChild(l)
  })
}

function libFallback(collection) {
  const q = { 'bone-muscle': 'astronaut exercise', radiation: 'space radiation astronaut', 'sleep-isolation': 'astronaut sleep', 'twins-study': 'twins study', 'life-support': 'ISS life support', spacewalks: 'spacewalk' }[collection] || 'astronaut health'
  mount.innerHTML = `<div class="hp lib-fallback"><span class="br br-tl" aria-hidden="true"></span><span class="br br-br" aria-hidden="true"></span>
    <div class="ph"><span class="ph-dot" aria-hidden="true"></span><span class="ph-title">Door 3 · NASA library</span><span class="ph-rule" aria-hidden="true"></span></div>
    <h2>The library is not loaded</h2>
    <p>I couldn't open the NASA library just now. You can browse NASA's Image and Video Library directly, or come back to the briefing.</p>
    <div class="acts"><a class="hbtn xs" target="_blank" rel="noopener" href="https://images.nasa.gov/search?q=${encodeURIComponent(q)}">Search images.nasa.gov</a><button type="button" class="hbtn xs ghost" data-close>Back to briefing</button></div>
    <p class="mono" style="font-size:10px">Media: NASA (images.nasa.gov). Not affiliated with or endorsed by NASA.</p></div>`
  $('[data-close]', mount).addEventListener('click', closeLibrary)
}

async function openLibrary(collection, query = null, { push = true } = {}) {
  if (ov.hidden) lastFocus = document.activeElement
  ov.hidden = false; frame.inert = true; document.body.classList.add('lib-open')
  if (push && !/^#library/.test(location.hash)) history_push('#library' + (collection ? '/' + collection : ''))
  if (lib && query && query !== libQuery) { try { lib.destroy() } catch { /* ignore */ } lib = null }
  if (!lib) {
    mount.innerHTML = '<p class="mono" style="margin:auto">Opening the NASA library…</p>'
    try {
      const [m] = await Promise.all([import(new URL('../library/library.js', import.meta.url).href), loadLibCss()])
      if (typeof m.mountLibrary !== 'function') throw new Error('no mountLibrary')
      mount.textContent = ''
      lib = await m.mountLibrary(mount, { collection: collection || undefined, query: query || undefined, onClose: closeLibrary })
      libQuery = query
    } catch (e) {
      console.warn('[briefing] library unavailable', e)
      lib = null; libFallback(collection)
    }
  } else if (collection && lib.setCollection) lib.setCollection(collection)
  if (ov.hidden) return
  const f = ov.querySelector('button, [href], input, select, [tabindex]:not([tabindex="-1"])')
  if (f) f.focus({ preventScroll: true }); else { ov.tabIndex = -1; ov.focus() }
}

function closeLibrary({ fromHistory = false } = {}) {
  if (ov.hidden) return
  ov.hidden = true; frame.inert = false; document.body.classList.remove('lib-open')
  if (!lib) mount.textContent = ''
  if (!fromHistory && /^#library/.test(location.hash)) history_back()
  if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true })
}

/* the library has its own address (#library or #library/<collection>), so Back closes it and links can open it */
let pushedLib = false
function history_push(hash) { try { window.history.pushState({ lib: true }, '', hash); pushedLib = true } catch { /* file:// */ } }
function history_back() { if (pushedLib) { pushedLib = false; window.history.back() } else { try { window.history.replaceState(null, '', location.pathname + location.search) } catch { /* ignore */ } } }
addEventListener('popstate', () => {
  const m = location.hash.match(/^#library(?:\/([\w-]+))?/)
  if (m) openLibrary(m[1] || null, null, { push: false })
  else { pushedLib = false; closeLibrary({ fromHistory: true }) }
})
/* Esc: once the real library is mounted it owns Escape (it closes its own media modal first, then calls onClose);
   this only covers the loading state and the fallback panel */
addEventListener('keydown', (e) => { if (e.key === 'Escape' && !ov.hidden && !lib) { e.preventDefault(); closeLibrary() } })

/* ───────────────────────── sound button ───────────────────────── */
const sBtn = $('#sound'), sLbl = $('#soundLbl')
function showSound() { sBtn.setAttribute('aria-pressed', String(sound.on)); sLbl.textContent = sound.on ? 'Sound on' : 'Sound off' }
if (!sound.available) sBtn.hidden = true
sBtn.addEventListener('click', () => { sound.set(!sound.on); showSound() })
if (sound.wanted()) {
  const resume = () => { if (!sound.on) { sound.set(true); showSound() } }
  addEventListener('pointerdown', resume, { once: true }); addEventListener('keydown', resume, { once: true })
}
showSound()

/* ───────────────────────── 1-click tour hooks (tour.js) ───────────────────────── */
window.ADX_BRIEFING = {
  /** Play the briefing as the tour's first chapter. Resolves true when VITA has finished. */
  async runTour() {
    closeLibrary(); paused = false
    if (!(await runIntro())) return false
    const tok = token
    light('console')
    await say({ text: "First stop: the <em>Crew Console</em>. I'll meet you in the cabin later.", door: 'console' })
    return sleep(1200, tok)
  },
  setPaused(v) { paused = !!v; scene.talk(!paused && busy) },
  /** The tour was exited: give the visitor the room. */
  endTour() { paused = false; if (!ready) skipIntro() },
  /** 0..1 through the briefing, for the tour bar */
  progress() { return ready ? 1 : Math.min(1, stepNow / INTRO.length) },
  page: 'briefing',
}

/* ───────────────────────── start ───────────────────────── */
const deep = location.hash.match(/^#library(?:\/([\w-]+))?/)
if (TOUR_ON_LOAD) {
  setStep(0)           // tour.js starts the briefing shortly after load
} else if (seen()) {
  say(RETURN_LINE, { instant: true }); goReady()
} else {
  setTimeout(() => { if (!ready && !busy && token === 0) runIntro() }, REDUCED ? 200 : 700)
}
if (deep) { pushedLib = false; openLibrary(deep[1] || null, null, { push: false }) }
loadAsk()   // warm the module so the first answer is quick
