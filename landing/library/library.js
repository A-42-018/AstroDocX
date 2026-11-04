// NASA Library: self-contained vanilla ES module.
//   import { mountLibrary } from '/library/library.js'
//   const lib = mountLibrary(el, { collection: 'radiation', query: '', onClose })
//   lib.setCollection('twins-study'); lib.destroy()
// Media come from NASA's Image and Video Library (images-api.nasa.gov) and are shown with credit.
// Not affiliated with or endorsed by NASA.

const API = 'https://images-api.nasa.gov'
const ASSETS = 'https://images-assets.nasa.gov'
const DATA_URL = new URL('./collections.json', import.meta.url)
const CSS_URL = new URL('./library.css', import.meta.url)
const NOISE = /\b(patch(es)?|logo|insignia|emblem)\b/i
const THIRD_PARTY = /copyright|©|\(c\)\s*\d{4}|courtesy of|used with permission|all rights reserved/i
const TYPES = [['image', 'Images'], ['video', 'Video'], ['audio', 'Audio']]
const ICON = {
  image: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M3 5h18v14H3zM3 16l5-5 4 4 3-3 6 6"/><circle cx="16" cy="9" r="1.6"/></svg>',
  video: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M3 6h13v12H3zM16 10l5-3v10l-5-3"/></svg>',
  audio: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M4 10v4M8 6v12M12 3v18M16 7v10M20 10v4"/></svg>',
}
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
const detailsUrl = (id) => `https://images.nasa.gov/details/${encodeURIComponent(id)}`
const prefersReduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches
const reach = new Map() // url -> Promise<json|null>

let dataPromise
function loadData() {
  dataPromise ||= fetch(DATA_URL).then((r) => { if (!r.ok) throw new Error('collections ' + r.status); return r.json() })
  return dataPromise
}
function ensureCss() {
  if (document.querySelector('link[data-nlib]')) return
  const l = document.createElement('link')
  l.rel = 'stylesheet'; l.href = CSS_URL.href; l.dataset.nlib = ''
  document.head.appendChild(l)
}
async function api(path, signal) {
  const r = await fetch(API + path, { signal })
  if (!r.ok) throw new Error('NASA API ' + r.status)
  return r.json()
}
function pickAsset(urls, type) {
  const ext = type === 'video' ? /\.mp4$/i : type === 'audio' ? /\.(mp3|m4a)$/i : /\.jpe?g$/i
  const list = urls.filter((u) => ext.test(u))
  const prefs = type === 'video' ? ['~mobile.', '~medium.', '~large.'] : type === 'audio' ? ['.mp3'] : ['~large.', '~medium.']
  for (const k of prefs) { const m = list.find((u) => u.includes(k)); if (m) return m }
  return list.find((u) => !/~orig/.test(u)) || list[0] || null
}
function thumbFor(it) {
  if (it.thumb) return it.thumb
  if (it.media_type === 'image') return `${ASSETS}/image/${encodeURIComponent(it.nasa_id)}/${encodeURIComponent(it.nasa_id)}~thumb.jpg`
  return ''
}
function imageCandidates(it) {
  const t = thumbFor(it)
  const big = t.replace(/~thumb\.(jpe?g|png)$/i, '~large.$1')
  const mid = t.replace(/~thumb\.(jpe?g|png)$/i, '~medium.$1')
  return [...new Set([big, mid, t].filter(Boolean))]
}
const waveBars = (n = 28) => Array.from({ length: n }, (_, i) => `<i style="--h:${18 + Math.round(Math.abs(Math.sin(i * 1.7) * Math.cos(i * 0.6)) * 70)}%;--d:${((i * 0.13) % 1).toFixed(2)}s"></i>`).join('')

