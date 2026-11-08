// VITA's browser client. No build step: <script type="module"> import { ask } from '/vita/ask.js'
//
//   const { text, citations, actions, source } = await ask('Why does CO2 matter?', { history, page })
//
// Live answers come from POST /api/ask (Claude, answering only from the curated sources in knowledge/).
// If that is unavailable for any reason (offline, 503 with no API key, timeout, bad reply) it answers from
// the offline matcher built on faq.json, with source: 'offline'. It never throws.

const ENDPOINT = '/api/ask'
const LIVE_TIMEOUT_MS = 18_000
const MAX_QUESTION = 500
const LIBRARY = ['bone-muscle', 'radiation', 'sleep-isolation', 'twins-study', 'life-support', 'spacewalks']
const KINDS = ['console', 'cabin', 'library', 'tour']

/* ---------- offline matcher ---------- */

/** Score one entry: each matching pattern adds 10 plus the length of what it matched (longer = more specific). */
export function scoreEntry(entry, q) {
  let score = 0
  entry._re ??= entry.patterns.map((p) => new RegExp(`(?<![a-z0-9])(?:${p})`, 'i'))
  for (const re of entry._re) {
    const m = re.exec(q)
    if (m) score += 10 + m[0].trim().length
  }
  return score ? score * (entry.weight ?? 1) : 0
}

/** Best offline answer for `question` from a parsed faq.json, in the public response shape. */
export function offlineAnswer(question, data) {
  const q = String(question ?? '').toLowerCase().normalize('NFC').slice(0, MAX_QUESTION * 2)
  let best = null, bestScore = 0
  for (const e of data.faq) {
    const s = scoreEntry(e, q)
    if (s > bestScore) { best = e; bestScore = s }
  }
  const pick = best ?? data.fallback
  return { text: pick.text, citations: pick.citations.map((c) => ({ ...c })), actions: pick.actions.map((a) => ({ ...a })), source: 'offline', matched: best?.id ?? null }
}

let faqPromise
export function loadFaq() {
  return (faqPromise ??= import('./faq.json', { with: { type: 'json' } }).then((m) => m.default)
    .catch(() => fetch(new URL('./faq.json', import.meta.url)).then((r) => r.json())))
}
if (typeof window !== 'undefined') loadFaq().catch(() => { faqPromise = undefined }) // warm it while online

const GENERIC = {
  text: "I can't reach my sources right now. Try again in a moment, or take the guided tour.",
  citations: [], actions: [{ label: 'Take the guided tour', kind: 'tour', target: '' }], source: 'offline',
}

/* ---------- checking what the server sends ---------- */

const esc = (s) => s.replace(/[<>]/g, '')
function cleanText(s) {
  if (typeof s !== 'string') return ''
  const parts = s.split(/(<\/?em>)/i)
  return parts.map((p) => (/^<\/?em>$/i.test(p) ? p.toLowerCase() : esc(p))).join('').trim()
}
function cleanAction(a) {
  if (!a || typeof a.label !== 'string' || !KINDS.includes(a.kind)) return null
  const label = esc(a.label).slice(0, 60), target = typeof a.target === 'string' ? a.target : ''
  if (a.kind === 'tour') return { label, kind: 'tour', target: '' }
  if (a.kind === 'library') return LIBRARY.includes(target) ? { label, kind: 'library', target } : null
  if (a.kind === 'cabin') return /^[\w-]{0,24}$/.test(target) ? { label, kind: 'cabin', target } : null
  return /^\/[a-z]+(\?[\w=&.\-]*)?$/.test(target) ? { label, kind: 'console', target } : null
}
/** Returns a safe response, or null if the payload is not usable. */
export function checkLive(d) {
  const text = cleanText(d?.text)
  if (!text) return null
  const citations = (Array.isArray(d.citations) ? d.citations : [])
    .filter((c) => c && typeof c.label === 'string' && /^https:\/\//.test(c.url ?? ''))
    .map((c) => ({ label: esc(c.label), url: c.url }))
  const actions = (Array.isArray(d.actions) ? d.actions : []).map(cleanAction).filter(Boolean)
  return { text, citations, actions, source: 'live' }
}

/* ---------- the public function ---------- */

export async function ask(question, { history = [], page = 'home' } = {}) {
  const q = String(question ?? '').trim().slice(0, MAX_QUESTION)
  try {
    if (typeof fetch === 'function' && q && (typeof navigator === 'undefined' || navigator.onLine !== false)) {
      const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), LIVE_TIMEOUT_MS)
      try {
        const r = await fetch(ask.endpoint, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: ctl.signal,
          body: JSON.stringify({ question: q, page: String(page).slice(0, 40), history: (Array.isArray(history) ? history : []).slice(-6) }),
        })
        if (r.ok) {
          const live = checkLive(await r.json())
          if (live) return live
        }
      } finally { clearTimeout(timer) }
    }
  } catch { /* network error, timeout or bad JSON: use the offline answers */ }
  try {
    const { matched, ...out } = offlineAnswer(q, await loadFaq())
    return out
  } catch { return { ...GENERIC } }
}
ask.endpoint = ENDPOINT
