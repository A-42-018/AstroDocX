import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { ask, offlineAnswer, checkLive } from '../../../landing/vita/ask.js'

const faq = JSON.parse(readFileSync(new URL('../../../landing/vita/faq.json', import.meta.url), 'utf8'))
const kb = JSON.parse(readFileSync(new URL('../../../knowledge/chunks.json', import.meta.url), 'utf8'))
const kbUrls = new Set(kb.map((c) => c.url))
const LIB = ['bone-muscle', 'radiation', 'sleep-isolation', 'twins-study', 'life-support', 'spacewalks']
const routes = new Set(kb.find((c) => c.id === 'adx-screens').routes)

const CASES = [
  ['Hello!', 'greeting'], ['What is AstroDocX?', 'what-is-astrodocx'], ['How does it detect problems?', 'how-detection'],
  ['What is a personal baseline?', 'baseline'], ['What does Watch vs Act mean?', 'alert-status'],
  ['Why does CO2 matter on a spacecraft?', 'co2'], ['What is the carbon dioxide limit?', 'co2'],
  ['How dangerous is space radiation?', 'radiation'], ['What happens in a solar particle event?', 'solar-event'],
  ['Do astronauts lose bone?', 'bone'], ['Why do muscles waste away in space?', 'muscle'], ['How much do astronauts exercise?', 'exercise'],
  ['What is SANS?', 'sans'], ['Does space hurt your eyesight?', 'sans'], ['Do astronauts sleep well in orbit?', 'sleep'],
  ['How does isolation affect mental health?', 'isolation'], ['Does the immune system change in space?', 'immune'],
  ['Tell me about the Twins Study', 'twins'], ['What about the heart and HRV?', 'heart'], ['What is microgravity?', 'microgravity'],
  ['What happens when there is a communication delay with Earth?', 'distance'], ['What are the five hazards?', 'five-hazards'],
  ['Which studies do you cite?', 'evidence'], ['What limits does it use?', 'limits'], ['What screens are there in the console?', 'screens'],
  ['What is on the status board?', 'board'], ['Show me the trends charts', 'trends'], ['How does the daily check-in work?', 'checkin'],
  ['Can I inject a scenario in the simulator?', 'simulator'], ['What is Ground View?', 'ground-view'], ['What is on the NASA Data page?', 'nasa-data'],
  ['Take me to the 3D cabin', 'cabin'], ['What is a spacewalk?', 'eva'], ['Give me the guided tour', 'tour'],
  ['Where can I see NASA photos and videos?', 'library'], ['Is this a medical device?', 'not-medical'], ['Is AstroDocX endorsed by NASA?', 'nasa-affiliation'],
  ['Who built this for the hackathon?', 'team'], ['What is not built yet?', 'roadmap'], ['Can I install it and use it offline?', 'pwa'],
  ['What can I ask you?', 'help'],
]

for (const [q, id] of CASES) test(`offline: "${q}" -> ${id}`, () => assert.equal(offlineAnswer(q, faq).matched, id))

test('offline: at least 25 patterns-entries and every door is covered', () => {
  assert.ok(faq.faq.length >= 25 && faq.faq.length <= 45)
  const kinds = new Set(faq.faq.flatMap((e) => e.actions.map((a) => a.kind)))
  for (const k of ['console', 'cabin', 'library', 'tour']) assert.ok(kinds.has(k), k)
  const libs = new Set(faq.faq.flatMap((e) => e.actions.filter((a) => a.kind === 'library').map((a) => a.target)))
  for (const t of LIB) assert.ok(libs.has(t), `library ${t}`)
})