export function mountLibrary(el, opts = {}) {
  ensureCss()
  const { onClose } = opts
  const ac = new AbortController()
  const on = (t, ev, fn, o) => { t.addEventListener(ev, fn, o); cleanup.push(() => t.removeEventListener(ev, fn, o)) }
  const cleanup = []
  let data = null
  let colId = opts.collection || 'bone-muscle'
  let mtype = 'image'
  let query = ''
  let searchCtl = null
  let modal = null
  let opener = null
  let destroyed = false
  let imgOk = 0, imgBad = 0

  el.classList.add('nlib')
  el.innerHTML = `
    <div class="nlib-h">
      <div><div class="ph"><span class="ph-dot"></span><span class="ph-title">NASA library</span><span class="ph-meta">from NASA's Image and Video Library</span></div>
      <h2>The science behind AstroDocX</h2></div>
      <button type="button" class="hbtn ghost" data-act="close">Back to briefing</button>
    </div>
    <div class="hp nlib-tip" role="status"><b>VITA</b><span data-r="tip"></span></div>
    <div class="nlib-bar">
      <div class="seg" role="group" aria-label="Media type">${TYPES.map(([t, l]) => `<button type="button" data-t="${t}" aria-pressed="${t === mtype}">${l}</button>`).join('')}</div>
      <div class="colls" role="group" aria-label="Collections" data-r="colls"></div>
      <form class="search" role="search" data-r="form"><label class="sr" for="nlib-q-${uid()}">Search NASA media</label><input type="search" name="q" placeholder="Search NASA media" autocomplete="off" enterkeyhint="search"><button type="submit" class="go">Search</button></form>
    </div>
    <div class="nlib-status" data-r="status" role="status" hidden></div>
    <ul class="nlib-grid" data-r="grid" aria-label="NASA media"></ul>
    <div class="nlib-foot"><span>Media and descriptions: NASA (images.nasa.gov), shown with credit. Not affiliated with or endorsed by NASA.</span><span data-r="count" aria-live="polite"></span></div>`
  const $ = (s) => el.querySelector(`[data-r="${s}"]`)
  const input = el.querySelector('input')
  input.id = el.querySelector('label').htmlFor
  function uid() { return Math.random().toString(36).slice(2, 8) }

  // ---------- data & render ----------
  const col = () => data?.collections.find((c) => c.id === colId)
  function setStatus(msg, kind = '') { const s = $('status'); s.hidden = !msg; s.textContent = msg || ''; s.className = 'nlib-status ' + kind }
  function renderChips() {
    $('colls').innerHTML = (data?.collections || []).map((c) => `<button type="button" class="coll" data-c="${c.id}" aria-pressed="${!query && c.id === colId}">${esc(c.title)}</button>`).join('')
  }
  function tip(text) { $('tip').textContent = text }
  function render() {
    if (destroyed) return
    el.querySelectorAll('.seg button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.t === mtype)))
    renderChips()
    imgOk = 0; imgBad = 0
    if (query) return // search results render themselves
    const c = col()
    if (!c) { $('grid').innerHTML = '<li class="empty">Loading collections&hellip;</li>'; return }
    tip(c.intro)
    const items = c.items.filter((i) => i.media_type === mtype)
    $('count').textContent = `${items.length} ${mtype} picks from NASA`
    setStatus(navigator.onLine === false ? "You're offline. Showing saved titles and captions; NASA media will load when you reconnect." : '')
    drawGrid(items, true)
    if (!items.length) {
      const others = TYPES.filter(([t]) => t !== mtype && c.items.some((i) => i.media_type === t)).map(([, l]) => l.toLowerCase())
      $('grid').innerHTML = `<li class="empty">No ${mtype} picked for this collection yet.${others.length ? ` Try ${others.join(' or ')}, or search NASA above.` : ''}</li>`
    }
  }
  function drawGrid(items, curated) {
    const grid = $('grid')
    grid.scrollTop = 0
    grid.innerHTML = items.map((it, i) => {
      const yr = it.date ? it.date.slice(0, 4) : ''
      const credit = `${esc(it.center || 'NASA')}${yr ? ' &middot; ' + esc(yr) : ''}`
      const t = thumbFor(it)
      const art = it.media_type === 'audio'
        ? `<div class="wave" aria-hidden="true">${waveBars()}</div>`
        : `${t ? `<img src="${esc(t)}" alt="" loading="lazy" decoding="async" width="640" height="400">` : ''}<div class="ph-img" aria-hidden="true">${ICON[it.media_type]}<span>${t ? 'Preview unavailable' : it.media_type}</span></div>`
      return `<li><button type="button" class="hp tile ${it.media_type}" data-i="${i}" aria-haspopup="dialog" aria-label="${esc(it.title)}, ${it.media_type}, NASA ${esc(it.center || 'NASA')}${yr ? ', ' + esc(yr) : ''}. Open">
        <div class="th${t || it.media_type === 'audio' ? '' : ' noimg'}">${art}<span class="tag ${it.media_type}">${it.media_type}</span></div>
        <div class="tt">${esc(it.title)}</div><div class="cr">NASA ${credit}</div></button></li>`
    }).join('')
    shown = items
    grid.querySelectorAll('img').forEach((img) => {
      const th = img.closest('.th')
      img.addEventListener('load', () => { imgOk++ })
      img.addEventListener('error', () => { imgBad++; th.classList.add('nophoto'); checkReach(curated) })
    })
  }
  let shown = []
  function checkReach(curated) {
    if (imgBad >= 2 && imgOk === 0 && curated) setStatus("Can't reach NASA right now, so previews are replaced by placeholders. The picks and captions below are saved on this site; opening a video, audio clip or full image needs a connection.")
  }

  // ---------- search ----------
  async function runSearch(q) {
    searchCtl?.abort()
    searchCtl = new AbortController()
    query = q
    renderChips()
    tip(`Live search of NASA's library for "${q}". Patches and logos are filtered out. Ask me about anything you see.`)
    $('grid').innerHTML = '<li class="empty">Searching NASA&hellip;</li>'
    setStatus('')
    try {
      const j = await api(`/search?q=${encodeURIComponent(q)}&media_type=${mtype}&page_size=60`, searchCtl.signal)
      if (destroyed) return
      const out = []
      for (const it of j.collection.items) {
        const d = it.data?.[0]; if (!d || d.media_type !== mtype) continue
        if (NOISE.test(`${d.title} ${(d.keywords || []).join(' ')}`)) continue
        if (THIRD_PARTY.test(`${d.description || ''} ${d.secondary_creator || ''} ${d.photographer || ''}`)) continue
        const thumb = (it.links || []).find((l) => l.rel === 'preview')?.href || ''
        const desc = (d.description || '').replace(/^[^\n]{0,40}\([^)]*\)\s*-+\s*/, '').replace(/\s+/g, ' ').trim()
        out.push({ nasa_id: d.nasa_id, media_type: d.media_type, title: d.title, center: d.center, date: (d.date_created || '').slice(0, 10), caption: desc.length > 240 ? desc.slice(0, 237) + '…' : desc, thumb })
        if (out.length >= 36) break
      }
      $('count').textContent = `${out.length} ${mtype} results from NASA`
      if (!out.length) { $('grid').innerHTML = '<li class="empty">No usable NASA results for that. Try other words, or pick a collection.</li>'; shown = []; return }
      drawGrid(out, false)
    } catch (e) {
      if (e.name === 'AbortError' || destroyed) return
      shown = []
      $('count').textContent = ''
      $('grid').innerHTML = '<li class="empty">Search is unavailable.</li>'
      setStatus("Couldn't reach NASA's search. Check your connection, or choose a collection to see the saved picks.")
    }
  }
  function clearSearch() { searchCtl?.abort(); query = ''; input.value = '' }

  // ---------- modal ----------
  function openItem(it, from) {
    closeModal(true)
    opener = from
    const m = document.createElement('div')
    m.className = 'nlib nlib-modal'
    m.setAttribute('role', 'dialog'); m.setAttribute('aria-modal', 'true')
    const hid = 'nlib-t-' + uid()
    m.setAttribute('aria-labelledby', hid)
    const yr = it.date || ''
    m.innerHTML = `<div class="hp box"><button type="button" class="hbtn ghost x" data-act="mclose" aria-label="Close">Close</button>
      <div class="stage" data-r="stage"></div>
      <div class="info"><div class="meta"><span class="tag ${it.media_type}">${it.media_type}</span><span>NASA &middot; ${esc(it.center || 'NASA')}${yr ? ' &middot; ' + esc(yr) : ''}</span></div>
      <h3 id="${hid}">${esc(it.title)}</h3>
      ${it.caption ? `<p>${esc(it.caption)}</p>` : ''}
      <div class="row"><span class="credit">Credit: NASA${it.center ? ' / ' + esc(it.center) : ''}${yr ? ', ' + esc(yr) : ''}. Not affiliated with or endorsed by NASA.</span>
      <a class="hbtn pri" href="${detailsUrl(it.nasa_id)}" target="_blank" rel="noopener">View on NASA</a></div></div></div>`
    document.body.appendChild(m)
    modal = m
    on(m, 'click', (e) => { if (e.target === m || e.target.closest('[data-act=mclose]')) closeModal() })
    const stage = m.querySelector('.stage')
    if (it.media_type === 'image') fillImage(stage, it)
    else fillMedia(stage, it)
    m.querySelector('[data-act=mclose]').focus()
  }
  function msg(stage, text) { stage.innerHTML = `<div class="msg">${esc(text)}</div>` }
  function fillImage(stage, it) {
    const cands = imageCandidates(it)
    let n = 0
    const img = new Image()
    img.alt = `${it.title}. ${it.caption || ''}`.trim()
    img.onerror = () => { if (++n < cands.length) img.src = cands[n]; else msg(stage, "Couldn't load this image from NASA. Use \"View on NASA\" to try the original.") }
    stage.innerHTML = ''; stage.appendChild(img)
    img.src = cands[0] || ''
    if (!cands.length) msg(stage, "No preview available. Use \"View on NASA\".")
  }
  async function fillMedia(stage, it) {
    msg(stage, 'Loading from NASA…')
    try {
      const j = await api(`/asset/${encodeURIComponent(it.nasa_id)}`)
      const urls = j.collection.items.map((x) => x.href)
      const src = pickAsset(urls, it.media_type)
      if (!src || !modal) throw new Error('no asset')
      const url = src.replace(/^http:/, 'https:')
      if (it.media_type === 'video') {
        const vtt = urls.find((u) => /\.vtt$/i.test(u))
        stage.innerHTML = `<video controls playsinline preload="metadata" ${thumbFor(it) ? `poster="${esc(thumbFor(it))}"` : ''} aria-label="${esc(it.title)}"><source src="${esc(url)}" type="video/mp4">${vtt ? `<track kind="captions" src="${esc(vtt.replace(/^http:/, 'https:'))}" srclang="en" label="English">` : ''}</video>`
        const v = stage.querySelector('video')
        v.addEventListener('error', () => msg(stage, "This video wouldn't play here. Use \"View on NASA\" to watch it there."), true)
        if (!prefersReduced()) v.play().catch(() => {})
      } else {
        stage.innerHTML = `<div class="abox"><div class="wave" aria-hidden="true">${waveBars(48)}</div><audio controls preload="metadata" aria-label="${esc(it.title)}" src="${esc(url)}"></audio></div>`
        const a = stage.querySelector('audio'), box = stage.querySelector('.abox')
        a.addEventListener('play', () => box.classList.add('playing'))
        a.addEventListener('pause', () => box.classList.remove('playing'))
        a.addEventListener('ended', () => box.classList.remove('playing'))
        a.addEventListener('error', () => msg(stage, "This audio wouldn't play here. Use \"View on NASA\" to listen there."))
      }
    } catch {
      if (modal) msg(stage, `Couldn't reach NASA to load this ${it.media_type}. The title, caption and credit below are saved here. Try "View on NASA" when you're back online.`)
    }
  }
  function closeModal(silent) {
    if (!modal) return
    modal.querySelectorAll('video,audio').forEach((m) => { m.pause(); m.removeAttribute('src'); m.load?.() })
    modal.remove(); modal = null
    if (!silent && opener && el.contains(opener)) opener.focus()
    if (!silent) opener = null
  }

  // ---------- events ----------
  on(el, 'click', (e) => {
    const t = e.target.closest('button'); if (!t) return
    if (t.dataset.act === 'close') return onClose?.()
    if (t.dataset.t) { mtype = t.dataset.t; return query ? runSearch(query).then(render2) : render() }
    if (t.dataset.c) { clearSearch(); colId = t.dataset.c; return render() }
    if (t.classList.contains('tile')) { const it = shown[+t.dataset.i]; if (it) openItem(it, t) }
  })
  function render2() { if (destroyed) return; el.querySelectorAll('.seg button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.t === mtype))) }
  on($('form'), 'submit', (e) => { e.preventDefault(); const q = input.value.trim(); if (q) runSearch(q); else { clearSearch(); render() } })
  on(document, 'keydown', (e) => {
    if (e.key === 'Escape') {
      if (modal) { e.preventDefault(); e.stopPropagation(); closeModal(); return }
      if (el.isConnected && onClose) { e.preventDefault(); onClose() }
      return
    }
    if (modal && e.key === 'Tab') { // focus trap
      const f = [...modal.querySelectorAll('button,a[href],video[controls],audio[controls],[tabindex]:not([tabindex="-1"])')].filter((n) => !n.disabled && n.offsetParent !== null)
      if (!f.length) return
      const first = f[0], last = f[f.length - 1]
      if (!modal.contains(document.activeElement)) { e.preventDefault(); first.focus() }
      else if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
      return
    }
    // arrow-key movement around the grid
    const tile = document.activeElement?.closest?.('.tile')
    if (!modal && tile && el.contains(tile) && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(e.key)) {
      const tiles = [...$('grid').querySelectorAll('.tile')]
      const i = tiles.indexOf(tile)
      const cols = getComputedStyle($('grid')).gridTemplateColumns.split(' ').length || 1
      const next = { ArrowLeft: i - 1, ArrowRight: i + 1, ArrowUp: i - cols, ArrowDown: i + cols, Home: 0, End: tiles.length - 1 }[e.key]
      if (tiles[next]) { e.preventDefault(); tiles[next].focus() }
    }
  }, true)
  on(window, 'offline', () => { if (!query) render() })
  on(window, 'online', () => { if (!query) render() })

  // ---------- boot ----------
  tip('Pick a hazard and I will pull NASA\'s own media on it. Ask me about anything you see.')
  loadData().then((d) => {
    if (destroyed) return
    data = d
    if (!d.collections.some((c) => c.id === colId)) colId = d.collections[0].id
    if (opts.query) { input.value = opts.query; mtype = 'image'; renderChips(); runSearch(opts.query) } else render()
  }).catch(() => {
    $('grid').innerHTML = '<li class="empty">The saved collections could not be loaded.</li>'
    setStatus("Couldn't load this site's saved NASA picks. Try reloading the page.")
  })

  return {
    setCollection(id) {
      if (!data) { colId = id; return }
      if (!data.collections.some((c) => c.id === id)) return
      clearSearch(); colId = id; render()
    },
    destroy() {
      destroyed = true; searchCtl?.abort(); ac.abort(); closeModal(true)
      cleanup.forEach((f) => f()); cleanup.length = 0
      el.classList.remove('nlib'); el.innerHTML = ''
    },
  }
}
