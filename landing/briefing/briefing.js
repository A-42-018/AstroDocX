/* ============================================================
   ASTRODOCX — Mission Briefing (homepage) behaviour
     intro     a scripted 4-step briefing by NOVA, once per visit
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
import { createCosmos } from './cosmos.js'
import { sound } from './sound.js'
import { voice } from './voice.js'

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

/* the NOVA dock: a slim bar by default; Expand lifts the whole conversation over the page */
const dock = $('.dock'), dockX = $('#dockX'), stage = $('.stage')
function setDock(open) {
  if (open === dock.classList.contains('open')) return
  if (open) stage.style.minHeight = stage.offsetHeight + 'px'   // keep the bar's room so the page doesn't jump
  dock.classList.toggle('open', open)
  if (!open) stage.style.minHeight = ''
  dockX.setAttribute('aria-expanded', String(open)); dockX.textContent = open ? 'Collapse' : 'Expand'
  thread.scrollTop = thread.scrollHeight
}
dockX.addEventListener('click', () => setDock(!dock.classList.contains('open')))
addEventListener('keydown', (e) => { if (e.key === 'Escape' && dock.classList.contains('open') && !document.querySelector('#czReveal:not([hidden])')) { setDock(false); dockX.focus() } })
addEventListener('pointerdown', (e) => { if (dock.classList.contains('open') && !dock.contains(e.target)) setDock(false) })

/* the blobs, line art and hazard facts: facts come from the same faq.json VITA answers from */
let faqData = null
function getFact(id) {
  faqData ??= import(new URL('../vita/ask.js', import.meta.url).href).then((m) => m.loadFaq()).catch(() => null)
  return faqData.then((d) => d?.faq?.find((e) => e.id === id) ?? null)
}
const cosmos = createCosmos({
  artLayer: $('#czArt'), spotLayer: $('#czSpots'), revealCanvas: $('#czReveal'), dock: $('#rg'), frame: $('.frame'),
  reduced: REDUCED, sound, getFact, onAsk: (q) => ask(q),
})
const scene = createScene({ bg: $('#bg'), bot: $('#bot'), doors: doors.map((d) => $('canvas', d)), reduced: REDUCED, under: cosmos.drawBlobs })

/* ───────────────────────── copy ───────────────────────── */
const INTRO = [
  { text: "Hi, I'm <em>NOVA</em>, AstroDocX's mission guide. In 30 seconds, I'll show you how we help crews monitor health beyond Earth." },
  { text: 'Far from Earth, crews may need to spot health changes before Ground can respond. NASA groups the risks into five hazards: <em>radiation, isolation, distance, gravity and environment</em>.',
    citations: [{ label: 'NASA · 5 hazards', url: 'https://www.nasa.gov/hrp/hazards/' }] },
  { text: "AstroDocX learns each astronaut's baseline, explains changes and turns alerts into clear actions. Its limits link back to NASA sources.", door: 'console' },
  { text: "Start with the Crew Console, explore the station, or ask me about astronaut health. I'll show you the sources behind my answers." },
]
const RETURN_LINE = { text: "Welcome back. Pick a door, or ask me anything about astronaut health. I'll show you where each answer comes from." }
const CHIPS = ['How do you catch a CO₂ fault?', 'What does radiation do to astronauts?', 'Show me bone loss in space', 'Take me to the EVA', 'Give me the full tour']
/* Asking for the tour starts the full guide. The console's dock uses the same pattern (app/src/vita/intent.ts). */
const TOUR_INTENT = /full (tour|guide)|\btour\b|guide me|show me (everything|around)|walk me through/i
const TOUR_REPLY = "Sure, follow me. I'll show you everything."

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
let token = 0            // bumps to cancel whatever NOVA is saying or waiting on
let busy = false         // NOVA is typing or thinking
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
  phase.textContent = i < INTRO.length ? `Briefing · ${i + 1} of ${INTRO.length}` : 'Ask NOVA'
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
  d.innerHTML = `<div class="who" aria-hidden="true">NOVA${source === 'offline' ? ' <span class="src">· offline</span>' : ''}</div><p class="sr-only"></p><div class="body" aria-hidden="true"></div>`
  thread.appendChild(d); scrollDown()
  return d
}
function dropHover() { const last = thread.lastElementChild; if (last && last.classList.contains('hover')) last.remove() }