test('offline: every citation url is in the knowledge base, every action target is valid, text is short and tag-free', () => {
  for (const e of [...faq.faq, faq.fallback]) {
    const id = e.id ?? 'fallback'
    for (const c of e.citations) assert.ok(kbUrls.has(c.url), `${id}: ${c.url} not in knowledge base`)
    for (const a of e.actions) {
      if (a.kind === 'library') assert.ok(LIB.includes(a.target), id)
      if (a.kind === 'console') assert.ok(routes.has(a.target.split('?')[0]), `${id}: ${a.target}`)
      if (a.kind === 'cabin') assert.ok(['', 'eva'].includes(a.target), id)
      if (a.kind === 'tour') assert.equal(a.target, '')
    }
    assert.ok(e.text.replace(/<\/?em>/g, '').indexOf('<') < 0, id)
    assert.ok(e.text.split(/\s+/).length <= 120, `${id} too long`)
    if (e.id !== 'diagnosis' && e.id !== 'greeting' && e.id !== 'help') assert.ok(e.citations.length, `${id} has no citation`)
  }
})

test('offline: numbers in answers match the engine limits', () => {
  assert.match(offlineAnswer('co2 limit', faq).text, /3 mmHg/)
  const r = offlineAnswer('radiation limit', faq).text
  assert.match(r, /600 mSv/); assert.match(r, /250 mSv/)
})

test('offline: diagnosis and personal medical questions are declined, with no citations', () => {
  for (const q of ['Can you diagnose me?', 'I have a headache and chest pain, what is wrong with me?', 'What medicine should I take for my back pain?', 'Do I have SANS?']) {
    const a = offlineAnswer(q, faq)
    assert.equal(a.matched, 'diagnosis', q)
    assert.match(a.text, /can't diagnose/); assert.deepEqual(a.citations, [])
  }
})

test('offline: off-topic questions get the polite fallback, not a made-up answer', () => {
  for (const q of ['Who won the football match?', 'Write me a poem about pizza', 'what is the capital of France', '']) {
    const a = offlineAnswer(q, faq)
    assert.equal(a.matched, null, q)
    assert.match(a.text, /don't have a sourced answer/)
  }
})

const live = { text: 'Hi <em>there</em><script>x</script>', citations: [{ label: 'A', url: 'https://nasa.gov/x' }, { label: 'B', url: 'javascript:alert(1)' }],
  actions: [{ label: 'Go', kind: 'library', target: 'radiation' }, { label: 'Bad', kind: 'library', target: 'nope' }, { label: 'Bad2', kind: 'console', target: 'https://evil' }, { label: 'T', kind: 'tour', target: 'x' }] }

test('checkLive: strips tags except <em>, drops bad urls and bad actions', () => {
  const r = checkLive(live)
  assert.equal(r.text, 'Hi <em>there</em>scriptx/script')
  assert.deepEqual(r.citations, [{ label: 'A', url: 'https://nasa.gov/x' }])
  assert.deepEqual(r.actions.map((a) => a.kind + ':' + a.target), ['library:radiation', 'tour:'])
  assert.equal(r.source, 'live')
  assert.equal(checkLive({ text: '' }), null)
})

const withFetch = async (impl, fn) => {
  const prev = globalThis.fetch; globalThis.fetch = impl
  try { return await fn() } finally { globalThis.fetch = prev }
}
// ask() in Node loads faq.json through the same dynamic import the browser uses
test('ask(): live answer when the endpoint works', () => withFetch(async () => ({ ok: true, json: async () => live }), async () => {
  const r = await ask('hello', { history: [], page: 'home' })
  assert.equal(r.source, 'live')
}))
for (const [name, impl] of [
  ['network error', async () => { throw new TypeError('fetch failed') }],
  ['503 (no API key)', async () => ({ ok: false, status: 503, json: async () => ({}) })],
  ['429', async () => ({ ok: false, status: 429, json: async () => ({}) })],
  ['invalid JSON', async () => ({ ok: true, json: async () => { throw new SyntaxError('x') } })],
  ['unusable payload', async () => ({ ok: true, json: async () => ({ nope: 1 }) })],
]) test(`ask(): falls back offline on ${name} and never throws`, () => withFetch(impl, async () => {
  const r = await ask('Why does CO2 matter?')
  assert.equal(r.source, 'offline'); assert.match(r.text, /3 mmHg/); assert.equal('matched' in r, false)
}))
test('ask(): bad inputs never throw', async () => {
  for (const q of [undefined, null, 42, {}, '']) { const r = await ask(q, { history: 'x', page: null }); assert.ok(typeof r.text === 'string' && r.source) }
})