/** Type a message out, character by character (instantly with reduced motion). Resolves false if cancelled. */
async function say(item, { instant = false, quiet = false } = {}) {
  dropHover()
  const tok = token
  const d = addBot({ source: item.source })
  const body = $('.body', d)
  const html = safe(item.text)
  const text = plain(html.replace(/&[a-z#0-9]+;/gi, (e) => { const t = document.createElement('textarea'); t.innerHTML = e; return t.value }))
  $('.sr-only', d).textContent = 'NOVA: ' + text
  // NOVA speaks while the line types out (only with Sound on); the line ends when she stops talking
  const spoken = quiet ? null : voice.speak(text)
  if (spoken) {
    scene.talk(true); vitaId.classList.add('busy'); vitaState.textContent = 'Speaking'
    if (listener) { listener.pause('speaking'); spoken.then(() => listener.resume('speaking'), () => listener.resume('speaking')) }   // the mic must not hear NOVA
  }
  if (instant || REDUCED) {
    body.innerHTML = html
  } else {
    setBusy(true); scene.talk(true); d.classList.add('typing')
    const units = html.match(/<\/?em>|&[a-z#0-9]+;|[\s\S]/gi) || []
    let out = '', n = 0
    for (const u of units) {
      if (tok !== token) { d.classList.remove('typing'); scene.talk(false); if (spoken) voice.cancel(); return false }
      while (paused) { if (!(await sleep(80, tok))) return false }
      out += u; body.innerHTML = out
      if (u.length === 1 && u !== ' ') { n++; if (n % 3 === 0) sound.blip() }
      if (u.length === 1 || u[0] === '&') { scrollDown(); await new Promise((r) => setTimeout(r, 16)) }
    }
    d.classList.remove('typing'); setBusy(false)
    if (spoken) { vitaId.classList.add('busy'); vitaState.textContent = 'Speaking' } else scene.talk(false)
  }
  extras(d, item)
  if (spoken && !(await untilQuiet(spoken, tok))) return false
  return tok === token
}

/** Wait for NOVA to finish speaking; stops her if something else takes over (a question, Skip, a door). */
async function untilQuiet(spoken, tok) {
  let done = false
  spoken.then(() => { done = true })
  while (!done && tok === token) await new Promise((r) => setTimeout(r, 60))
  if (!done) voice.cancel()
  if (tok === token && !voice.speaking) { scene.talk(false); if (!busy) { vitaId.classList.remove('busy'); vitaState.textContent = 'Mission guide' } }
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

function skipIntro({ quiet = false } = {}) {
  token++; voice.cancel(); scene.talk(false); setBusy(false)
  thread.textContent = ''
  say(INTRO[INTRO.length - 1], { instant: true, quiet })
  markSeen(); goReady()
  input.focus({ preventScroll: true })
}
skipBtn.addEventListener('click', () => skipIntro())

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
  if (!ready) skipIntro({ quiet: true })   // the answer is coming; don't start reading the intro out
  dropHover()
  if (!TOUR_INTENT.test(q)) setDock(true)   // an answer needs room to be read: lift the conversation up
  addMine(q)
  chatLog.push({ role: 'user', text: q })
  const tok = ++token
  voice.cancel()
  scene.perk(); sound.tick()
  if (TOUR_INTENT.test(q) && window.ADX_TOUR) {
    chatLog.push({ role: 'assistant', text: TOUR_REPLY })
    if ((await say({ text: TOUR_REPLY })) && tok === token) window.ADX_TOUR.start({ mode: 'full' })
    return
  }
  setBusy(true, 'Thinking')
  const wait = addBot()
  $('.body', wait).innerHTML = '<span class="dots"><i></i><i></i><i></i></span>'
  $('.sr-only', wait).textContent = 'NOVA is thinking…'
  const r = await answer(q)
  wait.remove(); setBusy(false)
  if (tok !== token) return
  setLink(r.source)
  chatLog.push({ role: 'assistant', text: plain(r.text) })
  lastActions = r.actions || []
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

/* status bar: whether NOVA is answering live or from the built-in set */
const linkEl = $('#vitaLink'), linkTxt = $('#vitaLinkTxt')
function setLink(source) {
  const off = !navigator.onLine || source === 'offline'
  linkEl.classList.toggle('off', off)
  linkTxt.textContent = !navigator.onLine ? 'NOVA offline · built-in answers' : source === 'offline' ? 'NOVA online · built-in answers' : 'NOVA online'
}
addEventListener('online', () => setLink()); addEventListener('offline', () => setLink())
setLink('live')

/* ───────────────────────── voice: push-to-talk and voice mode ─────────────────────────
   One recognizer (vita/listen.js). A phrase is first tried as a command (vita/commands.js: "open alerts", "walk the
   station", "go back"…); anything else is a question and goes to ask() as it always did. Voice mode keeps listening. */
const mic = $('#mic'), modeBtn = $('#voiceMode'), chip = $('#voiceChip')
let lastActions = []      // the last answer's buttons, so "yes" / "open it" can run the first one
const listenMod = import(new URL('../vita/listen.js', import.meta.url).href).catch(() => null)
const cmdMod = import(new URL('../vita/commands.js', import.meta.url).href).catch(() => null)

const GUIDE = { help: 'You can say: open alerts, walk the station, open the radiation library, take the tour, go back, scroll down, or stop listening. Anything else, I will answer.' }
function note(text, idle = false) { chip.hidden = !text; chip.textContent = text || ''; chip.classList.toggle('idle', idle) }

function runCommand(c) {
  if (c.type === 'action') { go(c.action); return }
  switch (c.name) {
    case 'skip-intro': case 'tour-skip': if (!ready) skipIntro(); else if (window.ADX_TOUR) window.ADX_TOUR.start(); break
    case 'close': if (!$('#lib').hidden) closeLibrary(); break
    case 'back': history.back(); break
    case 'forward': history.forward(); break
    case 'scroll-down': case 'scroll-up': thread.scrollBy({ top: (c.name === 'scroll-down' ? 1 : -1) * thread.clientHeight * .8, behavior: REDUCED ? 'auto' : 'smooth' }); break
    case 'scroll-top': thread.scrollTo({ top: 0 }); break
    case 'scroll-bottom': scrollDown(); break
    case 'stop-talking': token++; voice.cancel(); scene.talk(false); setBusy(false); break
    case 'sound-on': if (sound.available) { sound.set(true); voice.set(true); voice.unlock(); showSound(); say({ text: 'Sound on.' }) } break
    case 'sound-off': sound.set(false); voice.set(false); voice.cancel(); showSound(); break
    case 'story': location.href = '/story.html'; break
    case 'tour-pause': window.ADX_BRIEFING?.setPaused(true); break
    case 'tour-resume': window.ADX_BRIEFING?.setPaused(false); break
    case 'tour-exit': window.ADX_BRIEFING?.endTour(); break
    case 'voice-off': setVoiceMode(false); break
    case 'follow': if (lastActions[0]) go(lastActions[0]); else say({ text: 'Tell me where to go: for example, open alerts, or walk the station.' }); break
    case 'help': say({ text: GUIDE.help }); break
    case 'home': say({ text: 'You are on the home page already.' }); break
    default: say({ text: GUIDE.help })
  }
}

async function heard(text) {
  const mod = await cmdMod
  const c = mod?.parseCommand(text, { where: 'home' })
  if (!c) { input.value = text; form.requestSubmit(); return }
  input.value = ''
  note(`Heard: “${text}”`, true)
  if (c.say && c.type === 'local' && c.name !== 'help') say({ text: c.say }, { instant: true })
  runCommand(c)
}

let listener = null
async function setupVoice() {
  const m = await listenMod
  if (!m) return
  listener = m.createListener({
    onInterim: (t) => { input.value = t; note(`Listening… ${t}`) },
    onFinal: (t) => { input.value = ''; heard(t) },
    onState: (s) => {
      const on = s === 'listening' || s === 'paused'
      mic.classList.toggle('listening', s === 'listening')
      mic.setAttribute('aria-label', s === 'listening' ? 'Stop listening' : 'Speak a command or question')
      modeBtn.setAttribute('aria-pressed', String(listener.handsFree))
      if (s === 'listening') note(listener.handsFree ? 'Voice mode on. Listening…' : 'Listening…')
      else if (s === 'paused') note('Voice mode on. Waiting while I talk…', true)
      else if (s === 'denied') { note('Microphone blocked. Allow it in the browser, then try again.', true); m.voiceModePref.set(false) }
      else if (!on && !chip.textContent.startsWith('Heard')) note('')
    },
    onError: (code) => { if (code !== 'not-allowed' && code !== 'service-not-allowed') note('I could not hear that. Try again.', true) },
  })
  if (!listener.supported) return
  mic.hidden = false; modeBtn.hidden = false
  mic.addEventListener('click', () => {
    if (listener.state === 'listening') { listener.handsFree ? setVoiceMode(false) : listener.stop(); return }
    voice.cancel()   // don't let the mic hear NOVA
    listener.once()
  })
  modeBtn.addEventListener('click', () => setVoiceMode(!listener.handsFree))
  addEventListener('keydown', (e) => {
    if (e.altKey && e.code === 'KeyV' && !e.ctrlKey && !e.metaKey) { e.preventDefault(); mic.click() }
  })
  if (m.voiceModePref.get()) setVoiceMode(true)   // arrived with voice mode on; a browser that needs a tap shows 'denied' or waits
  voiceReady = m
}
let voiceReady = null
function setVoiceMode(on) {
  if (!listener) return
  voiceReady?.voiceModePref.set(on)
  if (on) { voice.cancel(); listener.setHandsFree(true); say({ text: 'Voice mode on. Say a command, like open alerts.' }, { instant: true }) }
  else { listener.setHandsFree(false); note('Voice mode off.', true) }
}
setupVoice()

/* NOVA herself: a nudge */
const bot = $('#bot')
function poke() { if (ready && !busy) say({ text: 'Still here. Ask me something, or pick a door above.' }) }
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
  token++; voice.cancel(); setBusy(false); scene.talk(false)
  say({ text: GO_LINE[a.kind] }, { instant: true, quiet: true })
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
  cosmos.close({ instant: true })
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
sBtn.addEventListener('click', () => {
  sound.set(!sound.on); voice.set(sound.on); showSound()
  if (sound.on) { voice.unlock(); if (ready && !busy) say({ text: "Voice on. I'll read my answers out loud." }) }
})
if (sound.wanted()) {
  const resume = () => { if (!sound.on) { sound.set(true); voice.set(true); voice.unlock(); showSound() } }
  addEventListener('pointerdown', resume, { once: true }); addEventListener('keydown', resume, { once: true })
}
showSound()

/* ───────────────────────── hand-off to the console ─────────────────────────
   VITA follows the visitor into the console and the cabin (app/src/vita): as this page closes it leaves the Sound choice,
   the tour that was asked for and the last six chat messages in sessionStorage ('adx-vita'). */
function saveHandoff() {
  try {
    const old = JSON.parse(sessionStorage.getItem('adx-vita') || 'null') || {}
    sessionStorage.setItem('adx-vita', JSON.stringify({
      ...old, sound: sound.on, tour: window.ADX_TOUR_MODE || null,
      chat: chatLog.slice(-6).map((m) => ({ role: m.role, text: String(m.text).slice(0, 1200) })),
    }))
  } catch { /* storage off: the console starts fresh */ }
}
addEventListener('pagehide', saveHandoff)

/* ───────────────────────── 1-click tour hooks (tour.js) ───────────────────────── */
window.ADX_BRIEFING = {
  /** Play the briefing as the tour's first chapter. Resolves true when NOVA has finished. */
  async runTour() {
    cosmos.close({ instant: true }); closeLibrary(); paused = false
    if (!(await runIntro())) return false
    const tok = token
    light('console')
    await say({ text: "First stop: the <em>Crew Console</em>. I'll meet you in the cabin later.", door: 'console' })
    return sleep(1200, tok)
  },
  setPaused(v) { paused = !!v; scene.talk(!paused && busy); paused ? voice.pause() : voice.resume() },
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
